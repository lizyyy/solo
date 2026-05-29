import re
import json
from typing import List, Dict, Optional, Tuple
from pathlib import Path
from sqlalchemy.orm import Session

from .. import models, schemas
from ..utils import generate_cache_fingerprint
from .material_service import get_batch, get_material, get_material_content, list_materials


DEPENDENCY_PATTERNS = {
    "requirements_txt": re.compile(r"^([\w\-_]+)\s*([<>=!~]+\s*[\w\.\-]+)?", re.MULTILINE),
    "package_json": re.compile(r'"([\w\-_]+)"\s*:\s*"([^"]+)"'),
    "pom_xml": re.compile(r"<(?:groupId>([^<]+)<\/groupId>\s*<artifactId>([^<]+)<\/artifactId>|artifactId>([^<]+)<\/artifactId>\s*<groupId>([^<]+)<\/groupId>)\s*<version>([^<]+)<\/version>", re.DOTALL),
    "build_gradle": re.compile(r"(?:implementation|compile|api)\s+['\"]?([\w\-\.]+):([\w\-\.]+):([\w\-\.]+)['\"]?"),
    "go_mod": re.compile(r"^([\w\-_\/\.]+)\s+v([\d\.\w\-]+)", re.MULTILINE),
    "cargo_toml": re.compile(r'^([\w\-_]+)\s*=\s*"([^"]+)"', re.MULTILINE),
}


def parse_requirements_txt(content: str) -> List[Dict]:
    deps = []
    for match in DEPENDENCY_PATTERNS["requirements_txt"].finditer(content):
        name = match.group(1).strip()
        version = match.group(2).strip() if match.group(2) else "unspecified"
        if not name.startswith("#") and name:
            deps.append({
                "name": name,
                "version": version,
                "manager": "pip",
            })
    return deps


def parse_package_json(content: str) -> List[Dict]:
    deps = []
    try:
        data = json.loads(content)
        for section in ["dependencies", "devDependencies", "peerDependencies"]:
            if section in data:
                for name, version in data[section].items():
                    deps.append({
                        "name": name,
                        "version": version,
                        "manager": "npm",
                        "section": section,
                    })
    except json.JSONDecodeError:
        for match in DEPENDENCY_PATTERNS["package_json"].finditer(content):
            deps.append({
                "name": match.group(1),
                "version": match.group(2),
                "manager": "npm",
            })
    return deps


def parse_pom_xml(content: str) -> List[Dict]:
    deps = []
    for match in DEPENDENCY_PATTERNS["pom_xml"].finditer(content):
        if match.group(1) and match.group(2):
            group_id = match.group(1)
            artifact_id = match.group(2)
        else:
            group_id = match.group(4)
            artifact_id = match.group(3)
        version = match.group(5)
        deps.append({
            "name": f"{group_id}:{artifact_id}",
            "version": version,
            "manager": "maven",
        })
    return deps


def parse_build_gradle(content: str) -> List[Dict]:
    deps = []
    for match in DEPENDENCY_PATTERNS["build_gradle"].finditer(content):
        deps.append({
            "name": f"{match.group(1)}:{match.group(2)}",
            "version": match.group(3),
            "manager": "gradle",
        })
    return deps


def parse_go_mod(content: str) -> List[Dict]:
    deps = []
    for match in DEPENDENCY_PATTERNS["go_mod"].finditer(content):
        deps.append({
            "name": match.group(1),
            "version": match.group(2),
            "manager": "go",
        })
    return deps


def parse_cargo_toml(content: str) -> List[Dict]:
    deps = []
    in_deps = False
    for line in content.splitlines():
        if "[dependencies]" in line:
            in_deps = True
            continue
        if line.startswith("[") and in_deps:
            break
        if in_deps:
            match = DEPENDENCY_PATTERNS["cargo_toml"].match(line.strip())
            if match:
                deps.append({
                    "name": match.group(1),
                    "version": match.group(2),
                    "manager": "cargo",
                })
    return deps


def parse_dependency_content(content: str, filename: str) -> List[Dict]:
    filename_lower = filename.lower()
    if "requirements" in filename_lower and filename_lower.endswith(".txt"):
        return parse_requirements_txt(content)
    elif "package.json" in filename_lower:
        return parse_package_json(content)
    elif "pom.xml" in filename_lower:
        return parse_pom_xml(content)
    elif "build.gradle" in filename_lower:
        return parse_build_gradle(content)
    elif "go.mod" in filename_lower:
        return parse_go_mod(content)
    elif "cargo.toml" in filename_lower:
        return parse_cargo_toml(content)
    else:
        return parse_requirements_txt(content)


def compute_dependency_fingerprint(dep: Dict, extra_data: str = "") -> str:
    data = f"{dep.get('manager', '')}:{dep.get('name', '')}:{dep.get('version', '')}:{extra_data}"
    return generate_cache_fingerprint(data)


