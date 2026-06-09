from __future__ import annotations
from .database import get_conn, init_db
from .config import err, ALERT_STATUSES, DEFAULT_AUTHOR
from datetime import datetime
import uuid
import shutil
from pathlib import Path
from .config import VACCINE_PHOTO_DIR


def uuid_str() -> str:
    return uuid.uuid4().hex


def ensure_pet(pet_id: str, pet_name: str = "", species: str = "") -> str:
    if not pet_id:
        raise ValueError(err("E001", field="pet_id"))
    with get_conn() as conn:
        row = conn.execute(
            "SELECT pet_id FROM pets WHERE pet_id = ?", (pet_id,)
        ).fetchone()
        if row is None:
            conn.execute(
                "INSERT INTO pets(pet_id, pet_name, species) VALUES (?,?,?)",
                (pet_id, pet_name or pet_id, species or "未知"),
            )
        else:
            conn.execute(
                "UPDATE pets SET updated_at = CURRENT_TIMESTAMP "
                "WHERE pet_id = ? AND (COALESCE(pet_name,'')=''"
                " OR COALESCE(species,'')='')",
                (pet_id,),
            )
    return pet_id


# ---------- 疫苗本照片：分批次追加，source_id 幂等 ----------

def import_vaccine_photo(pet_id: str, source_id: str, photo_file: str,
                         batch: str = "", notes: str = "") -> dict:
    """
    导入疫苗本照片。分批次追加，source_id 相同则跳过（幂等），
    不覆盖早先判断/状态。
    返回 {photo_id, skipped, reason}
    """
    ensure_pet(pet_id)
    if not source_id:
        raise ValueError(err("E001", field="photo_source_id"))
    if not photo_file:
        raise ValueError(err("E001", field="photo_path"))

    src = Path(photo_file)
    if not src.exists():
        raise FileNotFoundError(err("E002", path=photo_file))

    VACCINE_PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    pet_dir = VACCINE_PHOTO_DIR / pet_id
    pet_dir.mkdir(parents=True, exist_ok=True)

    with get_conn() as conn:
        exist = conn.execute(
            "SELECT photo_id FROM vaccine_photos WHERE source_id = ?",
            (source_id,)
        ).fetchone()
        if exist is not None:
            return {"photo_id": exist["photo_id"], "skipped": True,
                    "reason": err("E004")}

        photo_id = uuid_str()
        dest_name = f"{batch or 'batch0'}_{source_id}_{src.name}"
        dest = pet_dir / dest_name
        if not dest.exists():
            shutil.copy2(src, dest)

        conn.execute(
            "INSERT INTO vaccine_photos(photo_id, pet_id, source_id, "
            "batch, file_path, notes) VALUES (?,?,?,?,?,?)",
            (photo_id, pet_id, source_id, batch, str(dest), notes),
        )
        return {"photo_id": photo_id, "skipped": False,
                "reason": "导入成功"}


# ---------- 用药记录：source_id 幂等，剂量变更触发待确认 ----------

def import_medication(pet_id: str, source_id: str, med_name: str,
                      dosage: str, frequency: str = "",
                      start_date: str = "", end_date: str = "") -> dict:
    ensure_pet(pet_id)
    if not source_id:
        raise ValueError(err("E001", field="med_source_id"))
    if not med_name or not dosage:
        raise ValueError(err("E003", detail="med_name 与 dosage 均必填"))

    with get_conn() as conn:
        exist = conn.execute(
            "SELECT med_id, dosage FROM medications WHERE source_id = ?",
            (source_id,)
        ).fetchone()

        if exist is not None:
            old_dosage = exist["dosage"]
            if old_dosage != dosage:
                conn.execute(
                    "UPDATE medications SET dosage=?, frequency=?, "
                    "start_date=?, end_date=?, import_time=CURRENT_TIMESTAMP "
                    "WHERE source_id=?",
                    (dosage, frequency, start_date, end_date, source_id),
                )
                _mark_alerts_for_review(
                    conn, pet_id,
                    reason=f"用药 {med_name} 剂量变更: {old_dosage} → {dosage}"
                )
                return {"med_id": exist["med_id"], "updated": True,
                        "skipped": False, "reason": err("E005")}
            return {"med_id": exist["med_id"], "skipped": True,
                    "updated": False, "reason": err("E004")}

        med_id = uuid_str()
        conn.execute(
            "INSERT INTO medications(med_id, pet_id, source_id, med_name,"
            " dosage, frequency, start_date, end_date) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (med_id, pet_id, source_id, med_name, dosage, frequency,
             start_date, end_date),
        )
        return {"med_id": med_id, "updated": False, "skipped": False,
                "reason": "导入成功"}


