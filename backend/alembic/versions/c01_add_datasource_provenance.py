"""c01_add_datasource_provenance

Revision ID: c01_datasource
Revises: bdd08d1a3d55
Create Date: 2026-10-26 10:00:00.000000

Adds data_source and ingestion_timestamp to alerts table.
Enforces data source isolation between synthetic demo data, live Wazuh telemetry,
and dataset replay.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'c01_datasource'
down_revision: Union[str, Sequence[str], None] = 'bdd08d1a3d55'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add data_source and ingestion_timestamp columns with safe default
    op.add_column(
        'alerts',
        sa.Column('data_source', sa.String(), server_default='demo', nullable=True)
    )
    op.add_column(
        'alerts',
        sa.Column('ingestion_timestamp', sa.String(), nullable=True)
    )
    op.create_index(op.f('ix_alerts_data_source'), 'alerts', ['data_source'], unique=False)

    # Backfill any existing records to 'demo' if NULL
    op.execute("UPDATE alerts SET data_source = 'demo' WHERE data_source IS NULL")


def downgrade() -> None:
    op.drop_index(op.f('ix_alerts_data_source'), table_name='alerts')
    op.drop_column('alerts', 'ingestion_timestamp')
    op.drop_column('alerts', 'data_source')
