import json
import secrets
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID
from pydantic import BaseModel
from fastapi import UploadFile, File
import os

import requests
from fastapi import (
    Depends,
    FastAPI,
    File,
    Header,
    HTTPException,
    Query,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import (
    AiPrediction,
    Alert,
    Device,
    Metric,
    Playlist,
    PlaylistItem,
    User,
    ViewerDeviceAccess,
    ScreenCapture,
)
from app.schemas import (
    AiPredictionOut,
    AlertOut,
    DeviceCreate,
    DeviceOut,
    DeviceRegisterResponse,
    DeviceUpdate,
    MetricIn,
    MetricOut,
    PlaylistItemCreate,
    PlaylistItemUpdate,
    PlaylistOut,
    PlaylistReorderIn,
    Token,
    UserCreate,
    UserLogin,
    UserOut,
    ScreenCaptureOut,
)
from app.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

app = FastAPI(title="Smart Screen AI Pro API")

AI_SERVICE_URL = "http://ai_service:8001"

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


def resolve_expected_media_path(media_url: str | None) -> str | None:
    if not media_url:
        return None

    uploads_prefix = "http://localhost:8000/uploads/"

    if media_url.startswith(uploads_prefix):
        filename = media_url.replace(uploads_prefix, "")
        path = UPLOAD_DIR / filename
        return str(path) if path.exists() else None

    if media_url.startswith("/uploads/"):
        filename = media_url.replace("/uploads/", "")
        path = UPLOAD_DIR / filename
        return str(path) if path.exists() else None

    return None


def call_visual_ai_service(
    current_path: str,
    previous_path: str | None = None,
    media_type: str = "video",
):
    try:
        with open(current_path, "rb") as current_file:
            files = {"file": ("current.jpg", current_file, "image/jpeg")}
            data = {"media_type": media_type}

            previous_file_handle = None

            if previous_path:
                previous_file_handle = open(previous_path, "rb")
                files["previous_file"] = (
                    "previous.jpg",
                    previous_file_handle,
                    "image/jpeg",
                )

            try:
                response = requests.post(
                    f"{AI_SERVICE_URL}/detect/visual",
                    files=files,
                    data=data,
                    timeout=8,
                )
            finally:
                if previous_file_handle:
                    previous_file_handle.close()

        if response.status_code == 200:
            return response.json()

        print("Visual AI bad response:", response.status_code, response.text)
    except Exception as e:
        print("Visual AI service error:", e)

    return {
        "anomaly_status": "unknown",
        "reason": "Visual AI unavailable",
        "brightness_score": 0,
        "uniformity_score": 0,
        "freeze_score": 0,
        "similarity_score": 0,
    }


def call_compliance_ai_service(
    current_path: str,
    expected_path: str,
    media_type: str = "image",
):
    try:
        with open(current_path, "rb") as current_file, open(expected_path, "rb") as expected_file:
            files = {
                "file": ("current.jpg", current_file, "image/jpeg"),
                "expected_file": ("expected.jpg", expected_file, "image/jpeg"),
            }
            data = {"media_type": media_type}

            response = requests.post(
                f"{AI_SERVICE_URL}/check/compliance",
                files=files,
                data=data,
                timeout=10,
            )

        if response.status_code == 200:
            return response.json()

        print("Compliance AI bad response:", response.status_code, response.text)
    except Exception as e:
        print("Compliance AI service error:", e)

    return {
        "compliance_status": "unknown",
        "similarity_score": 0,
        "reason": "Compliance AI unavailable",
    }


def _time_to_minutes(value: str | None) -> int | None:
    if not value:
        return None

    try:
        hour, minute = value.split(":")[:2]
        return int(hour) * 60 + int(minute)
    except Exception:
        return None


def get_active_playlist_item(db: Session, device_id: UUID) -> PlaylistItem | None:
    playlist = db.query(Playlist).filter(Playlist.device_id == device_id).first()
    if not playlist:
        return None

    items = (
        db.query(PlaylistItem)
        .filter(
            PlaylistItem.playlist_id == playlist.id,
            PlaylistItem.is_active == True,
        )
        .order_by(PlaylistItem.order_index.asc())
        .all()
    )

    if not items:
        return None

    now = datetime.now()
    today = now.date().isoformat()
    current_minutes = now.hour * 60 + now.minute

    for item in items:
        if item.start_date and today < item.start_date:
            continue

        if item.end_date and today > item.end_date:
            continue

        start_minutes = _time_to_minutes(item.start_time)
        end_minutes = _time_to_minutes(item.end_time)

        if start_minutes is not None and current_minutes < start_minutes:
            continue

        if end_minutes is not None and current_minutes > end_minutes:
            continue

        return item

    return None




def call_ai_service(cpu: float, ram: float, temp: float, vlc_running: bool):
    try:
        response = requests.post(
            f"{AI_SERVICE_URL}/predict/anomaly",
            json={
                "cpu": cpu,
                "ram": ram,
                "temp": temp,
                "vlc_running": vlc_running,
            },
            timeout=2,
        )

        if response.status_code == 200:
            return response.json()
    except Exception as e:
        print("AI service error:", e)

    return {
        "anomaly_score": 0,
        "prediction": "unknown",
        "reason": "AI unavailable",
    }


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        disconnected = []

        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except Exception:
                disconnected.append(connection)

        for connection in disconnected:
            self.disconnect(connection)


manager = ConnectionManager()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    token = credentials.credentials

    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Inactive user")

    return user


def require_roles(*roles: str):
    def checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user

    return checker


def get_or_create_playlist(db: Session, device_id: UUID) -> Playlist:
    playlist = db.query(Playlist).filter(Playlist.device_id == device_id).first()
    if playlist:
        return playlist

    playlist = Playlist(device_id=device_id, name="Default Playlist")
    db.add(playlist)
    db.commit()
    db.refresh(playlist)
    return playlist


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/upload-media")
async def upload_media(
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles("admin", "technicien")),
):
    allowed_types = {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/jpg",
        "video/mp4",
        "video/webm",
        "video/ogg",
        "video/quicktime",
    }

    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    extension = Path(file.filename).suffix.lower()
    safe_name = f"{secrets.token_hex(16)}{extension}"
    file_path = UPLOAD_DIR / safe_name

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    media_type = "image" if file.content_type.startswith("image/") else "video"

    return {
        "filename": safe_name,
        "url": f"http://localhost:8000/uploads/{safe_name}",
        "media_type": media_type,
    }


