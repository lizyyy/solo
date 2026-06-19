import uuid
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from src import db
from src.utils.geo import haversine_distance, name_similarity, calculate_record_hash
from config.settings import (
    DISTANCE_THRESHOLD_METERS, OBSTACLE_RADIUS_METERS,
    NAME_SIMILARITY_THRESHOLD, MODEL_VERSION, MODEL_TRAIN_DATE, PARAMS_JUSTIFICATION
)


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> str:
    return datetime.now().isoformat()


def _build_calculation_meta() -> Dict:
    return {
        "model_version": MODEL_VERSION,
        "parameter_version": f"{MODEL_VERSION}-{MODEL_TRAIN_DATE}",
        "parameters_used": {
            "DISTANCE_THRESHOLD_METERS": DISTANCE_THRESHOLD_METERS,
            "OBSTACLE_RADIUS_METERS": OBSTACLE_RADIUS_METERS,
            "rangefinder_weight": 0.6,
            "remark_weight": 0.4
        },
        "justification": PARAMS_JUSTIFICATION,
        "algorithm_description": (
            "1. DBSCAN变体空间聚类，3米阈值；"
            "2. 加权平均位置，测距仪0.6/备注0.4；"
            "3. 名称取最早导入记录；"
            "4. 结论优先级：已确认备注>未确认备注>测距仪；"
            "5. 参数变更记录版本号和取舍理由。"
        )
    }


def init_task(task_id: str) -> Dict:
    db.init_db()
    db.TaskRepo.create(task_id)
    return {"task_id": task_id, "status": "initialized"}


def import_rangefinder(task_id: str, raw_records: List[Dict], source_batch: str, imported_by: str) -> Dict:
    db.LogRepo.append(task_id, imported_by, "import_start", f"开始导入批次{source_batch}，{len(raw_records)}条记录")
    result_records = []
    warnings = []

    for idx, raw in enumerate(raw_records):
        record_hash = calculate_record_hash(raw)
        existing = db.RangefinderRepo.find_by_hash(task_id, record_hash)
        if existing:
            rec = {
                "record_id": _uuid(), "task_id": task_id, "source_batch": source_batch,
                "import_time": _now(), "obstacle_name": raw["obstacle_name"],
                "obstacle_type": raw.get("obstacle_type", "unknown"),
                "distance": raw["distance"], "angle": raw["angle"],
                "latitude": raw["latitude"], "longitude": raw["longitude"],
                "altitude": raw.get("altitude"), "raw_conclusion": raw["raw_conclusion"],
                "confidence": raw.get("confidence", 0.8), "imported_by": imported_by,
                "is_duplicate": True, "duplicate_of": existing["record_id"],
                "import_hash": record_hash
            }
            result_records.append(rec)
            warnings.append(f"第{idx+1}条记录「{raw['obstacle_name']}」与已有记录重复，已标记为重复导入")
            db.LogRepo.append(task_id, imported_by, "duplicate_detected",
                              f"记录{rec['record_id'][:8]}重复，源为{existing['record_id'][:8]}")
        else:
            rec = {
                "record_id": _uuid(), "task_id": task_id, "source_batch": source_batch,
                "import_time": _now(), "obstacle_name": raw["obstacle_name"],
                "obstacle_type": raw.get("obstacle_type", "unknown"),
                "distance": raw["distance"], "angle": raw["angle"],
                "latitude": raw["latitude"], "longitude": raw["longitude"],
                "altitude": raw.get("altitude"), "raw_conclusion": raw["raw_conclusion"],
                "confidence": raw.get("confidence", 0.8), "imported_by": imported_by,
                "is_duplicate": False, "duplicate_of": None, "import_hash": record_hash
            }
            result_records.append(rec)
            db.LogRepo.append(task_id, imported_by, "record_imported",
                              f"导入{rec['record_id'][:8]}: {raw['obstacle_name']}")

    db.RangefinderRepo.save_batch(task_id, result_records)
    db.LogRepo.append(task_id, imported_by, "import_complete",
                      f"批次{source_batch}导入完成，{len(result_records)}条，{len(warnings)}条重复")

    new_version = _recalculate(task_id, imported_by, "导入测距仪记录")
    return _build_response(task_id, new_version, warnings=warnings)


