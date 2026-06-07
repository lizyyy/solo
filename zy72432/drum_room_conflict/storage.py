import json
import os
from pathlib import Path
from typing import Optional
from .models import ProjectState


STATE_FILE = Path("data/project_state.json")


def load_state() -> ProjectState:
    if STATE_FILE.exists():
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return ProjectState(**data)
    return ProjectState()


def save_state(state: ProjectState) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state.model_dump(mode="json"), f, ensure_ascii=False, indent=2)


def reset_state() -> None:
    if STATE_FILE.exists():
        STATE_FILE.unlink()
