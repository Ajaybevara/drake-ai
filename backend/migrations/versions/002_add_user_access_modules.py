"""add user access modules

Revision ID: 002_add_user_access_modules
Revises: 001_initial
Create Date: 2026-07-07 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "002_add_user_access_modules"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("access_modules", sa.JSON(), nullable=True, server_default=sa.text("'[]'")),
    )


def downgrade() -> None:
    op.drop_column("users", "access_modules")
