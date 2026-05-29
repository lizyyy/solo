import re
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session

from .. import models, schemas
from ..utils import parse_timestamp, parse_log_level
from .material_service import get_batch, get_material, get_material_content


LOG_CATEGORIES = {
    "cache": [
        r"cache.*hit",
        r"cache.*miss",
        r"cache.*restored",
        r"cache.*saved",
        r"cache.*key",
        r"restoring.*cache",
        r"saving.*cache",
        r"cache.*fingerprint",
        r"cache.*invalid",
        r"cache.*expired",
    ],
    "test_artifact": [
        r"test.*artifact",
        r"build.*artifact",
        r"target.*directory",
        r"dist.*folder",
        r"node_modules",
        r"__pycache__",
        r"\.pyc",
        r"test.*report.*generated",
        r"coverage.*report",
        r"junit.*xml",
    ],
    "env_var": [
        r"export\s+\w+=",
        r"set\s+\w+=",
        r"env\s+\w+=",
        r"\$\{?\w+\}?",
        r"environment.*variable",
        r"env.*var",
        r"CI_\w+",
        r"GITHUB_\w+",
        r"BUILD_\w+",
    ],
    "dependency": [
        r"npm\s+install",
        r"pip\s+install",
        r"yarn\s+install",
        r"poetry\s+install",
        r"maven\s+install",
        r"gradle\s+build",
        r"downloading.*dependency",
        r"resolving.*dependency",
        r"package.*version",
        r"requirement.*satisfied",
    ],
    "error": [
        r"error",
        r"failed",
        r"failure",
        r"exception",
        r"traceback",
        r"fatal",
        r"not\s+found",
        r"cannot\s+find",
        r"permission\s+denied",
    ],
}

ANOMALY_PATTERNS = {
    "cache_miss_error": [
        r"cache.*miss.*unexpected",
        r"cache.*key.*mismatch",
        r"cache.*fingerprint.*changed",
        r"cache.*invalidated",
        r"expected.*cache.*hit.*got.*miss",
    ],
    "test_artifact_leftover": [
        r"leftover.*file",
        r"previous.*build.*artifact",
        r"file.*exists.*from.*previous",
        r"not\s+clean.*workspace",
        r"stale.*test.*result",
    ],
    "env_var_drift": [
        r"environment.*variable.*changed",
        r"env.*var.*mismatch",
        r"expected.*\w+.*got.*different",
        r"version.*mismatch",
        r"path.*contains.*unexpected",
    ],
}


def categorize_log_line(line: str) -> Tuple[Optional[str], bool]:
    line_lower = line.lower()
    matched_category = None
    is_anomaly = False

    for category, patterns in LOG_CATEGORIES.items():
        for pattern in patterns:
            if re.search(pattern, line_lower):
                matched_category = category
                break
        if matched_category:
            break

    for anomaly_type, patterns in ANOMALY_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, line_lower):
                is_anomaly = True
                break
        if is_anomaly:
            break

    if "error" in line_lower or "fail" in line_lower or "exception" in line_lower:
        if "cache" in line_lower or "artifact" in line_lower or "env" in line_lower:
            is_anomaly = True

    return matched_category, is_anomaly


def extract_cache_info(line: str) -> Dict:
    info = {}
    patterns = [
        (r"cache\s+key\s*[:=]\s*([\w\-_]+)", "cache_key"),
        (r"fingerprint\s*[:=]\s*([\w\-_]+)", "fingerprint"),
        (r"expected\s*[:=]\s*([\w\-_]+)", "expected"),
        (r"actual\s*[:=]\s*([\w\-_]+)", "actual"),
    ]
    for pattern, key in patterns:
        match = re.search(pattern, line, re.IGNORECASE)
        if match:
            info[key] = match.group(1)
    return info


def extract_env_var(line: str) -> Dict:
    info = {}
    match = re.search(r"(?:export|set|env)\s+(\w+)\s*=\s*(.+)", line)
    if match:
        info["name"] = match.group(1)
        info["value"] = match.group(2).strip().strip('"').strip("'")
    return info


