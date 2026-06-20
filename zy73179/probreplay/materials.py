from __future__ import annotations

import json
import os
from typing import List, Dict, Optional, Tuple

from .models import Material, Revision, StanceChange, Record, SimParams


MATERIAL_TYPES = {"scoring_notes", "normal_record", "oral_explanation"}


def _load_json(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _material_from_dict(data: dict, path: str) -> Material:
    revisions = [
        Revision(
            at=r.get("at", ""),
            by=r.get("by", ""),
            stance=r.get("stance", ""),
            reason=r.get("reason", ""),
        )
        for r in data.get("revisions", [])
    ]
    return Material(
        id=data.get("id", os.path.basename(path)),
        type=data.get("type", "unknown"),
        title=data.get("title", data.get("id", path)),
        author=data.get("author", ""),
        stance=data.get("stance", ""),
        revisions=revisions,
        payload=data.get("payload", {}),
        path=path,
    )


def load_materials(input_dir: str) -> List[Material]:
    materials: List[Material] = []
    if not os.path.isdir(input_dir):
        raise FileNotFoundError(f"输入目录不存在: {input_dir}")
    for name in sorted(os.listdir(input_dir)):
        if not name.endswith(".json"):
            continue
        if name.startswith("params"):
            continue
        path = os.path.join(input_dir, name)
        try:
            data = _load_json(path)
        except json.JSONDecodeError as exc:
            raise ValueError(f"材料 JSON 解析失败 {path}: {exc}")
        mat = _material_from_dict(data, path)
        if mat.type not in MATERIAL_TYPES:
            continue
        materials.append(mat)
    return materials


def detect_stance_changes(materials: List[Material]) -> List[StanceChange]:
    changes: List[StanceChange] = []
    for mat in materials:
        if len(mat.revisions) < 2:
            continue
        for i in range(1, len(mat.revisions)):
            prev = mat.revisions[i - 1]
            curr = mat.revisions[i]
            if prev.stance.strip() != curr.stance.strip():
                changes.append(
                    StanceChange(
                        material_id=mat.id,
                        title=mat.title,
                        author=mat.author,
                        from_stance=prev.stance,
                        to_stance=curr.stance,
                        at=curr.at,
                        reason=curr.reason,
                    )
                )
    return changes


def load_params(input_dir: str, materials: List[Material]) -> SimParams:
    params_path = os.path.join(input_dir, "params_baseline.json")
    if os.path.isfile(params_path):
        data = _load_json(params_path)
        return SimParams(
            pass_threshold=float(data.get("pass_threshold", 60.0)),
            sigma=float(data.get("sigma", 1.0)),
            unit=str(data.get("unit", "point")),
            n_trials=int(data.get("n_trials", 2000)),
            seed=int(data.get("seed", 42)),
        )
    threshold = 60.0
    unit = "point"
    for mat in materials:
        if mat.type == "scoring_notes":
            p = mat.payload
            threshold = float(p.get("pass_threshold", threshold))
            unit = str(p.get("unit", unit))
    return SimParams(pass_threshold=threshold, unit=unit)


def derive_records(materials: List[Material]) -> Tuple[List[Record], Dict[str, List[str]]]:
    records: List[Record] = []
    by_id: Dict[str, Record] = {}
    for mat in materials:
        if mat.type != "normal_record":
            continue
        for r in mat.payload.get("records", []):
            rec = Record(
                id=str(r["id"]),
                name=str(r.get("name", r["id"])),
                base_score=float(r["base_score"]),
                effective_score=float(r["base_score"]),
                meta={"source": mat.id, "raw": float(r["base_score"])},
            )
            records.append(rec)
            by_id[rec.id] = rec

    adjustments: Dict[str, List[str]] = {r.id: [] for r in records}
    for mat in materials:
        if mat.type != "oral_explanation":
            continue
        if not mat.payload.get("applied", False):
            continue
        target = str(mat.payload.get("target_record", ""))
        adj = float(mat.payload.get("adjustment", 0.0))
        if target in by_id:
            by_id[target].effective_score += adj
            by_id[target].meta.setdefault("adjustments", []).append(
                {"material": mat.id, "delta": adj, "stance": mat.stance}
            )
            adjustments[target].append(mat.id)
    return records, adjustments


def material_index(materials: List[Material]) -> Dict[str, Material]:
    return {m.id: m for m in materials}
