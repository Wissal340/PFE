"""playlist studio upgrade

Revision ID: 20260410_playlist_studio_upgrade
Revises: 20260410_add_playlists_tables
Create Date: 2026-04-10
"""

from alembic import op
import sqlalchemy as sa


revision = "20260410_playlist_studio_upgrade"
down_revision = "20260410_add_playlists_tables"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("playlist_items", sa.Column("start_date", sa.String(), nullable=True))
    op.add_column("playlist_items", sa.Column("end_date", sa.String(), nullable=True))
    op.add_column("playlist_items", sa.Column("start_time", sa.String(), nullable=True))
    op.add_column("playlist_items", sa.Column("end_time", sa.String(), nullable=True))
    op.add_column("playlist_items", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))

    op.alter_column(
        "playlist_items",
        "duration_seconds",
        existing_type=sa.Integer(),
        nullable=False,
        server_default="15",
    )


def downgrade():
    op.drop_column("playlist_items", "is_active")
    op.drop_column("playlist_items", "end_time")
    op.drop_column("playlist_items", "start_time")
    op.drop_column("playlist_items", "end_date")
    op.drop_column("playlist_items", "start_date")