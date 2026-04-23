from fastapi import FastAPI, File, UploadFile, Form
from app.model import predict_anomaly
from app.schemas import AnomalyInput, AnomalyOutput
from app.vision import analyze_visual_capture, check_compliance

app = FastAPI(title="Smart Screen AI Service")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict/anomaly", response_model=AnomalyOutput)
def predict(payload: AnomalyInput):
    score, prediction, reason = predict_anomaly(
        cpu=payload.cpu,
        ram=payload.ram,
        temp=payload.temp,
        vlc_running=payload.vlc_running,
    )

    return {
        "anomaly_score": score,
        "prediction": prediction,
        "reason": reason,
    }


@app.post("/detect/visual")
async def detect_visual(
    file: UploadFile = File(...),
    previous_file: UploadFile | None = File(default=None),
    media_type: str = Form("video"),
):
    current_bytes = await file.read()
    previous_bytes = await previous_file.read() if previous_file else None

    result = analyze_visual_capture(
        current_bytes=current_bytes,
        previous_bytes=previous_bytes,
        media_type=media_type,
    )
    return result


@app.post("/check/compliance")
async def detect_compliance(
    file: UploadFile = File(...),
    expected_file: UploadFile = File(...),
    media_type: str = Form("image"),
):
    current_bytes = await file.read()
    expected_bytes = await expected_file.read()

    result = check_compliance(
        current_bytes=current_bytes,
        expected_bytes=expected_bytes,
        media_type=media_type,
    )
    return result