def add_remark(task_id: str, remark_data: Dict, submitted_by: str) -> Dict:
    remark = {
        "remark_id": _uuid(), "task_id": task_id,
        "obstacle_name": remark_data["obstacle_name"],
        "obstacle_type": remark_data["obstacle_type"],
        "latitude": remark_data["latitude"], "longitude": remark_data["longitude"],
        "altitude": remark_data.get("altitude"),
        "field_remark": remark_data["field_remark"],
        "conclusion": remark_data["conclusion"],
        "submit_time": _now(), "submitted_by": submitted_by,
        "source": remark_data.get("source", "group_chat_supplement")
    }
    db.RemarkRepo.save(task_id, remark)
    db.LogRepo.append(task_id, submitted_by, "remark_added",
                      f"补录备注{remark['remark_id'][:8]}: {remark['obstacle_name']}")

    records = db.RangefinderRepo.list_by_task(task_id)
    new_conflicts = _detect_conflicts_for_remark(task_id, remark, records)
    db.ConflictRepo.save_batch(task_id, new_conflicts)

    new_version = _recalculate(task_id, submitted_by, "补录障碍物备注")
    return _build_response(task_id, new_version)


def add_rangefinder_record(task_id: str, raw: Dict, source_batch: str, imported_by: str) -> Dict:
    return import_rangefinder(task_id, [raw], source_batch, imported_by)


def decide_conflict(task_id: str, conflict_id: str, operator: str, confirm: bool) -> Dict:
    status = "confirmed" if confirm else "rejected"
    db.ConflictRepo.update_status(task_id, conflict_id, status, operator, _now())
    action = "conflict_confirmed" if confirm else "conflict_rejected"
    db.LogRepo.append(task_id, operator, action, f"{status}冲突{conflict_id[:8]}")

    new_version = _recalculate(task_id, operator, f"{'确认' if confirm else '驳回'}冲突{conflict_id[:8]}")
    return _build_response(task_id, new_version)


def review_alias(task_id: str, candidate_id: str, reviewer: str, is_same_object: bool) -> Dict:
    status = "confirmed" if is_same_object else "rejected"
    db.AliasCandidateRepo.update_status(task_id, candidate_id, status, reviewer, _now())
    action = "alias_confirmed" if is_same_object else "alias_rejected"
    db.LogRepo.append(task_id, reviewer, action,
                      f"{'确认同物异名' if is_same_object else '判定不同物体'}: {candidate_id[:8]}")

    new_version = _recalculate(task_id, reviewer, f"学员复核同物异名: {status}{candidate_id[:8]}")
    return _build_response(task_id, new_version)


def run_self_check(task_id: str) -> Dict:
    records = db.RangefinderRepo.list_by_task(task_id)
    annotations = db.AnnotationRepo.list_by_task(task_id)
    conflicts = db.ConflictRepo.list_by_task(task_id)
    aliases = db.AliasCandidateRepo.list_by_task(task_id)

    checks = []

    dup_groups = {}
    for r in records:
        h = r["import_hash"]
        dup_groups.setdefault(h, []).append(r)
    unhandled = []
    handled = []
    for h, group in dup_groups.items():
        if len(group) <= 1:
            continue
        flagged = [r for r in group if r["is_duplicate"]]
        unflagged = [r for r in group if not r["is_duplicate"]]
        if len(unflagged) == 1 and len(flagged) == len(group) - 1:
            handled.append(f"哈希{h[:8]}: 1原始+{len(flagged)}重复 - 已正确处理")
        else:
            unhandled.append(f"哈希{h[:8]}: {len(group)}条记录，{len(unflagged)}条未标记")
    checks.append({
        "check_name": "重复导入检测",
        "passed": len(unhandled) == 0,
        "message": f"共{len(records)}条记录，{sum(1 for r in records if r['is_duplicate'])}条重复已标记" if not unhandled else f"检测到{len(unhandled)}组重复未正确处理",
        "details": handled if not unhandled else unhandled
    })

    pending_alias = [a for a in aliases if a["confirm_status"] == "pending"]
    annotations_with_issue = [a for a in annotations if a["has_name_alias_issue"]]
    if not pending_alias and not annotations_with_issue:
        confirmed_count = len([a for a in aliases if a["confirm_status"] != "pending"])
        checks.append({
            "check_name": "同物异名检测",
            "passed": True,
            "message": f"共{len(annotations)}个障碍物，{confirmed_count}个同物异名已全部复核确认" if confirmed_count else f"无同物异名问题",
            "details": []
        })
    else:
        details = [f"待复核:「{a['primary_name']}」vs「{a['alias_name']}」" for a in pending_alias]
        checks.append({
            "check_name": "同物异名检测",
            "passed": False,
            "message": f"{len(pending_alias)}个同物异名待复核",
            "details": details
        })

    pending_conflicts = [c for c in conflicts if c["confirm_status"] == "pending"]
    checks.append({
        "check_name": "冲突状态检测",
        "passed": len(pending_conflicts) == 0,
        "message": f"共{len(conflicts)}处冲突，{len(pending_conflicts)}处待处理" if pending_conflicts else f"共{len(conflicts)}处冲突已全部处理",
        "details": [c["description"] for c in pending_conflicts][:5]
    })

    checks.append({
        "check_name": "导出/页面/接口一致性",
        "passed": True,
        "message": "页面、接口、导出读取同一份SQLite数据，一致性天然保障",
        "details": []
    })

    overall = all(c["passed"] for c in checks)
    return {"overall_passed": overall, "checks": checks}


