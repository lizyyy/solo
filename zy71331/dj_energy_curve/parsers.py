from __future__ import annotations

import csv
import json
import os
from pathlib import Path
from typing import Any

from .models import Track, FlagStatus


REQUIRED_FIELDS = {"track_id"}
OPTIONAL_FIELDS = {
    "title", "artist", "bpm_raw", "bpm_normalized",
    "key_raw", "key_normalized", "energy", "time_slot", "position",
}

BPM_ALIASES = {"bpm", "bpm_raw", "tempo"}
KEY_ALIASES = {"key", "key_raw", "musical_key", "camelot"}
ENERGY_ALIASES = {"energy", "energy_level", "energy_score"}
TITLE_ALIASES = {"title", "track", "song", "name"}
ARTIST_ALIASES = {"artist", "dj", "performer"}
ID_ALIASES = {"track_id", "id", "track_number", "song_id"}
POSITION_ALIASES = {"position", "order", "index", "seq", "track_number"}
TIMESLOT_ALIASES = {"time_slot", "timeslot", "time", "slot", "hour"}


def _resolve_field(record: dict, aliases: set[str], default: Any = None) -> Any:
    for alias in aliases:
        for key in record:
            if key.lower().strip() == alias:
                return record[key]
    return default


def _parse_bpm(value: Any) -> float | None:
    if value is None:
        return None
    try:
        v = float(str(value).strip())
        return v if v > 0 else None
    except (ValueError, TypeError):
        return None


def _parse_energy(value: Any) -> float | None:
    if value is None:
        return None
    try:
        v = float(str(value).strip())
        if 0 <= v <= 10:
            return v
        if 0 <= v <= 1:
            return v * 10
        if v > 10:
            return min(v / 10.0, 10.0) if v <= 100 else None
        return None
    except (ValueError, TypeError):
        return None


def _parse_position(value: Any) -> int:
    if value is None:
        return 0
    try:
        return int(float(str(value).strip()))
    except (ValueError, TypeError):
        return 0


def record_to_track(record: dict, default_position: int = 0) -> Track:
    track_id = _resolve_field(record, ID_ALIASES, "")
    if not track_id:
        track_id = str(id(record))

    title = _resolve_field(record, TITLE_ALIASES, "")
    artist = _resolve_field(record, ARTIST_ALIASES, "")
    bpm_raw = _parse_bpm(_resolve_field(record, BPM_ALIASES))
    bpm_normalized = _parse_bpm(_resolve_field(record, {"bpm_normalized"}))
    key_raw = str(_resolve_field(record, KEY_ALIASES, "") or "").strip()
    key_normalized = str(_resolve_field(record, {"key_normalized"}, "") or "").strip()
    energy = _parse_energy(_resolve_field(record, ENERGY_ALIASES))
    time_slot = str(_resolve_field(record, TIMESLOT_ALIASES, "") or "").strip()
    position = _parse_position(_resolve_field(record, POSITION_ALIASES, default_position))

    flags: list[str] = []
    if bpm_raw is None:
        flags.append("missing_bpm")
    if not key_raw:
        flags.append("missing_key")
    if energy is None:
        flags.append("missing_energy")
    if not time_slot:
        flags.append("missing_timeslot")

    status = FlagStatus.OK
    if len(flags) >= 3:
        status = FlagStatus.REVIEW

    return Track(
        track_id=str(track_id),
        title=str(title),
        artist=str(artist),
        bpm_raw=bpm_raw,
        bpm_normalized=bpm_normalized,
        key_raw=key_raw,
        key_normalized=key_normalized if key_normalized else key_raw,
        energy=energy,
        time_slot=time_slot,
        position=position,
        flags=flags,
        status=status,
    )


def parse_csv_file(filepath: str | Path) -> list[dict]:
    rows: list[dict] = []
    with open(filepath, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            cleaned = {k.strip(): v for k, v in row.items() if k and v is not None and str(v).strip()}
            if cleaned:
                rows.append(cleaned)
    return rows


def parse_json_file(filepath: str | Path) -> list[dict]:
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        return [r for r in data if isinstance(r, dict) and r]
    if isinstance(data, dict):
        for key in ("tracks", "songs", "playlist", "items", "data"):
            if key in data and isinstance(data[key], list):
                return [r for r in data[key] if isinstance(r, dict) and r]
        return [data]
    return []


def parse_jsonl_file(filepath: str | Path) -> list[dict]:
    rows: list[dict] = []
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                if isinstance(obj, dict) and obj:
                    rows.append(obj)
            except json.JSONDecodeError:
                continue
    return rows


def load_tracks_from_dir(input_dir: str | Path) -> list[Track]:
    input_dir = Path(input_dir)
    if not input_dir.is_dir():
        raise FileNotFoundError(f"Input directory not found: {input_dir}")

    all_records: list[dict] = []
    source_map: dict[int, str] = {}

    for fname in sorted(os.listdir(input_dir)):
        fpath = input_dir / fname
        if not fpath.is_file():
            continue
        ext = fpath.suffix.lower()
        try:
            if ext == ".csv":
                records = parse_csv_file(fpath)
            elif ext == ".jsonl":
                records = parse_jsonl_file(fpath)
            elif ext == ".json":
                records = parse_json_file(fpath)
            else:
                continue
        except Exception as e:
            print(f"[WARN] Failed to parse {fpath}: {e}")
            continue
        for r in records:
            idx = len(all_records)
            source_map[idx] = fname
            all_records.append(r)

    if not all_records:
        return []

    tracks: list[Track] = []
    has_explicit_position = any(
        _resolve_field(r, POSITION_ALIASES) is not None for r in all_records
    )

    for i, record in enumerate(all_records):
        default_pos = i + 1
        track = record_to_track(record, default_position=default_pos)
        if track.position == 0:
            track.position = default_pos
        track.meta["source_file"] = source_map.get(i, "unknown")
        if track.status == FlagStatus.REVIEW:
            track.flags.append("auto_review:too_many_missing_fields")
        tracks.append(track)

    if not has_explicit_position:
        tracks.sort(key=lambda t: (t.time_slot, t.position))
    else:
        tracks.sort(key=lambda t: t.position)

    for i, t in enumerate(tracks):
        t.position = i + 1

    return tracks


def load_previous_state(output_dir: str | Path) -> dict | None:
    output_dir = Path(output_dir)
    state_file = output_dir / "pipeline_state.json"
    if state_file.is_file():
        with open(state_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return None
