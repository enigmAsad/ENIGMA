"""add shortlisted status

Revision ID: 0c5810f251cb
Revises: 96eed8915a45
Create Date: 2025-10-19 12:41:58.110248

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0c5810f251cb'
down_revision: Union[str, None] = '96eed8915a45'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE applicationstatusenum ADD VALUE 'SHORTLISTED'")


def downgrade() -> None:
    # Downgrading requires removing the 'shortlisted' value from the enum.
    # This is a complex operation that requires ensuring no data uses this value anymore.
    # For simplicity, this downgrade path is left empty.
    # In a production environment, a data migration would be necessary before this change.
    pass