def link_vaccine_medication(photo_id: str = None, med_id: str = None,
                            pet_id: str = "",
                            relation_type: str = "关联提醒") -> None:
    """保存疫苗-用药关系"""
    if not pet_id:
        raise ValueError(err("E001", field="pet_id"))
    with get_conn() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO vaccine_medication_relations"
            "(photo_id, med_id, pet_id, relation_type) VALUES (?,?,?,?)",
            (photo_id, med_id, pet_id, relation_type),
        )


# ---------- 温控提醒：source_id 幂等，状态变更留历史 ----------

def import_temp_alert(pet_id: str, source_id: str, alert_time: str,
                      temperature_c: float,
                      initial_status: str = "PENDING") -> dict:
    ensure_pet(pet_id)
    if not source_id:
        raise ValueError(err("E001", field="alert_source_id"))
    if not alert_time:
        raise ValueError(err("E001", field="alert_time"))
    if temperature_c is None:
        raise ValueError(err("E001", field="temperature_c"))

    with get_conn() as conn:
        exist = conn.execute(
            "SELECT alert_id, status FROM temp_alerts WHERE source_id = ?",
            (source_id,)
        ).fetchone()
        if exist is not None:
            return {"alert_id": exist["alert_id"], "skipped": True,
                    "reason": err("E004")}

        alert_id = uuid_str()
        conn.execute(
            "INSERT INTO temp_alerts(alert_id, pet_id, source_id, "
            "alert_time, temperature_c, status) "
            "VALUES (?,?,?,?,?,?)",
            (alert_id, pet_id, source_id, alert_time,
             float(temperature_c), initial_status),
        )
        _append_status_history(conn, alert_id, None, initial_status,
                               reason="首次导入创建提醒",
                               author=DEFAULT_AUTHOR)
        return {"alert_id": alert_id, "skipped": False,
                "reason": "导入成功"}


def update_alert_status(alert_id: str, new_status: str, reason: str = "",
                        author: str = DEFAULT_AUTHOR,
                        conclusion: str | None = None) -> dict:
    if new_status not in ALERT_STATUSES:
        raise ValueError(err("E003",
                             detail=f"非法状态 {new_status}，"
                                    f"可选: {list(ALERT_STATUSES)}"))
    with get_conn() as conn:
        row = conn.execute(
            "SELECT alert_id, status, conclusion FROM temp_alerts "
            "WHERE alert_id = ?",
            (alert_id,)
        ).fetchone()
        if row is None:
            raise KeyError(err("E009", record_id=alert_id))

        old_status = row["status"]
        old_conclusion = row["conclusion"]

        if conclusion is None:
            conclusion = old_conclusion

        conn.execute(
            "UPDATE temp_alerts SET status=?, conclusion=?, "
            "updated_at=CURRENT_TIMESTAMP WHERE alert_id=?",
            (new_status, conclusion, alert_id),
        )
        _append_status_history(conn, alert_id, old_status, new_status,
                               reason=reason, author=author)
        return {"alert_id": alert_id, "old_status": old_status,
                "new_status": new_status}


