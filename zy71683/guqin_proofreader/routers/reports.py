from __future__ import annotations
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from database import get_db
from models import ProofreadReport, Anomaly, ScoreVersion
from schemas import ProofreadRequest, ProofreadReportOut, AnomalyOut
from engine import run_proofread, compare_versions
from audit import log_audit

router = APIRouter(prefix="/reports", tags=["校对报告"])


@router.post("/proofread", response_model=ProofreadReportOut)
def proofread(data: ProofreadRequest, db: Session = Depends(get_db)):
    ver = db.query(ScoreVersion).filter(ScoreVersion.id == data.version_id).first()
    if not ver:
        raise HTTPException(404, "版本不存在")
    report = run_proofread(db, data.score_id, data.version_id)
    db.commit()
    db.refresh(report)
    anomalies = db.query(Anomaly).filter(Anomaly.report_id == report.id).all()
    report_dict = _report_to_dict(report, anomalies)
    return _dict_to_report_out(report_dict)


@router.get("/{report_id}", response_model=ProofreadReportOut)
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(ProofreadReport).filter(ProofreadReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "报告不存在")
    anomalies = db.query(Anomaly).filter(Anomaly.report_id == report_id).all()
    report_dict = _report_to_dict(report, anomalies)
    return _dict_to_report_out(report_dict)


@router.get("", response_model=List[ProofreadReportOut])
def list_reports(
    score_id: Optional[int] = None,
    version_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(ProofreadReport)
    if score_id:
        q = q.filter(ProofreadReport.score_id == score_id)
    if version_id:
        q = q.filter(ProofreadReport.version_id == version_id)
    reports = q.order_by(ProofreadReport.created_at.desc()).all()
    result = []
    for r in reports:
        anomalies = db.query(Anomaly).filter(Anomaly.report_id == r.id).all()
        result.append(_dict_to_report_out(_report_to_dict(r, anomalies)))
    return result


@router.get("/anomalies/{score_id}", response_model=List[AnomalyOut])
def locate_anomalies(
    score_id: int,
    anomaly_type: Optional[str] = None,
    severity: Optional[str] = None,
    db: Session = Depends(get_db),
):
    report_ids = [r[0] for r in db.query(ProofreadReport.id).filter(
        ProofreadReport.score_id == score_id
    ).all()]
    if not report_ids:
        return []
    q = db.query(Anomaly).filter(Anomaly.report_id.in_(report_ids))
    if anomaly_type:
        q = q.filter(Anomaly.anomaly_type == anomaly_type)
    if severity:
        q = q.filter(Anomaly.severity == severity)
    return q.order_by(Anomaly.severity, Anomaly.measure_number).all()


@router.post("/compare")
def compare_two_versions(
    old_version_id: int,
    new_version_id: int,
    db: Session = Depends(get_db),
):
    result = compare_versions(db, old_version_id, new_version_id)
    db.commit()
    return result


@router.get("/{report_id}/export", response_class=PlainTextResponse)
def export_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(ProofreadReport).filter(ProofreadReport.id == report_id).first()
    if not report:
        raise HTTPException(404, "报告不存在")
    anomalies = db.query(Anomaly).filter(Anomaly.report_id == report_id).all()

    lines = []
    lines.append("===== 古琴谱指法校对报告 =====")
    lines.append("报告ID: {}".format(report.id))
    lines.append("谱稿ID: {}  版本ID: {}".format(report.score_id, report.version_id))
    lines.append("生成时间: {}".format(report.created_at))
    lines.append("")
    lines.append("概要: {}".format(report.summary))
    lines.append("异常总数: {}".format(report.anomaly_count))
    lines.append("")

    detail = json.loads(report.detail_json) if report.detail_json else {}
    if detail.get("type_details"):
        lines.append("异常类型统计:")
        for d in detail["type_details"]:
            lines.append("  {}".format(d))
        lines.append("")

    lines.append("异常明细:")
    lines.append("-" * 60)
    for a in anomalies:
        lines.append("[{}] {}".format(a.severity.upper(), a.anomaly_type))
        if a.measure_number:
            lines.append("  小节: 第{}小节".format(a.measure_number))
        lines.append("  描述: {}".format(a.description))
        if a.cause_analysis:
            lines.append("  原因分析: {}".format(a.cause_analysis))
        if a.affected_data_json:
            try:
                affected = json.loads(a.affected_data_json)
                lines.append("  关联数据: {}".format(json.dumps(affected, ensure_ascii=False, indent=2)))
            except json.JSONDecodeError:
                lines.append("  关联数据: {}".format(a.affected_data_json))
        lines.append("")

    log_audit(db, "export", "proofread_report", entity_id=report.id, note="导出校对报告为文本格式")
    db.commit()

    return "\n".join(lines)


def _report_to_dict(report, anomalies):
    return {
        "id": report.id,
        "score_id": report.score_id,
        "version_id": report.version_id,
        "report_type": report.report_type,
        "summary": report.summary,
        "anomaly_count": report.anomaly_count,
        "detail_json": report.detail_json,
        "created_at": report.created_at,
        "anomalies": anomalies,
    }


def _dict_to_report_out(d):
    report = ProofreadReportOut(
        id=d["id"],
        score_id=d["score_id"],
        version_id=d["version_id"],
        report_type=d["report_type"],
        summary=d["summary"],
        anomaly_count=d["anomaly_count"],
        detail_json=d["detail_json"],
        created_at=d["created_at"],
    )
    report.anomalies = [
        AnomalyOut(
            id=a.id,
            report_id=a.report_id,
            anomaly_type=a.anomaly_type,
            severity=a.severity,
            measure_number=a.measure_number,
            description=a.description,
            cause_analysis=a.cause_analysis,
            affected_data_json=a.affected_data_json,
            created_at=a.created_at,
        )
        for a in d["anomalies"]
    ]
    return report