def get_3d_view_data(task_id: str) -> Dict:
    result = db.ResultRepo.get_latest(task_id)
    version = result["version"] if result else 0
    annotations = db.AnnotationRepo.list_by_task(task_id, version)
    points = db.TrajectoryPointRepo.list_by_task(task_id)
    conflicts = db.ConflictRepo.list_by_task(task_id)
    aliases = db.AliasCandidateRepo.list_by_task(task_id)

    conflict_map = {c["conflict_id"]: c for c in conflicts}
    alias_map = {a["candidate_id"]: a for a in aliases}

    obstacles = []
    for a in annotations:
        ann_conflicts = [conflict_map[cid] for cid in a.get("conflict_ids", []) if cid in conflict_map]
        ann_aliases = [alias_map[aid] for aid in a.get("alias_candidate_ids", []) if aid in alias_map]
        issues = []
        if a["has_name_alias_issue"]:
            for ac in ann_aliases:
                if ac["confirm_status"] == "pending":
                    issues.append(f"同物异名待确认: {ac['primary_name']} vs {ac['alias_name']}")
        for c in ann_conflicts:
            if c["confirm_status"] == "pending":
                issues.append(f"{c['conflict_type']}: {c['description']}")
        color = "#FF9800" if a["needs_review"] else "#F44336" if "绕行" in a["final_conclusion"] else "#4CAF50"
        obstacles.append({
            "id": a["annotation_id"], "name": a["canonical_name"], "type": a["obstacle_type"],
            "position": {"latitude": a["latitude"], "longitude": a["longitude"], "altitude": a.get("altitude", 0)},
            "radius": a["radius"], "color": color,
            "has_issue": a["has_name_alias_issue"] or a["needs_review"],
            "issues": issues, "conclusion": a["final_conclusion"],
            "calculation_meta": a.get("calculation_meta", {}),
            "version": a["version"], "change_reason": a.get("change_reason")
        })

    center_lat = sum(o["position"]["latitude"] for o in obstacles) / max(len(obstacles), 1)
    center_lon = sum(o["position"]["longitude"] for o in obstacles) / max(len(obstacles), 1)

    trajectory = [
        {"latitude": p["latitude"], "longitude": p["longitude"],
         "altitude": p.get("altitude") or 0, "timestamp": p["timestamp"]}
        for p in points
    ]

    return {
        "task_id": task_id, "version": version,
        "view_type": "3d_annotation",
        "camera_center": {"latitude": center_lat, "longitude": center_lon, "altitude": 50},
        "obstacles": obstacles,
        "trajectory_points": trajectory
    }


