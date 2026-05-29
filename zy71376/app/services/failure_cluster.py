import re
import hashlib
from typing import List, Dict, Optional, Tuple
from collections import defaultdict
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import ANOMALY_TYPES
from .material_service import get_batch, get_material


CLUSTER_PATTERNS = {
    "cache_miss_error": [
        r"cache.*key.*mismatch",
        r"cache.*fingerprint.*changed",
        r"unexpected.*cache.*miss",
        r"expected.*cache.*hit.*got.*miss",
        r"cache.*invalidated.*unexpectedly",
    ],
    "test_artifact_leftover": [
        r"leftover.*file.*from.*previous",
        r"previous.*build.*artifact.*detected",
        r"stale.*test.*result.*found",
        r"workspace.*not.*clean",
        r"target.*directory.*not.*empty",
    ],
    "env_var_drift": [
        r"environment.*variable.*changed",
        r"env.*var.*mismatch",
        r"version.*mismatch.*between.*runs",
        r"path.*contains.*unexpected.*entry",
        r"CI.*variable.*not.*set.*correctly",
    ],
    "dependency_conflict": [
        r"dependency.*conflict",
        r"version.*conflict",
        r"could.*not.*resolve.*dependency",
        r"requirement.*could.*not.*be.*satisfied",
        r"incompatible.*version",
    ],
}

NORMAL_RESULT_PATTERNS = [
    r"tests? passed",
    r"build successful",
    r"cache.*hit.*success",
    r"all.*checks? passed",
    r"deployment.*successful",
    r"no.*issues? found",
]


def generate_pattern_signature(patterns: List[str]) -> str:
    return hashlib.md5("|".join(sorted(patterns)).encode()).hexdigest()


def extract_error_signature(message: str) -> str:
    sig = re.sub(r"\d+", "NUM", message)
    sig = re.sub(r"[a-f0-9]{7,40}", "HASH", sig, flags=re.IGNORECASE)
    sig = re.sub(r"/[^/\s]+/", "/PATH/", sig)
    sig = re.sub(r"\s+", " ", sig).strip()
    return sig


def detect_anomaly_type(message: str) -> Optional[str]:
    msg_lower = message.lower()
    for anomaly_type, patterns in CLUSTER_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, msg_lower):
                return anomaly_type
    return None


def is_normal_result(message: str) -> bool:
    msg_lower = message.lower()
    for pattern in NORMAL_RESULT_PATTERNS:
        if re.search(pattern, msg_lower):
            return True
    return False


