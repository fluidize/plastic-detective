import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load(name: str) -> dict:
    with open(ROOT / name, encoding="utf-8") as f:
        return json.load(f)


CONFIG = load("config.json")
SECRETS = load("secrets.json")
