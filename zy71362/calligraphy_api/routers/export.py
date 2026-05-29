import io
import json
import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
from models import Homework, ScoreReport, LayoutMeasurement, Comment, IssueRecord
from image_processor import load_image, detect_text_regions, detect_chars_in_row, detect_signature_region, generate_annotated_image

router = APIRouter(prefix="/api/homework", tags=["export"])


@router.get("/{homework_id}/export")
def export_report(
    homework_id: int,
    format: str = Query("json", regex="^(json|txt)$"),
    include_image: bool = Query(False),
    db: Session = Depends(get_db),
):
    hw = db.query(Homework).filter(Homework.id == homework_id).first()
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found")

    report = (
        db.query(ScoreReport)
        .filter(ScoreReport.homework_id == homework_id)
        .order_by(ScoreReport.created_at.desc())
        .first()
    )
    measurement = (
        db.query(LayoutMeasurement)
        .filter(LayoutMeasurement.homework_id == homework_id)
        .order_by(LayoutMeasurement.created_at.desc())
        .first()
    )
    comments = (
        db.query(Comment)
        .filter(Comment.homework_id == homework_id)
        .order_by(Comment.created_at.asc())
        .all()
    )
    issues = (
        db.query(IssueRecord)
        .filter(IssueRecord.homework_id == homework_id)
        .order_by(IssueRecord.created_at.desc())
        .all()
    )

    report_data = {
        "homework": {
            "id": hw.id,
            "student_name": hw.student_name,
            "font_type": hw.font_type,
            "class_name": hw.class_name,
            "status": hw.status,
            "tilt_angle": hw.tilt_angle,
            "tilt_corrected": hw.tilt_corrected,
            "created_at": hw.created_at.isoformat() if hw.created_at else None,
            "updated_at": hw.updated_at.isoformat() if hw.updated_at else None,
        },
        "score_report": {
            "char_spacing_score": report.char_spacing_score if report else None,
            "line_spacing_score": report.line_spacing_score if report else None,
            "signature_position_score": report.signature_position_score if report else None,
            "total_score": report.total_score if report else None,
            "is_manual_override": report.is_manual_override if report else None,
            "override_reason": report.override_reason if report else None,
        }
        if report
        else None,
        "layout_measurement": {
            "avg_char_spacing": measurement.avg_char_spacing if measurement else None,
            "avg_line_spacing": measurement.avg_line_spacing if measurement else None,
            "char_spacing_variance": measurement.char_spacing_variance if measurement else None,
            "line_spacing_variance": measurement.line_spacing_variance if measurement else None,
            "signature_detected": measurement.signature_detected if measurement else None,
            "signature_region": measurement.signature_region if measurement else None,
            "row_count": measurement.row_count if measurement else None,
            "char_count": measurement.char_count if measurement else None,
            "is_manual_adjusted": measurement.is_manual_adjusted if measurement else None,
        }
        if measurement
        else None,
        "comments": [
            {
                "id": c.id,
                "teacher_comment": c.teacher_comment,
                "comment_type": c.comment_type,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in comments
        ],
        "issues": [
            {
                "id": i.id,
                "issue_type": i.issue_type,
                "severity": i.severity,
                "description": i.description,
                "suggested_action": i.suggested_action,
                "resolution": i.resolution,
                "resolved": i.resolved,
                "created_at": i.created_at.isoformat() if i.created_at else None,
                "resolved_at": i.resolved_at.isoformat() if i.resolved_at else None,
            }
            for i in issues
        ],
        "export_time": datetime.utcnow().isoformat(),
    }

    if format == "json":
        content = json.dumps(report_data, ensure_ascii=False, indent=2)
        return StreamingResponse(
            io.BytesIO(content.encode("utf-8")),
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename=homework_{homework_id}_report.json"
            },
        )

    elif format == "txt":
        lines = []
        lines.append("=" * 60)
        lines.append("书法作业章法评分报告")
        lines.append("=" * 60)
        lines.append("")
        lines.append(f"学生姓名: {hw.student_name}")
        lines.append(f"字体类型: {hw.font_type}")
        lines.append(f"班级: {hw.class_name or '未指定'}")
        lines.append(f"状态: {hw.status}")
        lines.append(f"图片倾斜角度: {hw.tilt_angle:.2f}°" if hw.tilt_angle is not None else "图片倾斜角度: 未检测")
        lines.append(f"创建时间: {hw.created_at}")
        lines.append("")

        if report:
            lines.append("-" * 40)
            lines.append("评分详情")
            lines.append("-" * 40)
            lines.append(f"字距评分: {report.char_spacing_score}")
            lines.append(f"行距评分: {report.line_spacing_score}")
            lines.append(f"落款位置评分: {report.signature_position_score}")
            lines.append(f"总分: {report.total_score}")
            if report.is_manual_override:
                lines.append(f"(已手动修正，原因: {report.override_reason or '未注明'})")
            lines.append("")

        if measurement:
            lines.append("-" * 40)
            lines.append("版面测量")
            lines.append("-" * 40)
            lines.append(f"平均字距: {measurement.avg_char_spacing:.2f}")
            lines.append(f"平均行距: {measurement.avg_line_spacing:.2f}")
            lines.append(f"字距方差: {measurement.char_spacing_variance:.2f}")
            lines.append(f"行距方差: {measurement.line_spacing_variance:.2f}")
            lines.append(f"落款检测: {'是' if measurement.signature_detected else '否'}")
            lines.append(f"行数: {measurement.row_count}")
            lines.append(f"字数: {measurement.char_count}")
            if measurement.is_manual_adjusted:
                lines.append("(数据已手动调整)")
            lines.append("")

        if comments:
            lines.append("-" * 40)
            lines.append("教师评语")
            lines.append("-" * 40)
            for c in comments:
                lines.append(f"[{c.comment_type}] {c.teacher_comment} ({c.created_at})")
            lines.append("")

        if issues:
            lines.append("-" * 40)
            lines.append("问题记录")
            lines.append("-" * 40)
            for i in issues:
                status_str = "已解决" if i.resolved else "待处理"
                lines.append(f"[{i.issue_type}|{i.severity}|{status_str}] {i.description}")
                if i.resolution:
                    lines.append(f"  解决方案: {i.resolution}")
            lines.append("")

        lines.append(f"导出时间: {datetime.utcnow().isoformat()}")
        content = "\n".join(lines)
        return StreamingResponse(
            io.BytesIO(content.encode("utf-8")),
            media_type="text/plain; charset=utf-8",
            headers={
                "Content-Disposition": f"attachment; filename=homework_{homework_id}_report.txt"
            },
        )