def add_alert_note(alert_id: str, note_content: str,
                   author: str = DEFAULT_AUTHOR,
                   source_note_id: str | None = None) -> dict:
    """
    追加人工备注。UNIQUE(alert_id, author, source_note_id) 保证
    同一来源备注不会被覆盖，且重复导入不翻倍。
    """
    if not alert_id:
        raise ValueError(err("E001", field="alert_id"))
    if not note_content:
        raise ValueError(err("E001", field="note"))
    with get_conn() as conn:
        exist = conn.execute(
            "SELECT note_id FROM alert_notes WHERE alert_id=? "
            "AND author=? AND COALESCE(source_note_id,'') = COALESCE(?,'')",
            (alert_id, author, source_note_id or ""),
        ).fetchone()
        if exist is not None:
            return {"note_id": exist["note_id"], "skipped": True,
                    "reason": err("E004")}
        cur = conn.execute(
            "INSERT INTO alert_notes(alert_id, note_content, author, "
            "source_note_id) VALUES (?,?,?,?)",
            (alert_id, note_content, author, source_note_id),
        )
        return {"note_id": cur.lastrowid, "skipped": False,
                "reason": "备注追加成功"}


# ---------- 内部工具 ----------

def _append_status_history(conn, alert_id, old_status, new_status,
                           reason, author):
    conn.execute(
        "INSERT INTO alert_status_history(alert_id, old_status, "
        "new_status, reason, author) VALUES (?,?,?,?,?)",
        (alert_id, old_status, new_status, reason, author),
    )


def _mark_alerts_for_review(conn, pet_id, reason):
    """该宠物下所有未解决提醒进入待确认，并写历史原因"""
    rows = conn.execute(
        "SELECT alert_id, status FROM temp_alerts "
        "WHERE pet_id=? AND status != 'RESOLVED'",
        (pet_id,),
    ).fetchall()
    for r in rows:
        old = r["status"]
        if old == "PENDING_REVIEW":
            continue
        conn.execute(
            "UPDATE temp_alerts SET status='PENDING_REVIEW', "
            "updated_at=CURRENT_TIMESTAMP WHERE alert_id=?",
            (r["alert_id"],),
        )
        _append_status_history(conn, r["alert_id"], old, "PENDING_REVIEW",
                               reason=reason, author=DEFAULT_AUTHOR)


# ---------- 查询 ----------

def list_alerts(pet_id: str | None = None) -> list:
    with get_conn() as conn:
        if pet_id:
            rows = conn.execute(
                "SELECT a.*, p.pet_name, p.species FROM temp_alerts a "
                "LEFT JOIN pets p ON a.pet_id=p.pet_id "
                "WHERE a.pet_id=? ORDER BY a.alert_time DESC",
                (pet_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT a.*, p.pet_name, p.species FROM temp_alerts a "
                "LEFT JOIN pets p ON a.pet_id=p.pet_id "
                "ORDER BY a.alert_time DESC",
            ).fetchall()
        return [dict(r) for r in rows]


def get_alert_history(alert_id: str) -> list:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM alert_status_history WHERE alert_id=? "
            "ORDER BY changed_at ASC",
            (alert_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_alert_notes(alert_id: str) -> list:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM alert_notes WHERE alert_id=? "
            "ORDER BY created_at ASC",
            (alert_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_vaccine_medication_relations(pet_id: str) -> list:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT r.*, v.file_path AS photo_path, v.batch, v.upload_time, "
            "m.med_name, m.dosage, m.frequency "
            "FROM vaccine_medication_relations r "
            "LEFT JOIN vaccine_photos v ON r.photo_id = v.photo_id "
            "LEFT JOIN medications m ON r.med_id = m.med_id "
            "WHERE r.pet_id=? ORDER BY r.created_at DESC",
            (pet_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_pending_review_reason(alert_id: str) -> str | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT reason FROM alert_status_history WHERE alert_id=? "
            "AND new_status='PENDING_REVIEW' ORDER BY changed_at DESC LIMIT 1",
            (alert_id,),
        ).fetchone()
        return row["reason"] if row else None


init_db()
