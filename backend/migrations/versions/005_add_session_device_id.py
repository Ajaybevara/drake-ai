"""add persistent device id to user sessions

Revision ID: 005_add_session_device_id
Revises: 004_add_user_sessions
Create Date: 2026-07-23 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "005_add_session_device_id"
down_revision = "004_add_user_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_sessions", sa.Column("device_id", sa.String(length=128), nullable=True))
    op.create_index(op.f("ix_user_sessions_device_id"), "user_sessions", ["device_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_sessions_device_id"), table_name="user_sessions")
    op.drop_column("user_sessions", "device_id")