@app.post("/devices/register", response_model=DeviceRegisterResponse)
def register_device(
    payload: DeviceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "technicien")),
):
    api_key = secrets.token_urlsafe(32)

    device = Device(
        name=payload.name,
        location=payload.location,
        latitude=payload.latitude,
        longitude=payload.longitude,
        api_key=api_key,
        status="offline",
    )

    db.add(device)
    db.commit()
    db.refresh(device)

    return {"id": device.id, "api_key": device.api_key}


@app.get("/devices", response_model=list[DeviceOut])
def list_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "viewer":
        accesses = db.query(ViewerDeviceAccess).filter(
            ViewerDeviceAccess.user_id == current_user.id
        ).all()

        device_ids = [a.device_id for a in accesses]

        if not device_ids:
            return []

        return db.query(Device).filter(Device.id.in_(device_ids)).all()

    return db.query(Device).order_by(Device.created_at.desc()).all()


@app.get("/devices/{device_id}", response_model=DeviceOut)
def get_device(
    device_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    if current_user.role == "viewer":
        access = db.query(ViewerDeviceAccess).filter(
            ViewerDeviceAccess.user_id == current_user.id,
            ViewerDeviceAccess.device_id == device_id,
        ).first()

        if not access:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    return device


@app.put("/devices/{device_id}", response_model=DeviceOut)
def update_device(
    device_id: UUID,
    payload: DeviceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "technicien")),
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    if payload.name is not None:
        device.name = payload.name
    if payload.location is not None:
        device.location = payload.location
    if payload.latitude is not None:
        device.latitude = payload.latitude
    if payload.longitude is not None:
        device.longitude = payload.longitude
    if payload.status is not None:
        device.status = payload.status

    db.commit()
    db.refresh(device)
    return device