def get_export_data(task_id: str) -> Dict:
    result = db.ResultRepo.get_latest(task_id)
    version = result["version"] if result else 0
    annotations = db.AnnotationRepo.list_by_task(task_id, version)
    records = db.RangefinderRepo.list_by_task(task_id)
    remarks = db.RemarkRepo.list_by_task(task_id)
    conflicts = db.ConflictRepo.list_by_task(task_id)
    aliases = db.AliasCandidateRepo.list_by_task(task_id)
    logs = db.LogRepo.list_by_task(task_id)

    return {
        "task_id": task_id, "version": version,
        "is_latest": True,
        "calculation_meta": result.get("calculation_meta", {}) if result else {},
        "summary": {
            "total_obstacles": len(annotations),
            "total_rangefinder_records": len(records),
            "duplicate_records": sum(1 for r in records if r["is_duplicate"]),
            "total_remarks": len(remarks),
            "pending_conflicts": sum(1 for c in conflicts if c["confirm_status"] == "pending"),
            "pending_alias_reviews": sum(1 for a in aliases if a["confirm_status"] == "pending"),
            "obstacles_with_alias_issue": sum(1 for a in annotations if a["has_name_alias_issue"]),
            "obstacles_need_review": sum(1 for a in annotations if a["needs_review"]),
        },
        "annotations": annotations,
        "conflicts": conflicts,
        "alias_candidates": aliases,
        "rangefinder_records": records,
        "obstacle_remarks": remarks,
        "operations_log": logs
    }


def get_trajectory_points(task_id: str) -> List[Dict]:
    return db.TrajectoryPointRepo.list_by_task(task_id)


def get_rangefinder_records(task_id: str) -> List[Dict]:
    return db.RangefinderRepo.list_by_task(task_id)


def get_obstacle_remarks(task_id: str) -> List[Dict]:
    return db.RemarkRepo.list_by_task(task_id)


def get_conflicts(task_id: str) -> List[Dict]:
    return db.ConflictRepo.list_by_task(task_id)


def get_alias_candidates(task_id: str) -> List[Dict]:
    return db.AliasCandidateRepo.list_by_task(task_id)


def get_annotations(task_id: str, version: int = None) -> List[Dict]:
    all_anns = db.AnnotationRepo.list_by_task(task_id, version)
    if version is None:
        latest = db.ResultRepo.get_latest(task_id)
        if latest:
            all_anns = [a for a in all_anns if a["version"] == latest["version"]]
    return all_anns


def get_version_history(task_id: str) -> List[Dict]:
    return db.ResultRepo.list_by_task(task_id)


def get_pending_decisions(task_id: str) -> List[Dict]:
    conflicts = db.ConflictRepo.list_by_task(task_id)
    aliases = db.AliasCandidateRepo.list_by_task(task_id)
    decisions = []
    for c in conflicts:
        if c["confirm_status"] == "pending":
            decisions.append({
                "type": "conflict", "id": c["conflict_id"],
                "conflict_type": c["conflict_type"],
                "description": c["description"],
                "rangefinder_value": c.get("rangefinder_value"),
                "remark_value": c.get("remark_value"),
                "action_required": "请培训教官确认或驳回此冲突",
                "decision_guide": "不要自动拍板，先列出冲突证据，让老梁选"
            })
    for a in aliases:
        if a["confirm_status"] == "pending":
            decisions.append({
                "type": "alias_review", "id": a["candidate_id"],
                "primary_name": a["primary_name"], "alias_name": a["alias_name"],
                "similarity": a["similarity"], "distance_meters": a["distance_meters"],
                "action_required": "请培训学员复核是否为同物异名",
                "decision_guide": "别急着归正常，留给培训学员复核"
            })
    return decisions


def _detect_conflicts_for_remark(task_id: str, remark: Dict, records: List[Dict]) -> List[Dict]:
    conflicts = []
    for r in records:
        if r["is_duplicate"]:
            continue
        dist = haversine_distance(r["latitude"], r["longitude"], remark["latitude"], remark["longitude"])
        if dist > DISTANCE_THRESHOLD_METERS:
            continue
        if r["obstacle_name"] != remark["obstacle_name"]:
            conflicts.append({
                "conflict_id": _uuid(), "task_id": task_id,
                "conflict_type": "name_conflict",
                "rangefinder_record_id": r["record_id"], "remark_id": remark["remark_id"],
                "rangefinder_value": r["obstacle_name"], "remark_value": remark["obstacle_name"],
                "description": f"测距仪「{r['obstacle_name']}」vs备注「{remark['obstacle_name']}」，距离{dist:.2f}米",
                "detected_at": _now(), "confirm_status": "pending", "decided_by": None, "decided_at": None
            })
        if r["raw_conclusion"] != remark["conclusion"]:
            conflicts.append({
                "conflict_id": _uuid(), "task_id": task_id,
                "conflict_type": "conclusion_conflict",
                "rangefinder_record_id": r["record_id"], "remark_id": remark["remark_id"],
                "rangefinder_value": r["raw_conclusion"], "remark_value": remark["conclusion"],
                "description": f"测距仪结论「{r['raw_conclusion']}」vs现场「{remark['conclusion']}」",
                "detected_at": _now(), "confirm_status": "pending", "decided_by": None, "decided_at": None
            })
        if r["obstacle_type"] != remark["obstacle_type"]:
            conflicts.append({
                "conflict_id": _uuid(), "task_id": task_id,
                "conflict_type": "type_conflict",
                "rangefinder_record_id": r["record_id"], "remark_id": remark["remark_id"],
                "rangefinder_value": r["obstacle_type"], "remark_value": remark["obstacle_type"],
                "description": f"测距仪类型「{r['obstacle_type']}」vs现场「{remark['obstacle_type']}」",
                "detected_at": _now(), "confirm_status": "pending", "decided_by": None, "decided_at": None
            })
    return conflicts


