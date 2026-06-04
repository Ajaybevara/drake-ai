"""create all tables

Revision ID: 001_initial
Revises:
Create Date: 2024-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # users
    op.create_table('users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(255), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('role', sa.String(50), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('avatar_initials', sa.String(4), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_index('ix_users_id', 'users', ['id'])

    # projects
    op.create_table('projects',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('field_name', sa.String(255), nullable=True),
        sa.Column('basin', sa.String(255), nullable=True),
        sa.Column('country', sa.String(100), nullable=True),
        sa.Column('operator', sa.String(255), nullable=True),
        sa.Column('owner_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_projects_id', 'projects', ['id'])

    # wells
    op.create_table('wells',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('api_number', sa.String(50), nullable=True),
        sa.Column('operator', sa.String(255), nullable=True),
        sa.Column('field', sa.String(255), nullable=True),
        sa.Column('county', sa.String(255), nullable=True),
        sa.Column('state', sa.String(100), nullable=True),
        sa.Column('country', sa.String(100), nullable=True, default='USA'),
        sa.Column('kb_elevation', sa.Float(), nullable=True),
        sa.Column('total_depth', sa.Float(), nullable=True),
        sa.Column('top_depth', sa.Float(), nullable=True),
        sa.Column('base_depth', sa.Float(), nullable=True),
        sa.Column('depth_uom', sa.String(10), nullable=True, default='ft'),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('status', sa.String(50), nullable=True, default='Active'),
        sa.Column('uwi', sa.String(100), nullable=True),
        sa.Column('spud_date', sa.String(20), nullable=True),
        sa.Column('completion_date', sa.String(20), nullable=True),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_wells_id', 'wells', ['id'])

    # well_files
    op.create_table('well_files',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('well_id', sa.Integer(), sa.ForeignKey('wells.id'), nullable=False),
        sa.Column('filename', sa.String(500), nullable=False),
        sa.Column('original_name', sa.String(500), nullable=True),
        sa.Column('file_type', sa.String(20), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('storage_path', sa.String(1000), nullable=True),
        sa.Column('is_processed', sa.Boolean(), nullable=True, default=False),
        sa.Column('curve_count', sa.Integer(), nullable=True, default=0),
        sa.Column('depth_start', sa.Float(), nullable=True),
        sa.Column('depth_end', sa.Float(), nullable=True),
        sa.Column('depth_step', sa.Float(), nullable=True),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_well_files_id', 'well_files', ['id'])

    # curves
    op.create_table('curves',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('well_id', sa.Integer(), sa.ForeignKey('wells.id'), nullable=False),
        sa.Column('mnemonic', sa.String(50), nullable=False),
        sa.Column('unit', sa.String(30), nullable=True),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('data', sa.JSON(), nullable=True),
        sa.Column('min_value', sa.Float(), nullable=True),
        sa.Column('max_value', sa.Float(), nullable=True),
        sa.Column('mean_value', sa.Float(), nullable=True),
        sa.Column('null_count', sa.Integer(), nullable=True, default=0),
        sa.Column('is_predicted', sa.Boolean(), nullable=True, default=False),
        sa.Column('source_file_id', sa.Integer(), sa.ForeignKey('well_files.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_curves_id', 'curves', ['id'])

    # formation_tops
    op.create_table('formation_tops',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('well_id', sa.Integer(), sa.ForeignKey('wells.id'), nullable=False),
        sa.Column('formation_name', sa.String(255), nullable=False),
        sa.Column('tvd_ft', sa.Float(), nullable=True),
        sa.Column('md_ft', sa.Float(), nullable=True),
        sa.Column('is_ai_detected', sa.Boolean(), nullable=True, default=False),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('color_hex', sa.String(10), nullable=True, default='#64748B'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_formation_tops_id', 'formation_tops', ['id'])

    # ai_jobs
    op.create_table('ai_jobs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('well_id', sa.Integer(), sa.ForeignKey('wells.id'), nullable=False),
        sa.Column('job_type', sa.String(50), nullable=False),
        sa.Column('status', sa.String(20), nullable=True, default='pending'),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('progress', sa.Float(), nullable=True, default=0.0),
        sa.Column('accuracy', sa.Float(), nullable=True),
        sa.Column('confidence', sa.String(20), nullable=True),
        sa.Column('model_name', sa.String(100), nullable=True),
        sa.Column('parameters', sa.JSON(), nullable=True),
        sa.Column('result', sa.JSON(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('predicted_curves', sa.JSON(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_ai_jobs_id', 'ai_jobs', ['id'])

    # reports
    op.create_table('reports',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('well_id', sa.Integer(), sa.ForeignKey('wells.id'), nullable=False),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('report_type', sa.String(50), nullable=True),
        sa.Column('file_path', sa.String(1000), nullable=True),
        sa.Column('format', sa.String(10), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_reports_id', 'reports', ['id'])


def downgrade() -> None:
    op.drop_table('reports')
    op.drop_table('ai_jobs')
    op.drop_table('formation_tops')
    op.drop_table('curves')
    op.drop_table('well_files')
    op.drop_table('wells')
    op.drop_table('projects')
    op.drop_table('users')
