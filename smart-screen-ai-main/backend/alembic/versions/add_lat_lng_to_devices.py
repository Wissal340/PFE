"""add latitude and longitude to devices

Revision ID: add_lat_lng_to_devices
Revises: xxxx_add_users_table
Create Date: 2026-03-25
"""

from alembic import op
import sqlalchemy as sa


revision = "add_lat_lng_to_devices"
down_revision = "xxxx_add_users_table"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("devices", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("devices", sa.Column("longitude", sa.Float(), nullable=True))


def downgrade():
    op.drop_column("devices", "longitude")
    op.drop_column("devices", "latitude")