from pydantic import BaseModel


class AnomalyInput(BaseModel):
    cpu: float
    ram: float
    temp: float
    vlc_running: bool


class AnomalyOutput(BaseModel):
    anomaly_score: float
    prediction: str
    reason: str