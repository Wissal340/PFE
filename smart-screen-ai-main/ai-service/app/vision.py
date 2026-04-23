from __future__ import annotations

import io
from typing import Any

import numpy as np
from PIL import Image, ImageOps


def _load_rgb(image_bytes: bytes, size: tuple[int, int] = (128, 128)) -> np.ndarray:
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image = ImageOps.exif_transpose(image)
    image = image.resize(size)
    return np.array(image, dtype=np.float32)


def _load_grayscale(image_bytes: bytes, size: tuple[int, int] = (128, 128)) -> np.ndarray:
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image = ImageOps.exif_transpose(image)
    image = image.resize(size)
    gray = image.convert("L")
    return np.array(gray, dtype=np.float32)


def _average_hash(gray: np.ndarray, hash_size: int = 8) -> np.ndarray:
    img = Image.fromarray(gray.astype(np.uint8)).resize((hash_size, hash_size))
    arr = np.array(img, dtype=np.float32)
    avg = arr.mean()
    return (arr > avg).astype(np.uint8).flatten()


def _hamming_similarity(hash1: np.ndarray, hash2: np.ndarray) -> float:
    if hash1.shape != hash2.shape:
        return 0.0
    same = np.sum(hash1 == hash2)
    return float(same) / float(len(hash1))


def _image_similarity(current_bytes: bytes, reference_bytes: bytes) -> float:
    current = _load_rgb(current_bytes)
    reference = _load_rgb(reference_bytes)

    diff = np.abs(current - reference)
    mean_diff = float(diff.mean())

    # 0 = très différent, 1 = très similaire
    similarity = max(0.0, 1.0 - min(mean_diff / 255.0, 1.0))
    return round(similarity, 4)


def analyze_visual_capture(
    current_bytes: bytes,
    previous_bytes: bytes | None = None,
    media_type: str = "video",
) -> dict[str, Any]:
    current = _load_grayscale(current_bytes)

    mean_brightness = float(current.mean())
    std_dev = float(current.std())

    brightness_score = round(mean_brightness / 255.0, 4)
    uniformity_score = round(1.0 - min(std_dev / 64.0, 1.0), 4)

    anomaly_status = "normal"
    reason = "Aucune anomalie visuelle détectée"
    freeze_score = 0.0
    similarity_score = 0.0

    if mean_brightness < 15:
        anomaly_status = "black_screen"
        reason = "Écran noir détecté"
        return {
            "anomaly_status": anomaly_status,
            "reason": reason,
            "brightness_score": brightness_score,
            "uniformity_score": uniformity_score,
            "freeze_score": freeze_score,
            "similarity_score": similarity_score,
        }

    if std_dev < 4:
        anomaly_status = "display_error"
        reason = "Image anormalement uniforme détectée"
        return {
            "anomaly_status": anomaly_status,
            "reason": reason,
            "brightness_score": brightness_score,
            "uniformity_score": uniformity_score,
            "freeze_score": freeze_score,
            "similarity_score": similarity_score,
        }

    if previous_bytes is not None and media_type == "video":
        previous = _load_grayscale(previous_bytes)
        diff = np.abs(current - previous)
        mean_diff = float(diff.mean())

        freeze_score = round(max(0.0, 1.0 - min(mean_diff / 25.0, 1.0)), 4)

        current_hash = _average_hash(current)
        previous_hash = _average_hash(previous)
        similarity_score = round(_hamming_similarity(current_hash, previous_hash), 4)

        if mean_diff < 2.0 and similarity_score > 0.97:
            anomaly_status = "frozen"
            reason = "Diffusion figée détectée"

    return {
        "anomaly_status": anomaly_status,
        "reason": reason,
        "brightness_score": brightness_score,
        "uniformity_score": uniformity_score,
        "freeze_score": freeze_score,
        "similarity_score": similarity_score,
    }


def check_compliance(
    current_bytes: bytes,
    expected_bytes: bytes,
    media_type: str = "image",
) -> dict[str, Any]:
    similarity_score = _image_similarity(current_bytes, expected_bytes)

    if media_type == "image":
        if similarity_score >= 0.80:
            return {
                "compliance_status": "compliant",
                "similarity_score": similarity_score,
                "reason": "Le contenu affiché correspond au média prévu",
            }

        return {
            "compliance_status": "non_compliant",
            "similarity_score": similarity_score,
            "reason": "Le contenu affiché ne correspond pas à l'image prévue",
        }

    # V1 vidéo : contrôle simple
    if similarity_score >= 0.35:
        return {
            "compliance_status": "partially_compliant",
            "similarity_score": similarity_score,
            "reason": "Correspondance partielle avec le contenu vidéo attendu",
        }

    return {
        "compliance_status": "non_compliant",
        "similarity_score": similarity_score,
        "reason": "Le contenu affiché ne correspond pas au média vidéo attendu",
    }