from __future__ import annotations

from typing import Tuple


def normalize(value: float, min_value: float, max_value: float) -> float:
    if value <= min_value:
        return 0.0
    if value >= max_value:
        return 1.0
    return (value - min_value) / (max_value - min_value)


def predict_anomaly(cpu: float, ram: float, temp: float, vlc_running: bool) -> Tuple[float, str, str]:
    cpu_score = normalize(cpu, 40, 95)
    ram_score = normalize(ram, 50, 95)
    temp_score = normalize(temp, 45, 90)
    vlc_score = 1.0 if not vlc_running else 0.0

    anomaly_score = (
        (cpu_score * 0.30)
        + (ram_score * 0.20)
        + (temp_score * 0.35)
        + (vlc_score * 0.15)
    )

    anomaly_score = round(anomaly_score, 4)

    reasons = []

    if cpu >= 85:
        reasons.append("CPU usage élevé")
    if ram >= 85:
        reasons.append("RAM élevée")
    if temp >= 75:
        reasons.append("Température élevée")
    if not vlc_running:
        reasons.append("VLC arrêté")

    if anomaly_score >= 0.75:
        prediction = "critical"
    elif anomaly_score >= 0.45:
        prediction = "warning"
    else:
        prediction = "normal"

    reason = ", ".join(reasons) if reasons else "Comportement normal"

    return anomaly_score, prediction, reason