def cluster_failures(db: Session, batch_id: int) -> Dict:
    batch = get_batch(db, batch_id)
    if not batch:
        raise ValueError(f"Batch {batch_id} not found")

    anomaly_logs = db.query(models.ParsedLogEntry).filter(
        models.ParsedLogEntry.batch_id == batch_id,
        models.ParsedLogEntry.is_anomaly == True,
    ).all()

    cache_mismatches = db.query(models.CacheFingerprint).filter(
        models.CacheFingerprint.batch_id == batch_id,
        models.CacheFingerprint.status.in_(["mismatch", "unexpected_miss"]),
    ).all()

    all_materials = db.query(models.Material).filter(
        models.Material.batch_id == batch_id,
    ).all()
    material_ids = [m.id for m in all_materials]

    clusters: Dict[str, Dict] = defaultdict(lambda: {
        "cluster_type": "unknown",
        "title": "",
        "description": "",
        "severity": "medium",
        "log_ids": [],
        "material_ids": [],
        "fingerprint_ids": [],
        "patterns": [],
        "is_normal_result": False,
    })

    for log in anomaly_logs:
        anomaly_type = detect_anomaly_type(log.message) or detect_anomaly_type(log.raw_text)
        if anomaly_type:
            cluster_key = anomaly_type
            clusters[cluster_key]["cluster_type"] = anomaly_type
            clusters[cluster_key]["severity"] = "high"
            clusters[cluster_key]["patterns"].append(extract_error_signature(log.message))
        else:
            if is_normal_result(log.message):
                cluster_key = "normal_results"
                clusters[cluster_key]["cluster_type"] = "normal"
                clusters[cluster_key]["is_normal_result"] = True
                clusters[cluster_key]["severity"] = "info"
            else:
                sig = extract_error_signature(log.message)
                cluster_key = f"unknown_{hashlib.md5(sig.encode()).hexdigest()[:8]}"
                clusters[cluster_key]["cluster_type"] = "unknown"
                clusters[cluster_key]["patterns"].append(sig)

        if log.id not in clusters[cluster_key]["log_ids"]:
            clusters[cluster_key]["log_ids"].append(log.id)
        if log.material_id and log.material_id not in clusters[cluster_key]["material_ids"]:
            clusters[cluster_key]["material_ids"].append(log.material_id)

    for fp in cache_mismatches:
        cluster_key = "cache_miss_error"
        if cluster_key not in clusters:
            clusters[cluster_key] = {
                "cluster_type": "cache_miss_error",
                "title": "缓存命中错误",
                "description": "检测到缓存键指纹不匹配或意外的缓存未命中",
                "severity": "high",
                "log_ids": [],
                "material_ids": [],
                "fingerprint_ids": [],
                "patterns": [],
                "is_normal_result": False,
            }
        clusters[cluster_key]["fingerprint_ids"].append(fp.id)
        if fp.material_id and fp.material_id not in clusters[cluster_key]["material_ids"]:
            clusters[cluster_key]["material_ids"].append(fp.material_id)

    env_materials = [m for m in all_materials if m.material_type == "env_vars"]
    if len(env_materials) >= 2:
        drift_detected = check_env_var_drift(env_materials)
        if drift_detected:
            cluster_key = "env_var_drift"
            if cluster_key not in clusters:
                clusters[cluster_key] = {
                    "cluster_type": "env_var_drift",
                    "title": "环境变量漂移",
                    "description": "检测到不同运行之间环境变量存在差异",
                    "severity": "high",
                    "log_ids": [],
                    "material_ids": [m.id for m in env_materials],
                    "fingerprint_ids": [],
                    "patterns": [],
                    "is_normal_result": False,
                }

    saved_clusters = []
    saved_anomalies = []

    for cluster_key, cluster_data in clusters.items():
        if cluster_data["is_normal_result"]:
            title = "正常执行结果"
            description = "这些是正常的成功执行日志，已排除在异常分析之外"
            severity = "info"
        else:
            title = cluster_data.get("title") or ANOMALY_TYPES.get(cluster_data["cluster_type"], f"异常聚类: {cluster_key}")
            description = cluster_data.get("description") or f"检测到{len(cluster_data['log_ids'])}条相关异常日志"
            severity = cluster_data["severity"]

        pattern_sig = generate_pattern_signature(cluster_data["patterns"]) if cluster_data["patterns"] else cluster_key

        related_material_ids = list(set(cluster_data["material_ids"] + material_ids[:3]))
        sample_log_ids = cluster_data["log_ids"][:5]

        cluster_create = schemas.FailureClusterCreate(
            batch_id=batch_id,
            cluster_type=cluster_data["cluster_type"],
            title=title,
            description=description,
            severity=severity,
            affected_count=len(cluster_data["log_ids"]) + len(cluster_data["fingerprint_ids"]),
            sample_log_ids=sample_log_ids,
            related_material_ids=related_material_ids,
            pattern_signature=pattern_sig,
            is_normal_result=cluster_data["is_normal_result"],
            meta={
                "patterns": list(set(cluster_data["patterns"])),
                "fingerprint_ids": cluster_data["fingerprint_ids"],
            },
        )

        db_cluster = models.FailureCluster(
            batch_id=cluster_create.batch_id,
            cluster_type=cluster_create.cluster_type,
            title=cluster_create.title,
            description=cluster_create.description,
            severity=cluster_create.severity,
            affected_count=cluster_create.affected_count,
            sample_log_ids=cluster_create.sample_log_ids,
            related_material_ids=cluster_create.related_material_ids,
            pattern_signature=cluster_create.pattern_signature,
            is_normal_result=cluster_create.is_normal_result,
            meta=cluster_create.meta,
        )
        db.add(db_cluster)
        saved_clusters.append(db_cluster)

        if not cluster_data["is_normal_result"]:
            anomaly_create = schemas.AnomalyCreate(
                batch_id=batch_id,
                anomaly_type=cluster_data["cluster_type"],
                title=title,
                description=description,
                severity=severity,
                evidence_material_ids=cluster_data["material_ids"],
                evidence_log_ids=cluster_data["log_ids"],
                evidence_fingerprint_ids=cluster_data["fingerprint_ids"],
                status="identified",
                meta={
                    "cluster_patterns": list(set(cluster_data["patterns"])),
                },
            )

            db_anomaly = models.Anomaly(
                batch_id=anomaly_create.batch_id,
                anomaly_type=anomaly_create.anomaly_type,
                title=anomaly_create.title,
                description=anomaly_create.description,
                severity=anomaly_create.severity,
                evidence_material_ids=anomaly_create.evidence_material_ids,
                evidence_log_ids=anomaly_create.evidence_log_ids,
                evidence_fingerprint_ids=anomaly_create.evidence_fingerprint_ids,
                status=anomaly_create.status,
                meta=anomaly_create.meta,
            )
            db.add(db_anomaly)
            saved_anomalies.append(db_anomaly)

    db.commit()

    for cluster in saved_clusters:
        db.refresh(cluster)
    for anomaly in saved_anomalies:
        db.refresh(anomaly)

    anomaly_cluster_count = sum(1 for c in saved_clusters if not c.is_normal_result)
    normal_cluster_count = sum(1 for c in saved_clusters if c.is_normal_result)

    batch.status = "clustered"
    db.commit()

    return {
        "batch_id": batch_id,
        "batch_no": batch.batch_no,
        "total_clusters": len(saved_clusters),
        "anomaly_clusters": anomaly_cluster_count,
        "normal_clusters": normal_cluster_count,
        "anomalies_created": len(saved_anomalies),
        "cluster_details": [
            {
                "id": c.id,
                "type": c.cluster_type,
                "title": c.title,
                "severity": c.severity,
                "affected_count": c.affected_count,
                "is_normal": c.is_normal_result,
            }
            for c in saved_clusters
        ],
    }


