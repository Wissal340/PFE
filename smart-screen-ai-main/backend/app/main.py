import json
import secrets
from datetime import datetime, timezone
from uuid import UUID

from fastapi import (
    Depends,
    FastAPI,
    Header,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Alert, Device, Metric, User
from app.schemas import (
    AlertOut,
    DeviceCreate,
    DeviceOut,
    DeviceRegisterResponse,
    DeviceUpdate,
    MetricIn,
    MetricOut,
    Token,
    UserCreate,
    UserLogin,
    UserOut,
)
from app.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

app = FastAPI(title="Smart Screen AI Pro API")


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


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()


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


@app.get("/health")
def health():
    return {"status": "ok"}


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


@app.get("/devices", response_model=list[DeviceOut])
def list_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Device).order_by(Device.created_at.desc()).all()


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
    db.commit()
    db.refresh(m)

    await manager.broadcast(
    {
        "type": "alert_created",
        "payload": {
            "id": a.id,
            "device_id": str(a.device_id),
            "device_name": device.name,
            "device_location": device.location,
            "type": a.type,
            "message": a.message,
            "value": a.value,
            "threshold": a.threshold,
            "created_at": a.created_at.isoformat() if a.created_at else None,
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

    if alerts:
        for a in alerts:
            db.add(a)
        db.commit()

        for a in alerts:
            db.refresh(a)
            await manager.broadcast(
                {
                    "type": "alert_created",
                    "payload": {
                        "id": a.id,
                        "device_id": str(a.device_id),
                        "type": a.type,
                        "message": a.message,
                        "value": a.value,
                        "threshold": a.threshold,
                        "created_at": a.created_at.isoformat()
                        if a.created_at
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