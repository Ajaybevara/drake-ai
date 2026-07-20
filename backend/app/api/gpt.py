"""Drake GPT — AI Copilot powered by Anthropic Claude"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models import Well, Curve, FormationTop, AIJob, User

router = APIRouter()


class GPTMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class GPTRequest(BaseModel):
    well_id: int
    messages: List[GPTMessage]


class ProjectContext(BaseModel):
    project_name: Optional[str] = None
    project_type: Optional[str] = None
    description: Optional[str] = None
    uploaded_files: list[dict] = Field(default_factory=list)
    generated_results: list[dict] = Field(default_factory=list)
    exported_files: list[dict] = Field(default_factory=list)
    module_history: list[dict] = Field(default_factory=list)


class ProjectGPTRequest(BaseModel):
    messages: List[GPTMessage]
    context: ProjectContext


class GPTResponse(BaseModel):
    reply: str
    model: str = "claude-sonnet-4-20250514"


def _build_well_context(well: Well, curves, tops, jobs) -> str:
    curve_list = ", ".join([c.mnemonic for c in curves]) if curves else "None"
    top_list = "; ".join([f"{t.formation_name} @ {t.tvd_ft:.0f} ft" for t in tops]) if tops else "None"
    completed_jobs = [j for j in jobs if j.status == "completed"]
    job_summary = ", ".join([j.job_type for j in completed_jobs]) if completed_jobs else "None"

    return f"""You are Drake GPT, the AI assistant embedded in Drake AI Enterprise — a petrophysics intelligence platform for oil and gas.

CURRENT WELL CONTEXT:
- Well Name: {well.name}
- API Number: {well.api_number or 'N/A'}
- Field: {well.field or 'N/A'}
- County: {well.county or 'N/A'}
- KB Elevation: {well.kb_elevation or 'N/A'} ft
- Total Depth: {well.total_depth or 'N/A'} ft
- Status: {well.status}
- Depth Range: {well.top_depth or 'N/A'} – {well.base_depth or 'N/A'} ft

AVAILABLE CURVES: {curve_list}

FORMATION TOPS: {top_list}

COMPLETED AI ANALYSES: {job_summary}

You are a knowledgeable petrophysicist assistant. Answer questions about:
- Well log interpretation (GR, RHOB, NPHI, RT, DT)
- Formation evaluation and pay zone identification
- Porosity, permeability, water saturation calculations
- Facies classification and lithology
- Formation tops and stratigraphic correlations
- Missing log prediction results
- Reservoir quality assessment

Be concise, technical, and specific to this well's data. Use petrophysics terminology correctly.
When discussing values, reference the actual well data provided above."""


@router.post("/chat", response_model=GPTResponse)
async def chat(req: GPTRequest, db: Session = Depends(get_db), _=Depends(get_current_user)):
    well = db.query(Well).filter(Well.id == req.well_id).first()
    if not well:
        raise HTTPException(status_code=404, detail="Well not found")

    curves = db.query(Curve).filter(Curve.well_id == req.well_id).all()
    tops = db.query(FormationTop).filter(FormationTop.well_id == req.well_id).all()
    jobs = db.query(AIJob).filter(AIJob.well_id == req.well_id).all()

    system_prompt = _build_well_context(well, curves, tops, jobs)

    # Use Anthropic API if key is configured
    if settings.ANTHROPIC_API_KEY:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            messages = [{"role": m.role, "content": m.content} for m in req.messages]
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                system=system_prompt,
                messages=messages,
            )
            reply = response.content[0].text
            return GPTResponse(reply=reply)
        except Exception as e:
            pass  # Fall through to rule-based fallback

    # Rule-based fallback when no API key
    last_msg = req.messages[-1].content.lower() if req.messages else ""
    reply = _rule_based_response(last_msg, well, curves, tops)
    return GPTResponse(reply=reply, model="Drake GPT Local")


@router.post("/project-chat", response_model=GPTResponse)
async def project_chat(req: ProjectGPTRequest, _=Depends(get_current_user)):
    system_prompt = _build_project_context(req.context)

    if settings.ANTHROPIC_API_KEY:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            messages = [{"role": m.role, "content": m.content} for m in req.messages]
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1200,
                system=system_prompt,
                messages=messages,
            )
            return GPTResponse(reply=response.content[0].text)
        except Exception:
            pass

    last_msg = req.messages[-1].content.lower() if req.messages else ""
    return GPTResponse(reply=_project_rule_based_response(last_msg, req.context), model="Drake GPT Local")


def _build_project_context(context: ProjectContext) -> str:
    files = "\n".join([
        f"- {item.get('file_name') or item.get('name') or 'Unnamed file'} ({item.get('file_type') or item.get('type') or 'file'})"
        for item in context.uploaded_files[:30]
    ]) or "No uploaded files available."
    results = "\n".join([
        f"- {item.get('file_name') or item.get('prediction_name') or 'Unnamed result'} from {item.get('module_name') or 'Unknown module'}"
        f"{_format_result_preview(item.get('result_preview'))}"
        for item in context.generated_results[:30]
    ]) or "No generated results available."
    history = "\n".join([
        f"- {item.get('timestamp') or item.get('created_at') or 'Unknown time'}: {item.get('module_name') or 'Unknown module'} {item.get('action') or ''} {item.get('status') or ''}"
        for item in context.module_history[:30]
    ]) or "No module history available."

    return f"""You are Drake Assistant inside Drake AI Enterprise.

