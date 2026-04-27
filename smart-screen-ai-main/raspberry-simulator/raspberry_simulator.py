import time
import random
import requests
import psutil
from pathlib import Path
from mss import mss
from PIL import Image

BACKEND_URL = "http://localhost:8000"

DEVICE_ID = "cfe32e79-1e82-4443-8208-f9c74f51d5a8"
API_KEY = "hUZfwy5_7aan7kEDWqkFIxhhmfQ_k_k9wtbGpN7QCek"

INTERVAL_SECONDS = 10

CAPTURE_FILE = "screen_capture.jpg"


def send_metrics():
    cpu = psutil.cpu_percent()
    ram = psutil.virtual_memory().percent
    temp = random.uniform(35, 70)
    vlc_running = True

    payload = {
        "cpu": cpu,
        "memory": ram,
        "temperature": round(temp, 2),
        "vlc_running": vlc_running,
    }

    headers = {
        "x-api-key": API_KEY
    }

    url = f"{BACKEND_URL}/devices/{DEVICE_ID}/metrics"

    res = requests.post(url, json=payload, headers=headers, timeout=10)
    print("METRICS:", res.status_code, res.text)


def capture_screen():
    with mss() as sct:
        monitor = sct.monitors[1]
        img = sct.grab(monitor)

        image = Image.frombytes("RGB", img.size, img.rgb)
        image.save(CAPTURE_FILE, quality=85)

    return CAPTURE_FILE


def send_capture():
    capture_path = capture_screen()

    headers = {
        "x-api-key": API_KEY
    }

    url = f"{BACKEND_URL}/devices/{DEVICE_ID}/capture"

    with open(capture_path, "rb") as f:
        files = {
            "file": ("capture.jpg", f, "image/jpeg")
        }

        res = requests.post(url, headers=headers, files=files, timeout=30)
        print("CAPTURE:", res.status_code, res.text)


def main():
    print("Raspberry simulator started...")

    while True:
        try:
            send_metrics()
            send_capture()
        except Exception as e:
            print("ERROR:", e)

        time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    main()