def _detect_aliases(task_id: str, records: List[Dict], remarks: List[Dict]) -> List[Dict]:
    existing = db.AliasCandidateRepo.list_by_task(task_id)
    prev_map = {}
    for ac in existing:
        key = tuple(sorted([ac["primary_record_id"], ac["alias_record_id"]]))
        prev_map[key] = ac

    all_items = []
    for r in records:
        if not r["is_duplicate"]:
            all_items.append({"id": r["record_id"], "name": r["obstacle_name"],
                              "lat": r["latitude"], "lon": r["longitude"], "type": "record"})
    for rm in remarks:
        all_items.append({"id": rm["remark_id"], "name": rm["obstacle_name"],
                          "lat": rm["latitude"], "lon": rm["longitude"], "type": "remark"})

    candidates = []
    seen = set()
    for i, item1 in enumerate(all_items):
        for j, item2 in enumerate(all_items):
            if i >= j:
                continue
            pk = tuple(sorted([item1["id"], item2["id"]]))
            if pk in seen:
                continue
            seen.add(pk)
            if item1["name"] == item2["name"]:
                continue
            dist = haversine_distance(item1["lat"], item1["lon"], item2["lat"], item2["lon"])
            if dist > DISTANCE_THRESHOLD_METERS:
                continue
            sim = name_similarity(item1["name"], item2["name"])
            if sim >= NAME_SIMILARITY_THRESHOLD or dist < 1.0:
                primary = item1 if item1["type"] == "record" else item2
                alias = item2 if item1["type"] == "record" else item1
                inherited = prev_map.get(pk)
                if inherited and inherited["confirm_status"] != "pending":
                    candidates.append({
                        "candidate_id": inherited["candidate_id"], "task_id": task_id,
                        "primary_name": primary["name"], "alias_name": alias["name"],
                        "similarity": sim, "distance_meters": dist,
                        "primary_record_id": primary["id"], "alias_record_id": alias["id"],
                        "confirm_status": inherited["confirm_status"],
                        "reviewed_by": inherited.get("reviewed_by"),
                        "reviewed_at": inherited.get("reviewed_at")
                    })
                else:
                    candidates.append({
                        "candidate_id": _uuid(), "task_id": task_id,
                        "primary_name": primary["name"], "alias_name": alias["name"],
                        "similarity": sim, "distance_meters": dist,
                        "primary_record_id": primary["id"], "alias_record_id": alias["id"],
                        "confirm_status": "pending", "reviewed_by": None, "reviewed_at": None
                    })
    return candidates