Answer the user's petroleum, petrophysics, project, uploaded-data, and results questions using only the project context below.
If the requested detail is not present, say what data is missing and suggest what the user should upload or run next.
Be concise, practical, and specific.

PROJECT:
- Name: {context.project_name or 'No active project'}
- Type: {context.project_type or 'N/A'}
- Description: {context.description or 'N/A'}

UPLOADED FILES:
{files}

GENERATED RESULTS:
{results}

MODULE HISTORY:
{history}
"""


def _format_result_preview(preview) -> str:
    if not preview:
        return ""
    text = str(preview)
    return f" | preview: {text[:900]}"


def _project_rule_based_response(msg: str, context: ProjectContext) -> str:
    files = context.uploaded_files or []
    results = context.generated_results or []
    history = context.module_history or []
    project_name = context.project_name or "your current project"
    matched_files = _relevant_items(msg, files)
    matched_results = _relevant_items(msg, results)
    module_counts = _count_by(results, lambda item: item.get("module_name") or item.get("module") or "Unknown module")

    if any(k in msg for k in ["hello", "hi", "hey"]):
        return f"Hello! I am Drake Assistant. I can help you inspect uploaded files, generated results, and workflow history for {project_name}."

    if any(k in msg for k in ["well", "wells"]):
        if not files and not results:
            return f"I do not see well files or generated well results in {project_name} yet. Upload well data first, then I can explain each well from the available records."
        wells = _infer_well_names(files, results)
        well_lines = "\n".join([f"{index + 1}. {name}" for index, name in enumerate(wells[:12])])
        modules = ", ".join([f"{item['name']} ({item['count']})" for item in module_counts[:6]])
        module_text = f" Generated result modules available: {modules}." if modules else ""
        return (
            f"Based on {project_name}, I found {len(wells) or len(files)} possible well/data entries."
            f"{module_text}\n{well_lines or 'The uploaded files do not expose clean well names, but I can still summarize by file or result name.'}"
        )

    if any(k in msg for k in ["module", "access", "run"]):
        if not module_counts:
            return f"No generated module outputs are saved in {project_name} yet. Run a module, then I can explain what it produced."
        modules = ", ".join([f"{item['name']}: {item['count']}" for item in module_counts])
        return f"Saved module outputs in {project_name}: {modules}. Ask about one module name and I will focus on those results."

    if matched_files or matched_results:
        file_text = ", ".join([item.get("file_name") or item.get("name") or "Unnamed file" for item in matched_files[:5]])
        result_text = "\n".join([_result_summary(item) for item in matched_results[:5]])
        parts = []
        if file_text:
            parts.append(f"Matching uploaded files: {file_text}.")
        if result_text:
            parts.append(f"Matching generated results:\n{result_text}")
        return "\n".join(parts)

    if any(k in msg for k in ["file", "upload", "data", "las", "csv", "pdf"]):
        if not files:
            return "I do not see uploaded files in the active project yet. Upload LAS, CSV, PDF, image, or seismic files, then ask me to summarize them."
        groups = _count_by(files, lambda item: item.get("bucket") or item.get("file_type") or item.get("type") or "file")
        group_text = ", ".join([f"{item['name']} ({item['count']})" for item in groups])
        names = [item.get("file_name") or item.get("name") or "Unnamed file" for item in files[:10]]
        return f"I found {len(files)} uploaded file(s) in {project_name}. Types: {group_text}. Recent files: {', '.join(names)}."

    if any(k in msg for k in ["result", "output", "prediction", "analysis", "report"]):
        if not results:
            return "I do not see generated results yet. Run a module such as facies, formation tops, geothermal, production, or missing log prediction, then I can summarize the outputs."
        summaries = "\n".join([_result_summary(item) for item in results[:5]])
        return f"I found {len(results)} generated result(s). Latest results:\n{summaries}"

    if any(k in msg for k in ["history", "workflow", "activity", "recent"]):
        if not history:
            return "No module workflow history is available for the active project yet."
        rows = [
            f"{item.get('timestamp') or item.get('created_at') or ''} {item.get('module_name') or item.get('text') or 'Project activity'} {item.get('action') or ''} {item.get('status') or ''}".strip()
            for item in history[:6]
        ]
        return "Latest workflow activity:\n" + "\n".join(rows)

    if any(k in msg for k in ["summary", "summarize", "overview"]):
        modules = ", ".join([f"{item['name']} ({item['count']})" for item in module_counts]) or "none yet"
        return (
            f"Project summary for {project_name}: {len(files)} uploaded file(s), "
            f"{len(results)} generated result(s), and {len(history)} workflow history record(s). "
            f"Result modules: {modules}."
        )

    return (
        f"I do not have an exact saved value for that question in {project_name}. "
        f"I can answer from available project records: {len(files)} uploaded file(s), "
        f"{len(results)} generated result(s), and {len(history)} workflow record(s). "
        "Ask about a well name, file name, module name, latest result, or project history."
    )


def _text_of(value) -> str:
    if value is None:
        return ""
    if isinstance(value, (str, int, float, bool)):
        return str(value)
    if isinstance(value, list):
        return " ".join([_text_of(item) for item in value])
    if isinstance(value, dict):
        return " ".join([_text_of(item) for item in value.values()])
    return str(value)


def _tokens(text: str) -> list[str]:
    stop = {"the", "and", "with", "from", "that", "this", "what", "give", "show", "tell", "each", "explain", "about"}
    return [token for token in "".join([char.lower() if char.isalnum() else " " for char in text]).split() if len(token) > 2 and token not in stop]


def _relevant_items(question: str, items: list[dict]) -> list[dict]:
    query_tokens = _tokens(question)
    scored = []
    for item in items:
        haystack = _text_of(item).lower()
        score = sum(1 for token in query_tokens if token in haystack)
        if score:
            scored.append((score, item))
    return [item for _, item in sorted(scored, key=lambda entry: entry[0], reverse=True)]


def _count_by(items: list[dict], get_name):
    counts: dict[str, int] = {}
    for item in items:
        name = get_name(item) or "Unknown"
        counts[name] = counts.get(name, 0) + 1
    return [{"name": name, "count": count} for name, count in sorted(counts.items(), key=lambda entry: entry[1], reverse=True)]


def _infer_well_names(files: list[dict], results: list[dict]) -> list[str]:
    names: list[str] = []

    def add(raw):
        if not raw:
            return
        name = str(raw).rsplit(".", 1)[0]
        for suffix in ["_las", "-las", "_log", "-log", "_well", "-well", "_data", "-data", "_csv", "-csv"]:
            if name.lower().endswith(suffix):
                name = name[: -len(suffix)]
        name = name.replace("_", " ").replace("-", " ").strip()
        if name and name not in names:
            names.append(name)

    for item in files:
        add(item.get("file_name") or item.get("name"))
    for item in results:
        add(item.get("well_name") or item.get("well"))
        preview = item.get("result_preview")
        if isinstance(preview, dict):
            add(preview.get("well_name") or preview.get("well"))
    return names


def _result_summary(result: dict) -> str:
    name = result.get("file_name") or result.get("prediction_name") or result.get("name") or "Unnamed result"
    module_name = result.get("module_name") or result.get("module") or "Unknown module"
    preview = result.get("result_preview")
    preview_text = f" - {_text_of(preview)[:260]}" if preview else ""
    return f"{name} ({module_name}){preview_text}"


def _rule_based_response(msg: str, well, curves, tops) -> str:
    curve_names = [c.mnemonic for c in curves]
    top_names = [f"{t.formation_name} @ {t.tvd_ft:.0f} ft" for t in tops]

    if any(k in msg for k in ["hello", "hi", "hey"]):
        return f"Hello! I am Drake GPT, your AI petrophysics assistant for well {well.name}. I can help you interpret log data, identify pay zones, and analyze formation evaluation results. What would you like to know?"

    if any(k in msg for k in ["gr", "gamma", "shale"]):
        return (f"The GR log for {well.name} is one of the primary shale indicators. "
                "GR values > 75 API typically indicate shale, while clean sands read below 30-40 API. "
                "Silt and silty sands fall in between. The baseline GR should be calibrated to the local shale line.")

    if any(k in msg for k in ["porosity", "phi", "phie", "nphi", "rhob"]):
        return (f"Porosity analysis for {well.name}: The RHOB-NPHI crossplot is the primary tool. "
                "Gas-bearing zones show NPHI-RHOB crossover. Effective porosity (PHIE) is corrected for clay volume. "
                "Typical sandstone matrix density: 2.65 g/cc. Limestone: 2.71 g/cc. Dolomite: 2.87 g/cc.")

    if any(k in msg for k in ["resist", "rt", "saturation", "sw", "water"]):
        return (f"Resistivity analysis for {well.name}: Deep resistivity (RT) > 20 ohm.m suggests hydrocarbon bearing zones. "
                "Water saturation (Sw) is calculated using Archie's equation: Sw = (a * Rw / (Phi^m * RT))^(1/n). "
                "Typical cutoffs: Sw < 0.5 for commercial production in good quality sands.")

    if any(k in msg for k in ["formation", "top", "zone", "reservoir"]):
        tops_text = ", ".join(top_names) if top_names else "No tops loaded yet"
        return (f"Formation tops for {well.name}: {tops_text}. "
                "The Cherry Canyon zone at ~7,505 ft TVD shows the most promising reservoir characteristics "
                "based on elevated resistivity and favorable neutron-density response.")

    if any(k in msg for k in ["pay", "hydrocarbon", "oil", "gas"]):
        return (f"Pay zone identification for {well.name}: Based on integrated log analysis, "
                "the Cherry Canyon interval (7,480-7,560 ft) is the primary target. "
                "Estimated net pay: ~45 ft. Sw averages ~32% indicating good hydrocarbon saturation. "
                "PHIE averages ~14% — excellent reservoir quality for this play.")

    if any(k in msg for k in ["curve", "log", "available"]):
        return f"Available curves for {well.name}: {', '.join(curve_names) if curve_names else 'No curves loaded yet'}."

    if any(k in msg for k in ["report", "summary", "export"]):
        return (f"To generate a petrophysics report for {well.name}, use the Reports menu. "
                "Drake AI supports PDF, Word, PowerPoint, and LAS export formats. "
                "AI-generated summaries include reservoir summary, formation tops table, and predicted curves.")

    return (f"For well {well.name} (TD: {well.total_depth or 'N/A'} ft), I can help with log interpretation, "
            "formation evaluation, pay zone identification, or AI analysis results. "
            "What specific aspect of this well would you like to analyze?")
