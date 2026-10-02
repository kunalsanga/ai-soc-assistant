"""initial_schema

Revision ID: bdd08d1a3d55
Revises: 
Create Date: 2026-10-02 13:59:33.202347

Creates the four core tables for the SOC Assistant:
  - alerts       (Alert model)
  - analyses     (Analysis model, FK → alerts)
  - evidence     (Evidence model, FK → analyses)
  - feedback     (Feedback model, FK → analyses)

Column types match the SQLAlchemy models in app/db/models/alert.py exactly.
No columns have been added, removed, or type-changed; this is a faithful
translation of the existing ORM definitions.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'bdd08d1a3d55'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all tables from scratch (initial schema)."""

    # ------------------------------------------------------------------
    # alerts
    # ------------------------------------------------------------------
    op.create_table(
        'alerts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('external_alert_id', sa.String(), nullable=True),
        sa.Column('timestamp', sa.String(), nullable=True),
        sa.Column('severity', sa.Integer(), nullable=True),
        sa.Column('rule_id', sa.String(), nullable=True),
        sa.Column('rule_description', sa.String(), nullable=True),
        sa.Column('agent_name', sa.String(), nullable=True),
        sa.Column('source_ip', sa.String(), nullable=True),
        sa.Column('destination_ip', sa.String(), nullable=True),
        sa.Column('username', sa.String(), nullable=True),
        sa.Column('raw_data', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_alerts_id'), 'alerts', ['id'], unique=False)
    op.create_index(
        op.f('ix_alerts_external_alert_id'),
        'alerts',
        ['external_alert_id'],
        unique=True,
    )

    # ------------------------------------------------------------------
    # analyses
    # ------------------------------------------------------------------
    op.create_table(
        'analyses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('alert_id', sa.Integer(), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('severity_assessment', sa.String(), nullable=True),
        sa.Column('explanation', sa.Text(), nullable=True),
        sa.Column('recommended_investigation', sa.Text(), nullable=True),
        sa.Column('confidence', sa.String(), nullable=True),
        sa.Column('model_name', sa.String(), nullable=True),
        sa.Column('analysis_type', sa.String(), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(['alert_id'], ['alerts.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_analyses_id'), 'analyses', ['id'], unique=False)

    # ------------------------------------------------------------------
    # evidence
    # ------------------------------------------------------------------
    op.create_table(
        'evidence',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('analysis_id', sa.Integer(), nullable=True),
        sa.Column('source', sa.String(), nullable=True),
        sa.Column('document_id', sa.String(), nullable=True),
        sa.Column('title', sa.String(), nullable=True),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('relevance_score', sa.Float(), nullable=True),
        sa.Column('citation', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['analysis_id'], ['analyses.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_evidence_id'), 'evidence', ['id'], unique=False)

    # ------------------------------------------------------------------
    # feedback
    # ------------------------------------------------------------------
    op.create_table(
        'feedback',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('analysis_id', sa.Integer(), nullable=True),
        sa.Column('rating', sa.Integer(), nullable=True),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(['analysis_id'], ['analyses.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_feedback_id'), 'feedback', ['id'], unique=False)


def downgrade() -> None:
    """Drop all tables in reverse dependency order."""
    op.drop_index(op.f('ix_feedback_id'), table_name='feedback')
    op.drop_table('feedback')

    op.drop_index(op.f('ix_evidence_id'), table_name='evidence')
    op.drop_table('evidence')

    op.drop_index(op.f('ix_analyses_id'), table_name='analyses')
    op.drop_table('analyses')

    op.drop_index(op.f('ix_alerts_external_alert_id'), table_name='alerts')
    op.drop_index(op.f('ix_alerts_id'), table_name='alerts')
    op.drop_table('alerts')
