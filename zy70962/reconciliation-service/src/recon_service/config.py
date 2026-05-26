"""应用配置."""
from __future__ import annotations

from pathlib import Path


BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
DATA_DIR: Path = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

US_HOLIDAYS_2025_2026 = {
    "2025-01-01", "2025-01-20", "2025-02-16", "2025-04-18", "2025-05-25",
    "2025-06-19", "2025-07-03", "2025-07-04", "2025-09-07", "2025-11-26",
    "2025-11-27", "2025-12-25",
    "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
    "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-11-27",
    "2026-12-25",
}
