"""add interview start tracking and COI fields

Revision ID: a7b8c9d1e2f3
Revises: 43ce10edf815
Create Date: 2025-10-21 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a7b8c9d1e2f3'
down_revision = '43ce10edf815'
branch_labels = None
depends_on = None


def upgrade():
    """Add interview start tracking and COI acceptance fields."""
    # Add new columns to interviews table
    op.add_column('interviews', sa.Column('started_at', sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column('interviews', sa.Column('coi_accepted_at', sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column('interviews', sa.Column('coi_accepted_by', sa.String(50), nullable=True))

    # Add foreign key constraint for coi_accepted_by
    op.create_foreign_key(
        'fk_interviews_coi_accepted_by_admin',
        'interviews',
        'admin_users',
        ['coi_accepted_by'],
        ['admin_id']
    )

    # Add index on started_at for efficient querying
    op.create_index('idx_interview_started_at', 'interviews', ['started_at'])


def downgrade():
    """Remove interview start tracking and COI acceptance fields."""
    # Drop index
    op.drop_index('idx_interview_started_at', table_name='interviews')

    # Drop foreign key constraint
    op.drop_constraint('fk_interviews_coi_accepted_by_admin', 'interviews', type_='foreignkey')

    # Drop columns
    op.drop_column('interviews', 'coi_accepted_by')
    op.drop_column('interviews', 'coi_accepted_at')
    op.drop_column('interviews', 'started_at')