def check_env_var_drift(env_materials: List[models.Material]) -> bool:
    env_sets = []
    for mat in env_materials:
        if mat.file_path:
            try:
                with open(mat.file_path, "r") as f:
                    content = f.read()
                env_vars = {}
                for line in content.splitlines():
                    if "=" in line and not line.strip().startswith("#"):
                        key, val = line.split("=", 1)
                        env_vars[key.strip()] = val.strip()
                env_sets.append(env_vars)
            except Exception:
                pass

    if len(env_sets) < 2:
        return False

    base_env = env_sets[0]
    for other_env in env_sets[1:]:
        if base_env != other_env:
            return True

    return False


def list_failure_clusters(db: Session, batch_id: Optional[int] = None,
                          include_normal: bool = False,
                          skip: int = 0, limit: int = 100) -> List[models.FailureCluster]:
    query = db.query(models.FailureCluster)
    if batch_id:
        query = query.filter(models.FailureCluster.batch_id == batch_id)
    if not include_normal:
        query = query.filter(models.FailureCluster.is_normal_result == False)
    return query.order_by(models.FailureCluster.severity.desc(), models.FailureCluster.affected_count.desc()).offset(skip).limit(limit).all()


def list_anomalies(db: Session, batch_id: Optional[int] = None,
                   anomaly_type: Optional[str] = None,
                   skip: int = 0, limit: int = 100) -> List[models.Anomaly]:
    query = db.query(models.Anomaly)
    if batch_id:
        query = query.filter(models.Anomaly.batch_id == batch_id)
    if anomaly_type:
        query = query.filter(models.Anomaly.anomaly_type == anomaly_type)
    return query.order_by(models.Anomaly.severity.desc()).offset(skip).limit(limit).all()
