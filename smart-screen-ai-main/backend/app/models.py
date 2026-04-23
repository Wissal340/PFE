import uuid
from sqlalchemy import Column, String, Integer, DateTime, Boolean, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db import Base


class Device(Base):
    __tablename__ = "devices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    location = Column(String, nullable=True)
    api_key = Column(String, nullable=False, unique=True)
    status = Column(String, nullable=False, default="offline")
    last_seen = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    captures = relationship("ScreenCapture", cascade="all, delete-orphan")
    metrics = relationship("Metric", back_populates="device", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="device", cascade="all, delete-orphan")
    playlist = relationship("Playlist", back_populates="device", uselist=False, cascade="all, delete-orphan")
    ai_predictions = relationship("AiPrediction", back_populates="device", cascade="all, delete-orphan")


class Metric(Base):
    __tablename__ = "metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id"), nullable=False)

    cpu = Column(Float, nullable=True)
    ram = Column(Float, nullable=True)
    temp = Column(Float, nullable=True)
    vlc_running = Column(Boolean, nullable=True)

    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    device = relationship("Device", back_populates="metrics")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id"), nullable=False)

    type = Column(String, nullable=False)
    message = Column(String, nullable=False)
    value = Column(Float, nullable=True)
    threshold = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    device = relationship("Device", back_populates="alerts")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False, default="viewer")
    is_active = Column(Boolean, nullable=False, default=True)
    is_approved = Column(Boolean, default=False)
    approved_at = Column(DateTime, nullable=True)
    approved_by = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ViewerDeviceAccess(Base):
    __tablename__ = "viewer_device_access"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User")
    device = relationship("Device")


class AiPrediction(Base):
    __tablename__ = "ai_predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id"), nullable=False)

    cpu = Column(Float, nullable=False)
    ram = Column(Float, nullable=False)
    temp = Column(Float, nullable=False)
    vlc_running = Column(Boolean, nullable=False)

    anomaly_score = Column(Float, nullable=False, default=0)
    prediction = Column(String, nullable=False, default="unknown")
    reason = Column(String, nullable=False, default="AI unavailable")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    device = relationship("Device", back_populates="ai_predictions")


class Playlist(Base):
    __tablename__ = "playlists"

    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id"), nullable=False, unique=True)
    name = Column(String, nullable=False, default="Default Playlist")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    device = relationship("Device", back_populates="playlist")
    items = relationship(
        "PlaylistItem",
        back_populates="playlist",
        cascade="all, delete-orphan",
        order_by="PlaylistItem.order_index.asc()",
    )


class PlaylistItem(Base):
    __tablename__ = "playlist_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    playlist_id = Column(Integer, ForeignKey("playlists.id"), nullable=False)

    title = Column(String, nullable=True)
    media_url = Column(String, nullable=False)
    media_type = Column(String, nullable=False)
    duration_seconds = Column(Integer, nullable=False, default=15)

    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)
    start_time = Column(String, nullable=True)
    end_time = Column(String, nullable=True)

    order_index = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    playlist = relationship("Playlist", back_populates="items")

class ScreenCapture(Base):
    __tablename__ = "screen_captures"

    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id"), nullable=False)

    image_path = Column(String, nullable=False)
    image_url = Column(String, nullable=False)

    visual_status = Column(String, nullable=False, default="unknown")
    visual_reason = Column(String, nullable=True)

    compliance_status = Column(String, nullable=False, default="unknown")
    compliance_reason = Column(String, nullable=True)
    similarity_score = Column(Float, nullable=True)

    expected_media_type = Column(String, nullable=True)
    expected_media_title = Column(String, nullable=True)
    expected_media_url = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    device = relationship("Device")