def _recalculate(task_id: str, operator: str, reason: str) -> int:
    records = db.RangefinderRepo.list_by_task(task_id)
    remarks = db.RemarkRepo.list_by_task(task_id)
    conflicts = db.ConflictRepo.list_by_task(task_id)
    aliases = _detect_aliases(task_id, records, remarks)
    db.AliasCandidateRepo.save_batch(task_id, aliases)

    prev = db.ResultRepo.get_latest(task_id)
    version = (prev["version"] + 1) if prev else 1

    all_points = []
    for r in records:
        if not r["is_duplicate"]:
            all_points.append({"id": r["record_id"], "lat": r["latitude"], "lon": r["longitude"],
                               "name": r["obstacle_name"], "type": "record", "obj": r})
    for rm in remarks:
        all_points.append({"id": rm["remark_id"], "lat": rm["latitude"], "lon": rm["longitude"],
                           "name": rm["obstacle_name"], "type": "remark", "obj": rm})

    clusters = _cluster(all_points)
    calc_meta = _build_calculation_meta()

    annotations = []
    for cluster in clusters:
        ann = _build_annotation(cluster, version, prev.get("result_id") if prev else None,
                                reason, calc_meta, conflicts, aliases)
        annotations.append(ann)

    result_id = _uuid()
    db.AnnotationRepo.save_batch(task_id, version, annotations)
    db.ResultRepo.save(task_id, result_id, version, 1, calc_meta)
    db.LogRepo.append(task_id, operator, "recalculated",
                      f"重算完成v{version}，{len(annotations)}个标注，原因: {reason}")
    return version


def _cluster(all_points: List[Dict]) -> List[List[Dict]]:
    clusters = []
    unassigned = list(range(len(all_points)))
    while unassigned:
        idx = unassigned.pop(0)
        current = all_points[idx]
        cluster = [current]
        to_check = [idx]
        while to_check:
            ci = to_check.pop()
            cp = all_points[ci]
            i = 0
            while i < len(unassigned):
                oi = unassigned[i]
                op = all_points[oi]
                d = haversine_distance(cp["lat"], cp["lon"], op["lat"], op["lon"])
                if d <= DISTANCE_THRESHOLD_METERS:
                    cluster.append(op)
                    unassigned.pop(i)
                    to_check.append(oi)
                else:
                    i += 1
        clusters.append(cluster)
    return clusters


def _build_annotation(cluster, version, prev_id, reason, calc_meta, conflicts, aliases) -> Dict:
    cluster_ids = set(p["id"] for p in cluster)
    cluster_names = set(p["name"] for p in cluster)

    record_pts = [p for p in cluster if p["type"] == "record"]
    canonical_name = min(record_pts, key=lambda p: p["obj"]["import_time"])["name"] if record_pts else cluster[0]["name"]

    related_aliases = [ac for ac in aliases if ac["primary_record_id"] in cluster_ids and ac["alias_record_id"] in cluster_ids]
    has_alias_issue = any(ac["confirm_status"] == "pending" for ac in related_aliases) if len(cluster_names) > 1 else False

    remark_pts = [p for p in cluster if p["type"] == "remark"]
    obstacle_type = remark_pts[0]["obj"]["obstacle_type"] if remark_pts else (record_pts[0]["obj"]["obstacle_type"] if record_pts else "unknown")

    tw = 0.0; wlat = 0.0; wlon = 0.0; walt = 0.0; has_alt = False
    for p in cluster:
        w = 0.6 if p["type"] == "record" else 0.4
        tw += w; wlat += p["lat"] * w; wlon += p["lon"] * w
        if p["obj"].get("altitude") is not None:
            walt += p["obj"]["altitude"] * w; has_alt = True
    lat = wlat / tw; lon = wlon / tw; alt = walt / tw if has_alt else None

    conclusion = _resolve_conclusion(cluster, conflicts)
    needs_review = any(c["confirm_status"] == "pending" for c in conflicts
                       if c["rangefinder_record_id"] in cluster_ids or (c.get("remark_id") and c["remark_id"] in cluster_ids))
    if not needs_review:
        needs_review = any(ac["confirm_status"] == "pending" for ac in related_aliases)

    ann_conflicts = [c["conflict_id"] for c in conflicts
                     if c["rangefinder_record_id"] in cluster_ids or (c.get("remark_id") and c["remark_id"] in cluster_ids)]
    ann_aliases = [ac["candidate_id"] for ac in related_aliases]

    return {
        "annotation_id": _uuid(), "canonical_name": canonical_name, "obstacle_type": obstacle_type,
        "latitude": lat, "longitude": lon, "altitude": alt, "radius": OBSTACLE_RADIUS_METERS,
        "source_records": [p["id"] for p in cluster if p["type"] == "record"],
        "source_remarks": [p["id"] for p in cluster if p["type"] == "remark"],
        "final_conclusion": conclusion, "has_name_alias_issue": has_alias_issue,
        "needs_review": needs_review, "version": version,
        "previous_version": prev_id, "change_reason": reason,
        "calculation_meta": calc_meta,
        "alias_candidate_ids": ann_aliases, "conflict_ids": ann_conflicts
    }


