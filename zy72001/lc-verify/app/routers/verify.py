import json
from fastapi import APIRouter, HTTPException
from app.models import ConfirmRequest
from app.database import get_db

router = APIRouter(prefix="/verify", tags=["人工确认"])


@router.post("/confirm", summary="人工确认/挂起/解决冲突")
def confirm_record(req: ConfirmRequest):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM record WHERE id = ?", (req.record_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="记录不存在")

        if req.action == "confirm":
            if not row["has_voucher"]:
                raise HTTPException(
                    status_code=400,
                    detail="缺凭证的记录不能直接确认，请先补凭证或选择挂起",
                )
            conn.execute(
                """UPDATE record SET status = 'confirmed', verification_note = verification_note || ?,
                   updated_at = datetime('now','localtime') WHERE id = ?""",
                (f"\n[人工确认] {req.note or '已确认'}", req.record_id),
            )
            return {"record_id": req.record_id, "status": "confirmed", "message": "已确认"}

        elif req.action == "suspend":
            conn.execute(
                """UPDATE record SET status = 'suspended', verification_note = verification_note || ?,
                   updated_at = datetime('now','localtime') WHERE id = ?""",
                (f"\n[人工挂起] {req.note or '已挂起'}", req.record_id),
            )
            return {"record_id": req.record_id, "status": "suspended", "message": "已挂起"}

        elif req.action == "resolve_conflict":
            if not req.conflict_resolutions:
                raise HTTPException(status_code=400, detail="解决冲突需提供 conflict_resolutions")

            for res in req.conflict_resolutions:
                conflict_id = res.get("conflict_id")
                resolution = res.get("resolution")
                if conflict_id and resolution in ("accept_imported", "accept_screenshot", "manual_override"):
                    conn.execute(
                        """UPDATE conflict SET resolution = ?, resolved_at = datetime('now','localtime')
                           WHERE id = ? AND record_id = ?""",
                        (resolution, conflict_id, req.record_id),
                    )

            all_conflicts = conn.execute(
                "SELECT * FROM conflict WHERE record_id = ?", (req.record_id,)
            ).fetchall()
            all_resolved = all(c["resolution"] not in (None, "pending") for c in all_conflicts)

            new_status = "confirmed" if all_resolved and row["has_voucher"] else "suspended" if all_resolved else "conflict"
            conn.execute(
                """UPDATE record SET status = ?, verification_note = verification_note || ?,
                   updated_at = datetime('now','localtime') WHERE id = ?""",
                (new_status, f"\n[冲突解决] {req.note or '已处理冲突'}", req.record_id),
            )
            return {
                "record_id": req.record_id,
                "status": new_status,
                "message": f"冲突已处理，状态更新为 {new_status}",
            }

        else:
            raise HTTPException(status_code=400, detail=f"不支持的动作: {req.action}")