def extract_cache_keys_from_logs(db: Session, batch_id: int) -> Dict[str, Dict]:
    cache_info = {}
    logs = db.query(models.ParsedLogEntry).filter(
        models.ParsedLogEntry.batch_id == batch_id,
        models.ParsedLogEntry.category == "cache",
    ).all()

    for log in logs:
        meta = log.meta or {}
        cache_key = meta.get("cache_key")
        if cache_key:
            if cache_key not in cache_info:
                cache_info[cache_key] = {
                    "fingerprints": [],
                    "hits": 0,
                    "misses": 0,
                    "errors": 0,
                    "log_ids": [],
                }
            cache_info[cache_key]["log_ids"].append(log.id)
            if meta.get("fingerprint"):
                cache_info[cache_key]["fingerprints"].append(meta["fingerprint"])
            if "hit" in log.message.lower():
                cache_info[cache_key]["hits"] += 1
            if "miss" in log.message.lower():
                cache_info[cache_key]["misses"] += 1
            if log.is_anomaly:
                cache_info[cache_key]["errors"] += 1

    return cache_info


def analyze_cache_fingerprints(db: Session, batch_id: int, material_id: Optional[int] = None) -> Dict:
    batch = get_batch(db, batch_id)
    if not batch:
        raise ValueError(f"Batch {batch_id} not found")

    materials_to_analyze = []
    if material_id:
        material = get_material(db, material_id)
        if not material:
            raise ValueError(f"Material {material_id} not found")
        materials_to_analyze.append(material)
    else:
        materials = list_materials(db, batch_id=batch_id, material_type="dependency_cache")
        if not materials:
            materials = list_materials(db, batch_id=batch_id)
        materials_to_analyze = materials

    all_fingerprints = []
    cache_keys_from_logs = extract_cache_keys_from_logs(db, batch_id)

    for material in materials_to_analyze:
        content = get_material_content(material.id, db)
        if not content:
            continue

        filename = material.name
        deps = parse_dependency_content(content, filename)

        for dep in deps:
            cache_key = f"{dep.get('manager', 'unknown')}:{dep.get('name', 'unknown')}"
            actual_fingerprint = compute_dependency_fingerprint(dep)

            expected_fingerprint = None
            status = "matched"

            if cache_key in cache_keys_from_logs:
                log_fingerprints = cache_keys_from_logs[cache_key]["fingerprints"]
                if log_fingerprints:
                    expected_fingerprint = log_fingerprints[0]
                    if actual_fingerprint not in log_fingerprints:
                        status = "mismatch"
                    elif cache_keys_from_logs[cache_key]["misses"] > 0 and cache_keys_from_logs[cache_key]["hits"] == 0:
                        status = "unexpected_miss"

            fp_create = schemas.CacheFingerprintCreate(
                batch_id=batch_id,
                material_id=material.id,
                cache_key=cache_key,
                fingerprint=actual_fingerprint,
                expected_fingerprint=expected_fingerprint,
                status=status,
                dependency_name=dep.get("name"),
                dependency_version=dep.get("version"),
                meta={
                    "manager": dep.get("manager"),
                    "section": dep.get("section"),
                },
            )
            all_fingerprints.append(fp_create)

    saved_fingerprints = []
    for fp in all_fingerprints:
        db_fp = models.CacheFingerprint(
            batch_id=fp.batch_id,
            material_id=fp.material_id,
            cache_key=fp.cache_key,
            fingerprint=fp.fingerprint,
            expected_fingerprint=fp.expected_fingerprint,
            status=fp.status,
            dependency_name=fp.dependency_name,
            dependency_version=fp.dependency_version,
            meta=fp.meta,
        )
        db.add(db_fp)
        saved_fingerprints.append(db_fp)
    db.commit()

    for fp in saved_fingerprints:
        db.refresh(fp)

    status_counts: Dict[str, int] = {}
    for fp in all_fingerprints:
        status_counts[fp.status] = status_counts.get(fp.status, 0) + 1

    mismatch_count = status_counts.get("mismatch", 0) + status_counts.get("unexpected_miss", 0)

    batch.status = "fingerprint_analyzed"
    db.commit()

    return {
        "batch_id": batch_id,
        "batch_no": batch.batch_no,
        "total_fingerprints": len(all_fingerprints),
        "status_counts": status_counts,
        "mismatch_count": mismatch_count,
        "cache_keys_from_logs": len(cache_keys_from_logs),
        "materials_analyzed": len(materials_to_analyze),
    }


def list_cache_fingerprints(db: Session, batch_id: Optional[int] = None, status: Optional[str] = None,
                            skip: int = 0, limit: int = 100) -> List[models.CacheFingerprint]:
    query = db.query(models.CacheFingerprint)
    if batch_id:
        query = query.filter(models.CacheFingerprint.batch_id == batch_id)
    if status:
        query = query.filter(models.CacheFingerprint.status == status)
    return query.order_by(models.CacheFingerprint.id).offset(skip).limit(limit).all()
