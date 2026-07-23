from datetime import datetime, timezone
import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.models import User
from app.core.security import get_current_user
from app.services.support_mail import (
    build_feedback_flyer,
    build_feedback_flyer_png,
    drake_logo_bytes,
    send_support_mail,
)


router = APIRouter()
logger = logging.getLogger(__name__)


class AccessRequest(BaseModel):
    module_id: str = Field(min_length=1, max_length=100)
    module_label: str = Field(min_length=1, max_length=160)
    page_path: str = Field(min_length=1, max_length=500)


class ModuleFeedback(BaseModel):
    module_id: str = Field(min_length=1, max_length=100)
    module_label: str = Field(min_length=1, max_length=160)
    rating: int = Field(ge=1, le=5)
    message: str = Field(default="", max_length=4000)


class FeedbackRequest(BaseModel):
    page_path: str = Field(min_length=1, max_length=500)
    modules: list[ModuleFeedback] = Field(min_length=1, max_length=100)


def user_fields(user: User) -> list[tuple[str, str]]:
    return [
        ("User ID", str(user.id)),
        ("Name", user.full_name),
        ("Email / Username", user.email),
        ("Role", user.role.value if hasattr(user.role, "value") else str(user.role)),
    ]


@router.post("/access-request")
def request_module_access(
    request: AccessRequest,
    current_user: User = Depends(get_current_user),
):
    request_reference = uuid4().hex[:12].upper()
    fields = [
        *user_fields(current_user),
        ("Module", request.module_label),
        ("Module ID", request.module_id),
        ("Page", request.page_path),
        ("Requested at", datetime.now(timezone.utc).isoformat()),
    ]
    try:
        send_support_mail(
            subject=f"Drake AI module access request [{request_reference}]: {request.module_label}",
            heading="New module access request",
            fields=fields,
        )
    except Exception as exc:
        logger.exception("Unable to send module access request email")
        raise HTTPException(status_code=502, detail="Unable to send the access request email") from exc
    return {"message": "Access request sent to the Drake AI admin team"}


@router.post("/feedback")
def submit_feedback(
    request: FeedbackRequest,
    current_user: User = Depends(get_current_user),
):
    feedback_reference = uuid4().hex[:12].upper()
    module_fields: list[tuple[str, str]] = []
    for index, module in enumerate(request.modules, start=1):
        module_fields.extend([
            (f"{index}. Module", module.module_label),
            (f"{index}. Module ID", module.module_id),
            (f"{index}. Rating", f"{module.rating}/5"),
            (f"{index}. Feedback", module.message.strip() or "No written feedback"),
        ])
    submitted_at = datetime.now(timezone.utc).isoformat()
    identity_fields = user_fields(current_user)
    fields = [
        *identity_fields,
        ("Page", request.page_path),
        ("Modules reviewed", str(len(request.modules))),
        *module_fields,
        ("Submitted at", submitted_at),
    ]
    module_responses = [
        (module.module_label, module.rating, module.message)
        for module in request.modules
    ]
    feedback_flyer = build_feedback_flyer(
        user_fields=identity_fields,
        page_path=request.page_path,
        modules=module_responses,
        submitted_at=submitted_at,
    )
    downloadable_flyer = build_feedback_flyer_png(
        user_fields=identity_fields,
        page_path=request.page_path,
        modules=module_responses,
        submitted_at=submitted_at,
    )
    attachment_timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    try:
        send_support_mail(
            subject=(
                f"Drake AI feedback review [{feedback_reference}]: "
                f"{current_user.email} - {len(request.modules)} modules"
            ),
            heading="New multi-module feedback review",
            fields=fields,
            html_body=feedback_flyer,
            inline_images=[(
                "drake-ai-logo.png",
                "image/png",
                drake_logo_bytes(),
                "drake-logo@thedrake.ai",
            )],
            attachments=[(
                f"drake-ai-feedback-{current_user.id}-{attachment_timestamp}.png",
                "image/png",
                downloadable_flyer,
            )],
        )
    except Exception as exc:
        logger.exception("Unable to send feedback email")
        raise HTTPException(status_code=502, detail="Unable to send the feedback email") from exc
    return {"message": "Feedback sent to the Drake AI admin team"}
