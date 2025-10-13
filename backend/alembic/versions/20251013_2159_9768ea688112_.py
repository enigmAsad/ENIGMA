"""│

Revision ID: 9768ea688112
Revises: 3593d09278ec
Create Date: 2025-10-13 21:59:28.760287

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9768ea688112'
down_revision: Union[str, None] = '3593d09278ec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
