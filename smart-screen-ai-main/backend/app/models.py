import uuid
from sqlalchemy import Column, String, Integer, DateTime, Boolean, Float
from sqlalchemy.dialects.postgresql import UUID
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

from sqlalchemy import Integer, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship

class Metric(Base):
    __tablename__ = "metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id"), nullable=False)

    cpu = Column(Float, nullable=True)
    ram = Column(Float, nullable=True)
    temp = Column(Float, nullable=True)
    vlc_running = Column(Boolean, nullable=True)

    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

Device.metrics = relationship("Metric", backref="device", cascade="all, delete-orphan")

from sqlalchemy import String

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id"), nullable=False)

    type = Column(String, nullable=False)  # CPU, TEMP, VLC, OFFLINE
    message = Column(String, nullable=False)

    value = Column(Float, nullable=True)
    threshold = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
from sqlalchemy import Text


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True, index=True)
    hashed_password = Column(Text, nullable=False)
    role = Column(String, nullable=False, default="viewer")  # admin, technicien, viewer
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)