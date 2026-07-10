"""add user activity tracking

Revision ID: 003_add_user_activity
Revises: 002_add_user_access_modules
Create Date: 2026-07-10 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "003_add_user_activity"
down_revision = "002_add_user_access_modules"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_activities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(length=40), nullable=False),
        sa.Column("ip_address", sa.String(length=80), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_user_activities_id"), "user_activities", ["id"], unique=False)
    op.create_index(op.f("ix_user_activities_user_id"), "user_activities", ["user_id"], unique=False)
    op.create_index(op.f("ix_user_activities_created_at"), "user_activities", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_activities_created_at"), table_name="user_activities")
    op.drop_index(op.f("ix_user_activities_user_id"), table_name="user_activities")
    op.drop_index(op.f("ix_user_activities_id"), table_name="user_activities")
    op.drop_table("user_activities")
