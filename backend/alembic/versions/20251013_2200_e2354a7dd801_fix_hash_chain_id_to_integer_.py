"""fix_hash_chain_id_to_integer_autoincrement

Revision ID: e2354a7dd801
Revises: 9768ea688112
Create Date: 2025-10-13 22:00:33.214732

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2354a7dd801'
down_revision: Union[str, None] = '9768ea688112'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1: Drop existing primary key constraint
    op.execute('ALTER TABLE hash_chain DROP CONSTRAINT hash_chain_pkey')

    # Step 2: Change column type from VARCHAR(50) to INTEGER
    # First, we need to convert any existing data (if table is empty, this is safe)
    op.execute('ALTER TABLE hash_chain ALTER COLUMN chain_id TYPE INTEGER USING NULL')

    # Step 3: Create sequence for autoincrement
    op.execute('CREATE SEQUENCE hash_chain_chain_id_seq')

    # Step 4: Set sequence as default and assign ownership
    op.execute("ALTER TABLE hash_chain ALTER COLUMN chain_id SET DEFAULT nextval('hash_chain_chain_id_seq')")
    op.execute('ALTER SEQUENCE hash_chain_chain_id_seq OWNED BY hash_chain.chain_id')

    # Step 5: Re-add primary key constraint
    op.execute('ALTER TABLE hash_chain ADD PRIMARY KEY (chain_id)')


def downgrade() -> None:
    # Step 1: Drop primary key constraint
    op.execute('ALTER TABLE hash_chain DROP CONSTRAINT hash_chain_pkey')

    # Step 2: Remove default and drop sequence
    op.execute('ALTER TABLE hash_chain ALTER COLUMN chain_id DROP DEFAULT')
    op.execute('DROP SEQUENCE IF EXISTS hash_chain_chain_id_seq')

    # Step 3: Change column type back to VARCHAR(50)
    op.execute('ALTER TABLE hash_chain ALTER COLUMN chain_id TYPE VARCHAR(50)')

    # Step 4: Re-add primary key constraint
    op.execute('ALTER TABLE hash_chain ADD PRIMARY KEY (chain_id)')