def parse_log_content(content: str, batch_id: int, material_id: Optional[int] = None) -> List[schemas.ParsedLogEntryCreate]:
    entries = []
    lines = content.splitlines()

    for line_num, raw_line in enumerate(lines, 1):
        if not raw_line.strip():
            continue

        log_time = parse_timestamp(raw_line)
        log_level = parse_log_level(raw_line)
        category, is_anomaly = categorize_log_line(raw_line)

        message = raw_line.strip()
        if log_time:
            message = re.sub(r"^\[?[\d\-T:\s]+\]?\s*", "", message).strip()
        if log_level:
            message = re.sub(rf"^\[?{log_level}\]?\s*", "", message, flags=re.IGNORECASE).strip()

        meta = {}
        if category == "cache":
            meta = extract_cache_info(raw_line)
        elif category == "env_var":
            meta = extract_env_var(raw_line)

        entry = schemas.ParsedLogEntryCreate(
            batch_id=batch_id,
            material_id=material_id,
            log_time=log_time,
            log_level=log_level,
            category=category,
            message=message,
            raw_text=raw_line,
            line_number=line_num,
            is_anomaly=is_anomaly,
            meta=meta,
        )
        entries.append(entry)

    return entries


def save_parsed_logs(db: Session, entries: List[schemas.ParsedLogEntryCreate]) -> List[models.ParsedLogEntry]:
    db_entries = []
    for entry in entries:
        db_entry = models.ParsedLogEntry(
            batch_id=entry.batch_id,
            material_id=entry.material_id,
            log_time=entry.log_time,
            log_level=entry.log_level,
            category=entry.category,
            message=entry.message,
            raw_text=entry.raw_text,
            line_number=entry.line_number,
            is_anomaly=entry.is_anomaly,
            meta=entry.meta,
        )
        db.add(db_entry)
        db_entries.append(db_entry)
    db.commit()
    for entry in db_entries:
        db.refresh(entry)
    return db_entries


def parse_pipeline_logs(db: Session, batch_id: int, material_id: Optional[int] = None) -> Dict:
    batch = get_batch(db, batch_id)
    if not batch:
        raise ValueError(f"Batch {batch_id} not found")

    materials_to_parse = []
    if material_id:
        material = get_material(db, material_id)
        if not material:
            raise ValueError(f"Material {material_id} not found")
        if material.material_type != "pipeline_log":
            raise ValueError(f"Material {material_id} is not a pipeline log")
        materials_to_parse.append(material)
    else:
        materials = db.query(models.Material).filter(
            models.Material.batch_id == batch_id,
            models.Material.material_type == "pipeline_log",
        ).all()
        if not materials:
            raise ValueError(f"No pipeline logs found for batch {batch_id}")
        materials_to_parse = materials

    all_entries = []
    for material in materials_to_parse:
        content = get_material_content(material.id, db)
        if not content:
            continue
        entries = parse_log_content(content, batch_id, material.id)
        all_entries.extend(entries)

    if all_entries:
        save_parsed_logs(db, all_entries)

    category_counts: Dict[str, int] = {}
    anomaly_count = 0
    for entry in all_entries:
        cat = entry.category or "other"
        category_counts[cat] = category_counts.get(cat, 0) + 1
        if entry.is_anomaly:
            anomaly_count += 1

    batch.status = "parsed"
    db.commit()

    return {
        "batch_id": batch_id,
        "batch_no": batch.batch_no,
        "total_entries": len(all_entries),
        "category_counts": category_counts,
        "anomaly_count": anomaly_count,
        "materials_parsed": len(materials_to_parse),
    }


def list_parsed_logs(db: Session, batch_id: Optional[int] = None, category: Optional[str] = None,
                     is_anomaly: Optional[bool] = None, skip: int = 0, limit: int = 100) -> List[models.ParsedLogEntry]:
    query = db.query(models.ParsedLogEntry)
    if batch_id:
        query = query.filter(models.ParsedLogEntry.batch_id == batch_id)
    if category:
        query = query.filter(models.ParsedLogEntry.category == category)
    if is_anomaly is not None:
        query = query.filter(models.ParsedLogEntry.is_anomaly == is_anomaly)
    return query.order_by(models.ParsedLogEntry.id).offset(skip).limit(limit).all()
