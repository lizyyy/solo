import json
import os
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse
from app.database import get_db
from app.models import ReportOutput

router = APIRouter(prefix="/report", tags=["报告导出"])

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REPORTS_DIR = os.path.join(_PROJECT_ROOT, "reports")


@router.get("/batch/{batch_id}", summary="生成批次核验报告")
def generate_report(batch_id: str, format: str = Query("json", description="输出格式: json / text")):
    os.makedirs(REPORTS_DIR, exist_ok=True)

    with get_db() as conn:
        batch_row = conn.execute(
            "SELECT * FROM batch WHERE batch_id = ?", (batch_id,)
        ).fetchone()
        if not batch_row:
            raise HTTPException(status_code=404, detail=f"批次 {batch_id} 不存在")

        rows = conn.execute(
            "SELECT * FROM record WHERE batch_id = ? ORDER BY id", (batch_id,)
        ).fetchall()

        records = []
        suspended_records = []
        conflict_records = []
        confirmed_amount_total = 0.0

        for row in rows:
            r = dict(row)
            r["has_voucher"] = bool(r["has_voucher"])
            conflict_detail = r.pop("conflict_detail", None)
            if conflict_detail:
                try:
                    r["conflict_detail"] = json.loads(conflict_detail)
                except (json.JSONDecodeError, TypeError):
                    r["conflict_detail"] = None
            else:
                r["conflict_detail"] = None

            conflicts = []
            conflict_rows = conn.execute(
                "SELECT * FROM conflict WHERE record_id = ?", (r["id"],)
            ).fetchall()
            for cr in conflict_rows:
                conflicts.append(dict(cr))
            r["conflicts"] = conflicts

            records.append(r)

            if r["status"] == "suspended":
                suspended_records.append(r)
            elif r["status"] == "conflict":
                conflict_records.append(r)
            elif r["status"] == "confirmed" and r.get("amount"):
                confirmed_amount_total += r["amount"]

    summary = {
        "total": len(records),
        "confirmed": sum(1 for r in records if r["status"] == "confirmed"),
        "suspended": sum(1 for r in records if r["status"] == "suspended"),
        "pending": sum(1 for r in records if r["status"] == "pending"),
        "conflict": sum(1 for r in records if r["status"] == "conflict"),
        "confirmed_amount_total": confirmed_amount_total,
        "suspended_count_not_in_confirmed": len(suspended_records),
    }

    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    report = ReportOutput(
        batch_id=batch_id,
        generated_at=generated_at,
        summary=summary,
        records=records,
        suspended_records=suspended_records,
        conflict_records=conflict_records,
    )

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = os.path.join(REPORTS_DIR, f"report_{batch_id}_{timestamp}.json")
    text_path = os.path.join(REPORTS_DIR, f"report_{batch_id}_{timestamp}.txt")

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report.model_dump(), f, ensure_ascii=False, indent=2)

    if format == "text":
        text_content = _format_text_report(report)
        with open(text_path, "w", encoding="utf-8") as f:
            f.write(text_content)
        return PlainTextResponse(text_content)

    return report.model_dump()


@router.get("/diff/{batch_id}", summary="查看差异报告（冲突记录与挂起记录）")
def diff_report(batch_id: str):
    with get_db() as conn:
        batch_row = conn.execute(
            "SELECT * FROM batch WHERE batch_id = ?", (batch_id,)
        ).fetchone()
        if not batch_row:
            raise HTTPException(status_code=404, detail=f"批次 {batch_id} 不存在")

        suspended = conn.execute(
            "SELECT * FROM record WHERE batch_id = ? AND status = 'suspended' ORDER BY id",
            (batch_id,),
        ).fetchall()

        conflicts = conn.execute(
            "SELECT * FROM record WHERE batch_id = ? AND status = 'conflict' ORDER BY id",
            (batch_id,),
        ).fetchall()

        suspended_list = []
        for row in suspended:
            r = dict(row)
            r["has_voucher"] = bool(r["has_voucher"])
            suspended_list.append(r)

        conflict_list = []
        for row in conflicts:
            r = dict(row)
            r["has_voucher"] = bool(r["has_voucher"])
            conflict_detail = r.pop("conflict_detail", None)
            if conflict_detail:
                try:
                    r["conflict_detail"] = json.loads(conflict_detail)
                except (json.JSONDecodeError, TypeError):
                    r["conflict_detail"] = None
            else:
                r["conflict_detail"] = None

            c_rows = conn.execute(
                "SELECT * FROM conflict WHERE record_id = ?", (r["id"],)
            ).fetchall()
            r["conflicts"] = [dict(cr) for cr in c_rows]
            conflict_list.append(r)

    return {
        "batch_id": batch_id,
        "suspended_records": suspended_list,
        "conflict_records": conflict_list,
        "summary": {
            "suspended_count": len(suspended_list),
            "conflict_count": len(conflict_list),
            "note": "挂起记录不纳入已确认金额，冲突记录需人工判定后再操作",
        },
    }


def _format_text_report(report: ReportOutput) -> str:
    lines = []
    lines.append("=" * 60)
    lines.append("跨境信用证单证核验报告")
    lines.append("=" * 60)
    lines.append(f"批次: {report.batch_id}")
    lines.append(f"生成时间: {report.generated_at}")
    lines.append("")
    lines.append("【汇总】")
    for k, v in report.summary.items():
        lines.append(f"  {k}: {v}")
    lines.append("")

    lines.append("【全部记录】")
    for r in report.records:
        lines.append(f"  {'─' * 50}")
        lines.append(f"  ID: {r['id']} | 信用证号: {r['lc_number']}")
        lines.append(f"  状态: {r['status']} | 来源: {r['source']}")
        lines.append(f"  金额: {r.get('amount_raw', '')} → {r.get('amount', 'N/A')} {r.get('currency', '')}")
        lines.append(f"  日期: {r.get('date_raw', '')} → {r.get('date', 'N/A')}")
        lines.append(f"  凭证: {'有' if r.get('has_voucher') else '缺'} | 经办: {r.get('operator_name', '')}")
        if r.get("verification_note"):
            lines.append(f"  核验过程:")
            for note_line in str(r["verification_note"]).split("\n"):
                if note_line.strip():
                    lines.append(f"    · {note_line.strip()}")
        if r.get("suggested_action"):
            lines.append(f"  建议动作: {r['suggested_action']}")

    if report.suspended_records:
        lines.append("")
        lines.append("【挂起记录】（不纳入已确认金额）")
        for r in report.suspended_records:
            lines.append(f"  ID: {r['id']} | {r['lc_number']} | 原因: {r.get('suggested_action', '')}")

    if report.conflict_records:
        lines.append("")
        lines.append("【冲突记录】（需人工判定）")
        for r in report.conflict_records:
            lines.append(f"  ID: {r['id']} | {r['lc_number']}")
            if r.get("conflict_detail"):
                for c in r["conflict_detail"]:
                    lines.append(f"    · {c.get('field_name', '')}: 导入={c.get('imported_value', '')} vs 截图={c.get('screenshot_value', '')}")
                    lines.append(f"      建议: {c.get('suggested_action', '')}")

    lines.append("")
    lines.append("=" * 60)
    lines.append("报告结束 — 交风控复核员林姐复核")
    lines.append("=" * 60)
    return "\n".join(lines)
