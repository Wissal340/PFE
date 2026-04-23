from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr


class DeviceCreate(BaseModel):
    name: str
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class DeviceRegisterResponse(BaseModel):
    id: UUID
    api_key: str


class DeviceOut(BaseModel):
    id: UUID
    name: str
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    status: str
    last_seen: datetime | None = None

    class Config:
        from_attributes = True


class MetricIn(BaseModel):
    cpu: float
    memory: float
    temperature: float | None = None
    vlc_running: bool = True


class MetricOut(BaseModel):
    id: int
    device_id: UUID
    cpu: float
    ram: float
    temp: float | None = None
    vlc_running: bool
    timestamp: datetime

    class Config:
        from_attributes = True


class AlertOut(BaseModel):
    id: int
    device_id: UUID
    type: str
    message: str
    value: float | None = None
    threshold: float | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: str = "viewer"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: str
    is_active: bool
    created_at: datetime
    is_approved: bool
    approved_at: datetime | None = None
    approved_by: int | None = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class DeviceUpdate(BaseModel):
    name: str | None = None
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    status: str | None = None


class AiPredictionOut(BaseModel):
    id: int
    device_id: UUID
    cpu: float
    ram: float
    temp: float
    vlc_running: bool
    anomaly_score: float
    prediction: str
    reason: str
    created_at: datetime

    class Config:
        from_attributes = True


class PlaylistItemCreate(BaseModel):
    title: str | None = None
    media_url: str
    media_type: Literal["image", "video"]
    duration_seconds: int = 15
    start_date: str | None = None
    end_date: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    is_active: bool = True


class PlaylistItemUpdate(BaseModel):
    title: str | None = None
    media_url: str | None = None
    media_type: Literal["image", "video"] | None = None
    duration_seconds: int | None = None
    start_date: str | None = None
    end_date: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    is_active: bool | None = None


class PlaylistItemOut(BaseModel):
    id: int
    playlist_id: int
    title: str | None = None
    media_url: str
    media_type: str
    duration_seconds: int
    start_date: str | None = None
    end_date: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    order_index: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PlaylistOut(BaseModel):
    id: int
    device_id: UUID
    name: str
    created_at: datetime
    items: list[PlaylistItemOut] = []

    class Config:
        from_attributes = True


class PlaylistReorderIn(BaseModel):
    item_ids: list[int]


class ScreenCaptureOut(BaseModel):
    id: int
    device_id: UUID
    image_path: str
    image_url: str
    visual_status: str
    visual_reason: str | None = None
    compliance_status: str
    compliance_reason: str | None = None
    similarity_score: float | None = None
    expected_media_type: str | None = None
    expected_media_title: str | None = None
    expected_media_url: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True