@app.delete("/devices/{device_id}")
def delete_device(
    device_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    db.delete(device)
    db.commit()

    return {"message": "Device deleted successfully"}


@app.post("/devices/{device_id}/heartbeat", response_model=DeviceOut)
def heartbeat(
    device_id: UUID,
    x_api_key: str = Header(default=""),
    db: Session = Depends(get_db),
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if device.api_key != x_api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    device.status = "online"
    device.last_seen = datetime.now(timezone.utc)
    db.commit()
    db.refresh(device)
    return device


@app.post("/devices/{device_id}/metrics", response_model=MetricOut)
async def push_metrics(
    device_id: UUID,
    payload: MetricIn,
    x_api_key: str = Header(default=""),
    db: Session = Depends(get_db),
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if device.api_key != x_api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    m = Metric(
        device_id=device.id,
        cpu=payload.cpu,
        ram=payload.memory,
        temp=payload.temperature,
        vlc_running=payload.vlc_running,
    )
    db.add(m)

    device.status = "online"
    device.last_seen = datetime.now(timezone.utc)

    ai_result = call_ai_service(
        cpu=payload.cpu,
        ram=payload.memory,
        temp=payload.temperature if payload.temperature is not None else 0,
        vlc_running=payload.vlc_running,
    )

    ai_prediction = AiPrediction(
        device_id=device.id,
        cpu=payload.cpu,
        ram=payload.memory,
        temp=payload.temperature if payload.temperature is not None else 0,
        vlc_running=payload.vlc_running,
        anomaly_score=float(ai_result.get("anomaly_score", 0)),
        prediction=str(ai_result.get("prediction", "unknown")),
        reason=str(ai_result.get("reason", "AI unavailable")),
    )
    db.add(ai_prediction)

    db.commit()
    db.refresh(m)
    db.refresh(device)
    db.refresh(ai_prediction)

    await manager.broadcast(
        {
            "type": "metric_created",
            "payload": {
                "id": m.id,
                "device_id": str(m.device_id),
                "cpu": m.cpu,
                "ram": m.ram,
                "temp": m.temp,
                "vlc_running": m.vlc_running,
                "timestamp": m.timestamp.isoformat() if m.timestamp else None,
                "ai": {
                    "anomaly_score": ai_prediction.anomaly_score,
                    "prediction": ai_prediction.prediction,
                    "reason": ai_prediction.reason,
                    "created_at": ai_prediction.created_at.isoformat()
                    if ai_prediction.created_at
                    else None,
                },
            },
        }
    )

    alerts: list[Alert] = []

    if payload.cpu is not None and payload.cpu > 85:
        alerts.append(
            Alert(
                device_id=device.id,
                type="CPU",
                message="CPU usage too high",
                value=payload.cpu,
                threshold=85,
            )
        )

    if payload.temperature is not None and payload.temperature > 70:
        alerts.append(
            Alert(
                device_id=device.id,
                type="TEMP",
                message="Temperature too high",
                value=payload.temperature,
                threshold=70,
            )
        )

    if payload.vlc_running is False:
        alerts.append(
            Alert(
                device_id=device.id,
                type="VLC",
                message="VLC is not running",
                value=0,
                threshold=1,
            )
        )

    if ai_prediction.prediction == "critical":
        alerts.append(
            Alert(
                device_id=device.id,
                type="AI",
                message=f"AI detected critical anomaly: {ai_prediction.reason}",
                value=ai_prediction.anomaly_score,
                threshold=0.75,
            )
        )

    if alerts:
        for alert in alerts:
            db.add(alert)
        db.commit()

        for alert in alerts:
            db.refresh(alert)
            await manager.broadcast(
                {
                    "type": "alert_created",
                    "payload": {
                        "id": alert.id,
                        "device_id": str(alert.device_id),
                        "device_name": device.name,
                        "device_location": device.location,
                        "type": alert.type,
                        "message": alert.message,
                        "value": alert.value,
                        "threshold": alert.threshold,
                        "created_at": alert.created_at.isoformat()
                        if alert.created_at
                        else None,
                    },
                }
            )

    return m


@app.get("/devices/{device_id}/metrics", response_model=list[MetricOut])
def get_metrics(
    device_id: UUID,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    return (
        db.query(Metric)
        .filter(Metric.device_id == device_id)
        .order_by(Metric.timestamp.desc())
        .limit(limit)
        .all()
    )


@app.get("/devices/{device_id}/metrics/latest", response_model=MetricOut)
def get_latest_metric(device_id: UUID, db: Session = Depends(get_db)):
    m = (
        db.query(Metric)
        .filter(Metric.device_id == device_id)
        .order_by(Metric.timestamp.desc())
        .first()
    )
    if not m:
        raise HTTPException(status_code=404, detail="No metrics found")
    return m


@app.get("/alerts", response_model=list[AlertOut])
def list_alerts(
    device_id: UUID | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Alert)
    if device_id:
        q = q.filter(Alert.device_id == device_id)
    return q.order_by(Alert.created_at.desc()).all()


@app.get("/devices/{device_id}/playlist", response_model=PlaylistOut)
def get_playlist(
    device_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    if current_user.role == "viewer":
        access = db.query(ViewerDeviceAccess).filter(
            ViewerDeviceAccess.user_id == current_user.id,
            ViewerDeviceAccess.device_id == device_id,
        ).first()

        if not access:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    playlist = get_or_create_playlist(db, device_id)
    db.refresh(playlist)
    return playlist


@app.post("/devices/{device_id}/playlist/items", response_model=PlaylistOut)
def add_playlist_item(
    device_id: UUID,
    payload: PlaylistItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "technicien")),
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    playlist = get_or_create_playlist(db, device_id)

    last_item = (
        db.query(PlaylistItem)
        .filter(PlaylistItem.playlist_id == playlist.id)
        .order_by(PlaylistItem.order_index.desc())
        .first()
    )
    next_index = (last_item.order_index + 1) if last_item else 0

    item = PlaylistItem(
        playlist_id=playlist.id,
        title=payload.title,
        media_url=payload.media_url,
        media_type=payload.media_type,
        duration_seconds=payload.duration_seconds,
        start_date=payload.start_date,
        end_date=payload.end_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        is_active=payload.is_active,
        order_index=next_index,
    )
    db.add(item)
    db.commit()
    db.refresh(playlist)
    return playlist


@app.put("/playlist/items/{item_id}", response_model=PlaylistOut)
def update_playlist_item(
    item_id: int,
    payload: PlaylistItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "technicien")),
):
    item = db.query(PlaylistItem).filter(PlaylistItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Playlist item not found")

    if payload.title is not None:
        item.title = payload.title
    if payload.media_url is not None:
        item.media_url = payload.media_url
    if payload.media_type is not None:
        item.media_type = payload.media_type
    if payload.duration_seconds is not None:
        item.duration_seconds = payload.duration_seconds
    if payload.start_date is not None:
        item.start_date = payload.start_date
    if payload.end_date is not None:
        item.end_date = payload.end_date
    if payload.start_time is not None:
        item.start_time = payload.start_time
    if payload.end_time is not None:
        item.end_time = payload.end_time
    if payload.is_active is not None:
        item.is_active = payload.is_active

    db.commit()

    playlist = db.query(Playlist).filter(Playlist.id == item.playlist_id).first()
    db.refresh(playlist)
    return playlist


@app.delete("/playlist/items/{item_id}", response_model=PlaylistOut)
def delete_playlist_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "technicien")),
):
    item = db.query(PlaylistItem).filter(PlaylistItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Playlist item not found")

    playlist_id = item.playlist_id
    db.delete(item)
    db.commit()

    items = (
        db.query(PlaylistItem)
        .filter(PlaylistItem.playlist_id == playlist_id)
        .order_by(PlaylistItem.order_index.asc())
        .all()
    )
    for index, current_item in enumerate(items):
        current_item.order_index = index
    db.commit()

    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    db.refresh(playlist)
    return playlist


@app.put("/devices/{device_id}/playlist/reorder", response_model=PlaylistOut)
def reorder_playlist_items(
    device_id: UUID,
    payload: PlaylistReorderIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "technicien")),
):
    playlist = db.query(Playlist).filter(Playlist.device_id == device_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    items = (
        db.query(PlaylistItem)
        .filter(PlaylistItem.playlist_id == playlist.id)
        .order_by(PlaylistItem.order_index.asc())
        .all()
    )

    existing_ids = {item.id for item in items}
    provided_ids = set(payload.item_ids)

    if existing_ids != provided_ids:
        raise HTTPException(status_code=400, detail="Invalid item_ids list")

    order_map = {item_id: index for index, item_id in enumerate(payload.item_ids)}

    for item in items:
        item.order_index = order_map[item.id]

    db.commit()
    db.refresh(playlist)
    return playlist


@app.post("/auth/register", response_model=UserOut)
def register_user(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    allowed_roles = {"admin", "technicien", "viewer"}
    role = payload.role if payload.role in allowed_roles else "viewer"

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=role,
        is_active=True,
        is_approved=False,
    )

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/auth/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_approved:
        raise HTTPException(
            status_code=403,
            detail="Compte en attente de validation par un administrateur",
        )

    access_token = create_access_token(
        {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
        }
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/auth/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


# =========================
# ADMIN USERS
# =========================

@app.get("/admin/users", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    return db.query(User).order_by(User.id.desc()).all()


@app.put("/admin/users/{user_id}/approve")
def approve_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_approved = True
    user.approved_at = datetime.now(timezone.utc)
    user.approved_by = current_user.id

    db.commit()
    db.refresh(user)

    return {"message": "User approved successfully"}


@app.put("/admin/users/{user_id}/role")
def update_user_role(
    user_id: int,
    new_role: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if new_role not in ["admin", "technicien", "viewer"]:
        raise HTTPException(status_code=400, detail="Invalid role")

    user.role = new_role
    db.commit()
    db.refresh(user)

    return {"message": "Role updated"}


@app.post("/admin/viewer/{user_id}/devices/{device_id}")
def assign_device_to_viewer(
    user_id: int,
    device_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role != "viewer":
        raise HTTPException(status_code=400, detail="Only viewer can have device access")

    existing = db.query(ViewerDeviceAccess).filter(
        ViewerDeviceAccess.user_id == user_id,
        ViewerDeviceAccess.device_id == device_id,
    ).first()

    if existing:
        return {"message": "Already assigned"}

    access = ViewerDeviceAccess(
        user_id=user_id,
        device_id=device_id,
    )

    db.add(access)
    db.commit()

    return {"message": "Device assigned"}


@app.get("/viewer/devices", response_model=list[DeviceOut])
def get_viewer_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "viewer":
        return db.query(Device).order_by(Device.created_at.desc()).all()

    accesses = db.query(ViewerDeviceAccess).filter(
        ViewerDeviceAccess.user_id == current_user.id
    ).all()

    device_ids = [a.device_id for a in accesses]

    if not device_ids:
        return []

    return db.query(Device).filter(Device.id.in_(device_ids)).all()


@app.get("/admin/viewer/{user_id}/devices", response_model=list[DeviceOut])
def get_devices_for_viewer(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    accesses = (
        db.query(ViewerDeviceAccess)
        .filter(ViewerDeviceAccess.user_id == user_id)
        .all()
    )

    device_ids = [a.device_id for a in accesses]

    if not device_ids:
        return []

    devices = db.query(Device).filter(Device.id.in_(device_ids)).all()
    return devices


@app.delete("/admin/viewer/{user_id}/devices/{device_id}")
def remove_device_from_viewer(
    user_id: int,
    device_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    access = (
        db.query(ViewerDeviceAccess)
        .filter(
            ViewerDeviceAccess.user_id == user_id,
            ViewerDeviceAccess.device_id == device_id,
        )
        .first()
    )

    if not access:
        raise HTTPException(status_code=404, detail="Access not found")

    db.delete(access)
    db.commit()

    return {"message": "Device access removed"}

@app.get("/devices/{device_id}/ai-history", response_model=list[AiPredictionOut])
def get_ai_history(
    device_id: UUID,
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    if current_user.role == "viewer":
        access = db.query(ViewerDeviceAccess).filter(
            ViewerDeviceAccess.user_id == current_user.id,
            ViewerDeviceAccess.device_id == device_id,
        ).first()

        if not access:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    return (
        db.query(AiPrediction)
        .filter(AiPrediction.device_id == device_id)
        .order_by(AiPrediction.created_at.desc())
        .limit(limit)
        .all()
    )
@app.get("/ai-history")
def get_ai_dashboard_history(
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(AiPrediction).order_by(AiPrediction.created_at.desc())

    if current_user.role == "viewer":
        accesses = db.query(ViewerDeviceAccess).filter(
            ViewerDeviceAccess.user_id == current_user.id
        ).all()

        device_ids = [a.device_id for a in accesses]

        if not device_ids:
            return []

        query = query.filter(AiPrediction.device_id.in_(device_ids))

    predictions = query.limit(limit).all()

    result = []
    for item in predictions:
        device = db.query(Device).filter(Device.id == item.device_id).first()
        result.append(
            {
                "id": item.id,
                "device_id": str(item.device_id),
                "device_name": device.name if device else "Unknown",
                "device_location": device.location if device else None,
                "cpu": item.cpu,
                "ram": item.ram,
                "temp": item.temp,
                "vlc_running": item.vlc_running,
                "anomaly_score": item.anomaly_score,
                "prediction": item.prediction,
                "reason": item.reason,
                "created_at": item.created_at.isoformat()
                if item.created_at
                else None,
            }
        )

    return result


@app.post("/devices/{device_id}/capture")
async def upload_capture(
    device_id: UUID,
    file: UploadFile = File(...),
    x_api_key: str = Header(default=""),
    db: Session = Depends(get_db),
):
    device = db.query(Device).filter(Device.id == device_id).first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    if device.api_key != x_api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    device_prefix = f"{device_id}_"

    previous_files = sorted(
        [p for p in UPLOAD_DIR.glob(f"{device_prefix}*.jpg")],
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )

    previous_path = str(previous_files[0]) if previous_files else None

    filename = f"{device_id}_{datetime.utcnow().timestamp()}.jpg"
    filepath = UPLOAD_DIR / filename

    content = await file.read()

    with open(filepath, "wb") as f:
        f.write(content)

    active_item = get_active_playlist_item(db, device_id)
    media_type = active_item.media_type if active_item else "video"

    visual_result = call_visual_ai_service(
        current_path=str(filepath),
        previous_path=previous_path,
        media_type=media_type,
    )

    compliance_result = {
        "compliance_status": "unknown",
        "similarity_score": 0,
        "reason": "Aucun média attendu",
    }

    if active_item:
        expected_path = resolve_expected_media_path(active_item.media_url)
        if expected_path:
            compliance_result = call_compliance_ai_service(
                current_path=str(filepath),
                expected_path=expected_path,
                media_type=media_type,
            )

    capture = ScreenCapture(
        device_id=device.id,
        image_path=str(filepath),
        image_url=f"http://localhost:8000/uploads/{filename}",
        visual_status=visual_result.get("anomaly_status", "unknown"),
        visual_reason=visual_result.get("reason"),
        compliance_status=compliance_result.get("compliance_status", "unknown"),
        compliance_reason=compliance_result.get("reason"),
        similarity_score=float(compliance_result.get("similarity_score", 0))
        if compliance_result.get("similarity_score") is not None
        else None,
        expected_media_type=media_type,
        expected_media_title=active_item.title if active_item else None,
        expected_media_url=active_item.media_url if active_item else None,
    )

    db.add(capture)
    db.commit()
    db.refresh(capture)

    anomaly_status = visual_result.get("anomaly_status", "unknown")
    visual_reason = visual_result.get("reason", "")

    if anomaly_status in ["black_screen", "frozen", "display_error"]:
        alert = Alert(
            device_id=device.id,
            type="VISUAL",
            message=f"{anomaly_status}: {visual_reason}",
            value=1,
            threshold=1,
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)

        await manager.broadcast(
            {
                "type": "alert_created",
                "payload": {
                    "id": alert.id,
                    "device_id": str(alert.device_id),
                    "device_name": device.name,
                    "device_location": device.location,
                    "type": alert.type,
                    "message": alert.message,
                    "value": alert.value,
                    "threshold": alert.threshold,
                    "created_at": alert.created_at.isoformat()
                    if alert.created_at
                    else None,
                },
            }
        )

    if compliance_result.get("compliance_status") == "non_compliant":
        alert = Alert(
            device_id=device.id,
            type="COMPLIANCE",
            message=f"Non conforme: {compliance_result.get('reason')}",
            value=float(compliance_result.get("similarity_score", 0)),
            threshold=0.80 if media_type == "image" else 0.35,
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)

        await manager.broadcast(
            {
                "type": "alert_created",
                "payload": {
                    "id": alert.id,
                    "device_id": str(alert.device_id),
                    "device_name": device.name,
                    "device_location": device.location,
                    "type": alert.type,
                    "message": alert.message,
                    "value": alert.value,
                    "threshold": alert.threshold,
                    "created_at": alert.created_at.isoformat()
                    if alert.created_at
                    else None,
                },
            }
        )

    return {
        "message": "Capture uploaded",
        "capture_id": capture.id,
        "path": str(filepath),
        "expected_media_type": media_type,
        "expected_media_title": active_item.title if active_item else None,
        "visual_ai": visual_result,
        "compliance_ai": compliance_result,
    }


@app.get("/devices/{device_id}/last-capture")
def get_last_capture(
    device_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    device = db.query(Device).filter(Device.id == device_id).first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    if current_user.role == "viewer":
        access = db.query(ViewerDeviceAccess).filter(
            ViewerDeviceAccess.user_id == current_user.id,
            ViewerDeviceAccess.device_id == device_id,
        ).first()

        if not access:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    capture = (
        db.query(ScreenCapture)
        .filter(ScreenCapture.device_id == device_id)
        .order_by(ScreenCapture.created_at.desc())
        .first()
    )

    if capture:
        return {
            "filename": Path(capture.image_path).name,
            "url": capture.image_url,
            "captured_at": capture.created_at.isoformat() if capture.created_at else None,
        }

    files = sorted(
        [p for p in UPLOAD_DIR.glob(f"{device_id}_*.jpg")],
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )

    if not files:
        raise HTTPException(status_code=404, detail="No capture found")

    latest = files[0]

    return {
        "filename": latest.name,
        "url": f"http://localhost:8000/uploads/{latest.name}",
        "captured_at": datetime.fromtimestamp(
            latest.stat().st_mtime,
            tz=timezone.utc,
        ).isoformat(),
    }


@app.get("/devices/{device_id}/last-capture-db", response_model=ScreenCaptureOut)
def get_last_capture_db(
    device_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    device = db.query(Device).filter(Device.id == device_id).first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    if current_user.role == "viewer":
        access = db.query(ViewerDeviceAccess).filter(
            ViewerDeviceAccess.user_id == current_user.id,
            ViewerDeviceAccess.device_id == device_id,
        ).first()

        if not access:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    capture = (
        db.query(ScreenCapture)
        .filter(ScreenCapture.device_id == device_id)
        .order_by(ScreenCapture.created_at.desc())
        .first()
    )

    if not capture:
        raise HTTPException(status_code=404, detail="No capture found")

    return capture


@app.get("/devices/{device_id}/captures", response_model=list[ScreenCaptureOut])
def get_device_captures(
    device_id: UUID,
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    device = db.query(Device).filter(Device.id == device_id).first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    if current_user.role == "viewer":
        access = db.query(ViewerDeviceAccess).filter(
            ViewerDeviceAccess.user_id == current_user.id,
            ViewerDeviceAccess.device_id == device_id,
        ).first()

        if not access:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    return (
        db.query(ScreenCapture)
        .filter(ScreenCapture.device_id == device_id)
        .order_by(ScreenCapture.created_at.desc())
        .limit(limit)
        .all()
    )


@app.get("/captures")
def get_all_captures(
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(ScreenCapture).order_by(ScreenCapture.created_at.desc())

    if current_user.role == "viewer":
        accesses = db.query(ViewerDeviceAccess).filter(
            ViewerDeviceAccess.user_id == current_user.id
        ).all()

        device_ids = [a.device_id for a in accesses]

        if not device_ids:
            return []

        query = query.filter(ScreenCapture.device_id.in_(device_ids))

    captures = query.limit(limit).all()

    result = []

    for item in captures:
        device = db.query(Device).filter(Device.id == item.device_id).first()

        result.append(
            {
                "id": item.id,
                "device_id": str(item.device_id),
                "device_name": device.name if device else "Unknown",
                "device_location": device.location if device else None,
                "image_url": item.image_url,
                "visual_status": item.visual_status,
                "visual_reason": item.visual_reason,
                "compliance_status": item.compliance_status,
                "compliance_reason": item.compliance_reason,
                "similarity_score": item.similarity_score,
                "expected_media_type": item.expected_media_type,
                "expected_media_title": item.expected_media_title,
                "expected_media_url": item.expected_media_url,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
        )

    return result


@app.get("/captures/{capture_id}")
def get_capture_detail(
    capture_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    capture = db.query(ScreenCapture).filter(ScreenCapture.id == capture_id).first()

    if not capture:
        raise HTTPException(status_code=404, detail="Capture not found")

    if current_user.role == "viewer":
        access = db.query(ViewerDeviceAccess).filter(
            ViewerDeviceAccess.user_id == current_user.id,
            ViewerDeviceAccess.device_id == capture.device_id,
        ).first()

        if not access:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    device = db.query(Device).filter(Device.id == capture.device_id).first()

    return {
        "id": capture.id,
        "device_id": str(capture.device_id),
        "device_name": device.name if device else "Unknown",
        "device_location": device.location if device else None,
        "image_url": capture.image_url,
        "visual_status": capture.visual_status,
        "visual_reason": capture.visual_reason,
        "compliance_status": capture.compliance_status,
        "compliance_reason": capture.compliance_reason,
        "similarity_score": capture.similarity_score,
        "expected_media_type": capture.expected_media_type,
        "expected_media_title": capture.expected_media_title,
        "expected_media_url": capture.expected_media_url,
        "created_at": capture.created_at.isoformat() if capture.created_at else None,
    }

class SimulateAnomalyRequest(BaseModel):
    type: str


@app.post("/devices/{device_id}/simulate-anomaly")
async def simulate_anomaly(
    device_id: UUID,
    payload: SimulateAnomalyRequest,
    db: Session = Depends(get_db),
):
    device = db.query(Device).filter(Device.id == device_id).first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    messages = {
        "black_screen": "Écran noir détecté",
        "frozen": "Diffusion figée détectée",
        "wrong_content": "Contenu non programmé détecté",
        "normal": "Retour à l’état normal",
    }

    alert_types = {
        "black_screen": "BLACK_SCREEN",
        "frozen": "FROZEN",
        "wrong_content": "WRONG_CONTENT",
        "normal": "NORMAL",
    }

    alert = Alert(
        device_id=device.id,
        type=alert_types.get(payload.type, "SIMULATION"),
        message=messages.get(payload.type, "Anomalie simulée"),
        value=1.0,
        threshold=1.0,
    )

    db.add(alert)
    db.commit()
    db.refresh(alert)

    created_at = None
    if alert.created_at:
        created_at = alert.created_at.isoformat()

    await manager.broadcast(
        {
            "type": "alert_created",
            "payload": {
                "id": alert.id,
                "device_id": str(device.id),
                "device_name": device.name,
                "device_location": device.location,
                "type": alert.type,
                "message": alert.message,
                "value": alert.value,
                "threshold": alert.threshold,
                "created_at": created_at,
            },
        }
    )

    return {
        "success": True,
        "alert_id": alert.id,
        "device_id": str(device.id),
        "message": alert.message,
    }