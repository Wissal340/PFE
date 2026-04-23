"""add playlists tables

Revision ID: 20260410_add_playlists_tables
Revises: add_lat_lng_to_devices
Create Date: 2026-04-10
"""

from alembic import op
import sqlalchemy as sa


revision = "20260410_add_playlists_tables"
down_revision = "add_lat_lng_to_devices"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "playlists",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("device_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(), nullable=False, server_default="Default Playlist"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"]),
        sa.UniqueConstraint("device_id"),
    )

    op.create_table(
        "playlist_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("playlist_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("media_url", sa.String(), nullable=False),
        sa.Column("media_type", sa.String(), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["playlist_id"], ["playlists.id"]),
    )


def downgrade():
    op.drop_table("playlist_items")
    op.drop_table("playlists")