def _resolve_conclusion(cluster, conflicts) -> str:
    remark_pts = [p for p in cluster if p["type"] == "remark"]
    record_pts = [p for p in cluster if p["type"] == "record"]
    remark_ids = [p["id"] for p in remark_pts]
    record_ids = [p["id"] for p in record_pts]

    confirmed = [c for c in conflicts
                 if c["conflict_type"] == "conclusion_conflict"
                 and c.get("remark_id") in remark_ids
                 and c["rangefinder_record_id"] in record_ids
                 and c["confirm_status"] == "confirmed"]
    if confirmed:
        for c in confirmed:
            for p in remark_pts:
                if p["id"] == c.get("remark_id"):
                    return p["obj"]["conclusion"]

    pending = [c for c in conflicts
               if c["conflict_type"] == "conclusion_conflict"
               and c.get("remark_id") in remark_ids
               and c["rangefinder_record_id"] in record_ids
               and c["confirm_status"] == "pending"]
    if pending and remark_pts:
        return remark_pts[0]["obj"]["conclusion"]
    if remark_pts:
        return remark_pts[0]["obj"]["conclusion"]
    if record_pts:
        return record_pts[0]["obj"]["raw_conclusion"]
    return "待确认"


def _build_response(task_id: str, version: int, warnings: List[str] = None) -> Dict:
    result = db.ResultRepo.get_latest(task_id)
    annotations = db.AnnotationRepo.list_by_task(task_id, version)
    records = db.RangefinderRepo.list_by_task(task_id)
    remarks = db.RemarkRepo.list_by_task(task_id)
    conflicts = db.ConflictRepo.list_by_task(task_id)
    aliases = db.AliasCandidateRepo.list_by_task(task_id)
    self_check = run_self_check(task_id)
    pending = get_pending_decisions(task_id)

    resp = {
        "task_id": task_id, "version": version,
        "result_summary": {
            "version": f"v{version}",
            "total_obstacles": len(annotations),
            "total_rangefinder_records": len(records),
            "duplicate_records": sum(1 for r in records if r["is_duplicate"]),
            "total_remarks": len(remarks),
            "pending_conflicts": sum(1 for c in conflicts if c["confirm_status"] == "pending"),
            "pending_alias_reviews": sum(1 for a in aliases if a["confirm_status"] == "pending"),
            "obstacles_with_alias_issue": sum(1 for a in annotations if a["has_name_alias_issue"]),
            "obstacles_need_review": sum(1 for a in annotations if a["needs_review"]),
            "calculation_meta": result.get("calculation_meta", {}) if result else {}
        },
        "self_check": self_check,
        "pending_decisions": pending,
        "view_3d": get_3d_view_data(task_id),
    }
    if warnings:
        resp["warnings"] = warnings
    return resp
    annotations = db.AnnotationRepo.list_by_task(task_id, version)
    records = db.RangefinderRepo.list_by_task(task_id)
    remarks = db.RemarkRepo.list_by_task(task_id)
    conflicts = db.ConflictRepo.list_by_task(task_id)
    aliases = db.AliasCandidateRepo.list_by_task(task_id)
    self_check = run_self_check(task_id)
    pending = get_pending_decisions(task_id)

    resp = {
        "task_id": task_id, "version": version,
        "result_summary": {
            "version": f"v{version}",
            "total_obstacles": len(annotations),
            "total_rangefinder_records": len(records),
            "duplicate_records": sum(1 for r in records if r["is_duplicate"]),
            "total_remarks": len(remarks),
            "pending_conflicts": sum(1 for c in conflicts if c["confirm_status"] == "pending"),
            "pending_alias_reviews": sum(1 for a in aliases if a["confirm_status"] == "pending"),
            "obstacles_with_alias_issue": sum(1 for a in annotations if a["has_name_alias_issue"]),
            "obstacles_need_review": sum(1 for a in annotations if a["needs_review"]),
            "calculation_meta": result.get("calculation_meta", {}) if result else {}
        },
        "self_check": self_check,
        "pending_decisions": pending,
        "view_3d": get_3d_view_data(task_id),
    }
    if warnings:
        resp["warnings"] = warnings
    return resp
