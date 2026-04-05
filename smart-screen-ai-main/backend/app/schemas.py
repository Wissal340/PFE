from datetime import datetime
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