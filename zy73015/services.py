import json
from typing import Any, Dict, List, Optional, Tuple

from db import (
    RECORD_STATUSES,
    STATUS_SNAPSHOT_NOTES,
    compute_hash,
    get_conn,
    normalize_cat_name,
    now_iso,
    row_to_dict,
)


def create_batch(operator: str = "system", remark: str = None) -> int:
    """创建一个新的导入/复核批次，返回 batch_id"""
    ts = now_iso().replace(":", "").replace("-", "").replace(".", "")[:18]
    batch_no = f"BATCH-{ts}"
    with get_conn() as conn:
        c = conn.cursor()
        c.execute(
            "INSERT INTO review_batches (batch_no, operator, remark, created_at) VALUES (?, ?, ?, ?)",
            (batch_no, operator, remark, now_iso()),
        )
        return c.lastrowid


def get_batch_info(batch_id: int) -> Optional[dict]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM review_batches WHERE id = ?", (batch_id,)
        ).fetchone()
        return row_to_dict(row)


def list_batches(limit: int = 50) -> List[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM review_batches ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
        return [row_to_dict(r) for r in rows]


def build_record_key(item: dict) -> str:
    """用 规范化猫名 + 寄养编号(或空) + 异常描述 生成唯一业务键，用于重复导入去重"""
    foster = item.get("foster_no") or ""
    cat_norm = normalize_cat_name(item.get("cat_name", ""))
    issue = (item.get("litter_box_issue") or "").strip()
    return compute_hash(cat_norm, foster, issue)


def detect_material_type(item: dict, all_names_in_batch: List[str]) -> Tuple[str, bool]:
    """
    检测材料来源类型：
    - OLD_FOSTER_FORM: item 中标记了 version=old 或 source_name 含 '旧版'
    - ORAL_NOTE: item 中 is_oral=True 或 source_type='oral'
    - NAME_INCONSISTENT: 同批次中同一个规范化名对应多种原始写法
    - NORMAL: 其他
    返回 (type, 是否影响结论标记)
    """
    source = str(item.get("source_name") or item.get("source_type") or "").lower()
    if item.get("is_old_version") or "旧版" in (item.get("source_name") or "") or "old" in source:
        return "OLD_FOSTER_FORM", True
    if item.get("is_oral") or "口头" in (item.get("source_name") or "") or "oral" in source:
        return "ORAL_NOTE", False

    raw = item.get("cat_name", "").strip()
    norm = normalize_cat_name(raw)
    variants = set()
    for n in all_names_in_batch:
        if normalize_cat_name(n) == norm and n.strip() != raw:
            variants.add(n.strip())
    if variants:
        return "NAME_INCONSISTENT", True
    return "NORMAL", False


def import_items(
    items: List[dict],
    operator: str = "阿宁",
    remark: str = None,
    rerun: bool = False,
) -> dict:
    """
    核心导入方法：
    - 重复导入：按 record_key 去重，正常记录不翻倍，已有 protected 备注不覆盖
    - 自动检测材料来源类型
    - 疫苗日期缺失单独标记
    - rerun=True 表示重跑，版本号+1，保留历史快照关联
    返回统计信息
    """
    batch_id = create_batch(operator=operator, remark=remark)
    all_raw_names = [it.get("cat_name", "").strip() for it in items]

    stats = {
        "batch_id": batch_id,
        "total": len(items),
        "inserted": 0,
        "updated": 0,
        "skipped_duplicate": 0,
        "vaccine_missing": 0,
        "materials_by_type": {},
    }

    with get_conn() as conn:
        c = conn.cursor()

        for item in items:
            raw_cat = item.get("cat_name", "").strip()
            norm_cat = normalize_cat_name(raw_cat)
            foster_no = (item.get("foster_no") or "").strip() or None
            issue = (item.get("litter_box_issue") or "").strip()
            vaccine_date = (item.get("vaccine_date") or "").strip() or None
            is_vaccine_missing = 1 if not vaccine_date else 0

            record_key = build_record_key(item)

            material_type, affects = detect_material_type(item, all_raw_names)
            if is_vaccine_missing:
                affects = True
            stats["materials_by_type"].setdefault(material_type, 0)
            stats["materials_by_type"][material_type] += 1

            source_name = item.get("source_name") or item.get("source_file") or "未命名材料"
            import_hash = compute_hash(
                record_key,
                source_name,
                material_type,
                raw_cat,
                issue,
                vaccine_date or "",
            )

            existing = conn.execute(
                "SELECT * FROM review_records WHERE record_key = ?", (record_key,)
            ).fetchone()

            if existing:
                dup_mat = conn.execute(
                    "SELECT id FROM materials WHERE import_hash = ?", (import_hash,)
                ).fetchone()
                if dup_mat and not rerun:
                    stats["skipped_duplicate"] += 1
                    continue

                if is_vaccine_missing:
                    stats["vaccine_missing"] += 1

                new_version = existing["version"] + (1 if rerun else 0)
                new_status = (
                    "VACCINE_MISSING"
                    if is_vaccine_missing
                    else (existing["status"] if not rerun else "PENDING")
                )
                conn.execute(
                    """
                    UPDATE review_records
                    SET batch_id=?, cat_name=?, cat_name_normalized=?, foster_no=?,
                        litter_box_issue=?, vaccine_date=?, is_vaccine_missing=?,
                        status=?, version=?, updated_at=?
                    WHERE id=?
                    """,
                    (
                        batch_id,
                        raw_cat,
                        norm_cat,
                        foster_no,
                        issue,
                        vaccine_date,
                        is_vaccine_missing,
                        new_status,
                        new_version,
                        now_iso(),
                        existing["id"],
                    ),
                )
                record_id = existing["id"]
                stats["updated"] += 1
            else:
                if is_vaccine_missing:
                    stats["vaccine_missing"] += 1
                status = "VACCINE_MISSING" if is_vaccine_missing else "PENDING"
                ts = now_iso()
                c.execute(
                    """
                    INSERT INTO review_records
                    (batch_id, record_key, cat_name, cat_name_normalized, foster_no,
                     litter_box_issue, vaccine_date, is_vaccine_missing, status,
                     version, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                    """,
                    (
                        batch_id,
                        record_key,
                        raw_cat,
                        norm_cat,
                        foster_no,
                        issue,
                        vaccine_date,
                        is_vaccine_missing,
                        status,
                        ts,
                        ts,
                    ),
                )
                record_id = c.lastrowid
                stats["inserted"] += 1

            conn.execute(
                """
                INSERT INTO materials
                (record_id, batch_id, material_type, source_name, raw_content,
                 import_hash, affects_conclusion, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record_id,
                    batch_id,
                    material_type,
                    source_name,
                    json.dumps(item, ensure_ascii=False),
                    import_hash,
                    1 if affects else 0,
                    now_iso(),
                ),
            )

            note_text = (item.get("note") or item.get("oral_note") or "").strip()
            if note_text and material_type == "ORAL_NOTE":
                note_hash = compute_hash(record_key, "ORAL_NOTE", note_text)
                existed_note = conn.execute(
                    "SELECT id FROM manual_notes WHERE record_id=? AND note_hash=?",
                    (record_id, note_hash),
                ).fetchone()
                if not existed_note:
                    conn.execute(
                        """
                        INSERT INTO manual_notes
                        (record_id, author, content, note_hash, protected, created_at)
                        VALUES (?, ?, ?, ?, 1, ?)
                        """,
                        (record_id, item.get("author") or operator, note_text, note_hash, now_iso()),
                    )

        conn.commit()
        _refresh_snapshots_for_batch(conn, batch_id)

    return stats


def _refresh_snapshots_for_batch(conn, batch_id: int):
    """
    为批次内所有记录生成/更新状态快照：
    - 状态 + 截图说明 绑定（保证接口和导出一致）
    - 关联影响结论的材料 id 和 备注 id（关联不断线）
    """
    rows = conn.execute(
        "SELECT * FROM review_records WHERE batch_id=?", (batch_id,)
    ).fetchall()
    for r in rows:
        status = r["status"]
        note = STATUS_SNAPSHOT_NOTES.get(status, "")
        materials = conn.execute(
            "SELECT id FROM materials WHERE record_id=? AND affects_conclusion=1",
            (r["id"],),
        ).fetchall()
        mat_ids = [m["id"] for m in materials]
        notes = conn.execute(
            "SELECT id FROM manual_notes WHERE record_id=?", (r["id"],)
        ).fetchall()
        note_ids = [n["id"] for n in notes]
        conn.execute(
            """
            INSERT INTO status_snapshots
            (record_id, batch_id, record_version, status, screenshot_note,
             affected_material_ids, linked_note_ids, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                r["id"],
                batch_id,
                r["version"],
                status,
                note,
                json.dumps(mat_ids),
                json.dumps(note_ids),
                now_iso(),
            ),
        )


def list_records(
    status: str = None,
    vaccine_missing_only: bool = False,
    batch_id: int = None,
) -> List[dict]:
    """
    项目经理查询明细接口：
    - 返回字段中 screenshot_note 直接与状态绑定，保证一致
    - vaccine_missing_only=True 只拎出疫苗缺失的
    """
    sql = [
        """
        SELECT
            r.*,
            b.batch_no,
            (SELECT screenshot_note FROM status_snapshots s
             WHERE s.record_id=r.id AND s.record_version=r.version
             ORDER BY s.id DESC LIMIT 1) AS screenshot_note,
            (SELECT GROUP_CONCAT(material_type||':'||COALESCE(source_name,'?'), ' | ')
             FROM materials m WHERE m.record_id=r.id) AS material_trace
        FROM review_records r
        LEFT JOIN review_batches b ON b.id=r.batch_id
        WHERE 1=1
        """
    ]
    params = []
    if status:
        sql.append(" AND r.status=?")
        params.append(status)
    if vaccine_missing_only:
        sql.append(" AND r.is_vaccine_missing=1")
    if batch_id:
        sql.append(" AND r.batch_id=?")
        params.append(batch_id)
    sql.append(" ORDER BY r.id DESC")
    with get_conn() as conn:
        rows = conn.execute(" ".join(sql), params).fetchall()
        result = []
        for r in rows:
            d = row_to_dict(r)
            d["status_cn"] = RECORD_STATUSES.get(d["status"], d["status"])
            materials = conn.execute(
                """
                SELECT id, material_type, source_name, affects_conclusion, created_at
                FROM materials WHERE record_id=? ORDER BY id
                """,
                (r["id"],),
            ).fetchall()
            d["materials"] = [row_to_dict(m) for m in materials]
            notes = conn.execute(
                "SELECT id, author, content, protected, created_at FROM manual_notes WHERE record_id=? ORDER BY id",
                (r["id"],),
            ).fetchall()
            d["notes"] = [row_to_dict(n) for n in notes]
            snapshots = conn.execute(
                "SELECT * FROM status_snapshots WHERE record_id=? ORDER BY id",
                (r["id"],),
            ).fetchall()
            d["snapshots"] = [row_to_dict(s) for s in snapshots]
            result.append(d)
        return result


def get_record_detail(record_id: int) -> Optional[dict]:
    recs = list_records()
    for r in recs:
        if r["id"] == record_id:
            return r
    return None


def update_record_status(record_id: int, status: str, operator: str = "项目经理") -> dict:
    """人工变更状态，版本+1，生成新快照，保留历史"""
    if status not in RECORD_STATUSES:
        raise ValueError(f"无效状态: {status}")
    with get_conn() as conn:
        r = conn.execute(
            "SELECT * FROM review_records WHERE id=?", (record_id,)
        ).fetchone()
        if not r:
            return {"error": "记录不存在"}
        batch_id = r["batch_id"]
        new_ver = r["version"] + 1
        conn.execute(
            "UPDATE review_records SET status=?, version=?, updated_at=? WHERE id=?",
            (status, new_ver, now_iso(), record_id),
        )
        _refresh_snapshots_for_batch(conn, batch_id)
        return {"record_id": record_id, "new_status": status, "new_version": new_ver}


def add_manual_note(record_id: int, content: str, author: str) -> dict:
    """添加人工备注，自动带保护标记，不会被重跑/重导入覆盖"""
    content = content.strip()
    if not content:
        return {"error": "内容不能为空"}
    with get_conn() as conn:
        r = conn.execute(
            "SELECT record_key FROM review_records WHERE id=?", (record_id,)
        ).fetchone()
        if not r:
            return {"error": "记录不存在"}
        note_hash = compute_hash(r["record_key"], "MANUAL", content, now_iso())
        c = conn.cursor()
        c.execute(
            """
            INSERT INTO manual_notes (record_id, author, content, note_hash, protected, created_at)
            VALUES (?, ?, ?, ?, 1, ?)
            """,
            (record_id, author, content, note_hash, now_iso()),
        )
        conn.execute(
            "UPDATE review_records SET updated_at=? WHERE id=?", (now_iso(), record_id)
        )
        return {"note_id": c.lastrowid, "record_id": record_id}


def export_snapshot_records(batch_id: int = None) -> List[dict]:
    """
    导出与接口状态一致的记录：
    直接取最新快照作为截图说明，确保与接口状态字段一致。
    """
    with get_conn() as conn:
        sql = [
            """
            SELECT s.*, r.cat_name, r.foster_no, r.litter_box_issue, r.vaccine_date,
                   r.is_vaccine_missing, r.version AS current_version, b.batch_no
            FROM status_snapshots s
            JOIN review_records r ON r.id=s.record_id
            LEFT JOIN review_batches b ON b.id=s.batch_id
            WHERE s.record_version = r.version
            """
        ]
        params = []
        if batch_id:
            sql.append(" AND s.batch_id=?")
            params.append(batch_id)
        sql.append(" ORDER BY s.id DESC")
        rows = conn.execute(" ".join(sql), params).fetchall()
        out = []
        for r in rows:
            d = row_to_dict(r)
            d["status_cn"] = RECORD_STATUSES.get(d["status"], d["status"])
            d["affected_material_ids"] = json.loads(d.get("affected_material_ids") or "[]")
            d["linked_note_ids"] = json.loads(d.get("linked_note_ids") or "[]")
            out.append(d)
        return out


def rerun_batch(batch_id: int, operator: str = "系统重跑") -> dict:
    """
    重跑指定批次：
    - 重新收集该批次的所有原始材料
    - 再走一次 import_items(rerun=True)
    - 版本+1，历史备注/快照保留
    """
    with get_conn() as conn:
        mats = conn.execute(
            "SELECT raw_content FROM materials WHERE batch_id=? ORDER BY id",
            (batch_id,),
        ).fetchall()
        items = []
        seen_hashes = set()
        for m in mats:
            raw = json.loads(m["raw_content"])
            h = compute_hash(json.dumps(raw, ensure_ascii=False, sort_keys=True))
            if h in seen_hashes:
                continue
            seen_hashes.add(h)
            items.append(raw)
    if not items:
        return {"error": "该批次没有可重跑的材料"}
    return import_items(
        items,
        operator=operator,
        remark=f"重跑来源批次#{batch_id}",
        rerun=True,
    )


def seed_demo_data() -> dict:
    """
    按用户描述植入演示数据：
    1. 1条正常记录
    2. 1条寄养登记表旧版（混入）
    3. 1条名称写法不一致的材料（"橘座" vs "橘 座"）
    4. 2条口头备注
    5. 1条疫苗日期缺失（单独拎出）
    """
    demo_items = [
        {
            "cat_name": "奶糖",
            "foster_no": "F2026-001",
            "litter_box_issue": "连续2天未使用猫砂盆，疑似便秘",
            "vaccine_date": "2026-03-15",
            "source_name": "寄养登记表-20260601.xlsx",
        },
        {
            "cat_name": "奶糖",
            "foster_no": "F2026-001",
            "litter_box_issue": "连续2天未使用猫砂盆，疑似便秘",
            "vaccine_date": "2026-03-15",
            "source_name": "寄养登记表-旧版-2025.xlsx",
            "is_old_version": True,
        },
        {
            "cat_name": "橘座",
            "foster_no": "F2026-007",
            "litter_box_issue": "砂盆外排便，位置在猫窝旁",
            "vaccine_date": "2026-04-02",
            "source_name": "微信群-阿宁上传-异常记录.png",
        },
        {
            "cat_name": "橘 座",
            "foster_no": "F2026-007",
            "litter_box_issue": "砂盆外排便，位置在猫窝旁",
            "vaccine_date": "2026-04-02",
            "source_name": "视频截图-橘座砂盆异常.mov",
        },
        {
            "cat_name": "橘子",
            "foster_no": "F2026-012",
            "litter_box_issue": "频繁进出砂盆但无排泄，疑似尿闭",
            "vaccine_date": "",
            "source_name": "寄养登记表-疫苗栏空白.pdf",
        },
        {
            "cat_name": "奶糖",
            "foster_no": "F2026-001",
            "litter_box_issue": "连续2天未使用猫砂盆，疑似便秘",
            "vaccine_date": "2026-03-15",
            "source_name": "口头沟通-阿宁",
            "is_oral": True,
            "oral_note": "阿宁口述：早上看到奶糖去过砂盆，可能只是不爱动",
            "author": "阿宁",
        },
        {
            "cat_name": "橘座",
            "foster_no": "F2026-007",
            "litter_box_issue": "砂盆外排便，位置在猫窝旁",
            "vaccine_date": "2026-04-02",
            "source_name": "口头-前台小夏",
            "is_oral": True,
            "oral_note": "小夏口述：橘座当时可能是被新来的猫吓到了",
            "author": "小夏",
        },
    ]
    return import_items(demo_items, operator="兽医助理-阿宁", remark="首次导入演示数据")


def dashboard_stats() -> dict:
    with get_conn() as conn:
        total = conn.execute("SELECT COUNT(*) FROM review_records").fetchone()[0]
        by_status = conn.execute(
            "SELECT status, COUNT(*) c FROM review_records GROUP BY status"
        ).fetchall()
        vac = conn.execute(
            "SELECT COUNT(*) FROM review_records WHERE is_vaccine_missing=1"
        ).fetchone()[0]
        batches = conn.execute("SELECT COUNT(*) FROM review_batches").fetchone()[0]
        return {
            "total_records": total,
            "by_status": {r["status"]: r["c"] for r in by_status},
            "vaccine_missing": vac,
            "total_batches": batches,
        }
