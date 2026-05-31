from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Optional, Dict, Any
from datetime import datetime
import pandas as pd
import json
import hashlib
import os
import uuid

from ..database import get_db, DATA_DIR
from .. import models, schemas
from ..diagnosis.threshold import threshold_manager

router = APIRouter(prefix="/api/export", tags=["数据导出"])


@router.post("/inspection-report", response_model=schemas.ExportResult)
def export_inspection_report(
    request: schemas.ExportRequest,
    db: Session = Depends(get_db)
):
    try:
        view_state_hash = _calculate_view_state_hash(request)

        report_hash = _calculate_report_hash(
            compressor_id=request.compressor_id,
            start_time=request.start_time,
            end_time=request.end_time,
            filters=request.filters,
            view_state=request.view_state,
            view_state_hash=view_state_hash,
        )

        existing_export = db.query(models.ExportRecord).filter(
            models.ExportRecord.report_hash == report_hash
        ).first()

        if existing_export and os.path.exists(existing_export.file_path):
            return schemas.ExportResult(
                success=True,
                message="报告已存在，使用缓存版本",
                file_path=existing_export.file_path,
                file_name=existing_export.file_name,
                record_count=existing_export.record_count,
                report_hash=report_hash,
            )

        compressor = None
        if request.compressor_id:
            compressor = db.query(models.Compressor).filter(
                models.Compressor.id == request.compressor_id
            ).first()
            if not compressor:
                raise HTTPException(status_code=404, detail="空压机不存在")

        energy_query = db.query(models.EnergyRecord).filter(
            and_(
                models.EnergyRecord.record_time >= request.start_time,
                models.EnergyRecord.record_time <= request.end_time,
            )
        )
        if request.compressor_id:
            energy_query = energy_query.filter(
                models.EnergyRecord.compressor_id == request.compressor_id
            )
        if request.filters and request.filters.get('min_power'):
            energy_query = energy_query.filter(
                models.EnergyRecord.power >= request.filters['min_power']
            )
        energy_records = energy_query.order_by(models.EnergyRecord.record_time).all()

        vibration_query = db.query(models.VibrationRecord).filter(
            and_(
                models.VibrationRecord.record_time >= request.start_time,
                models.VibrationRecord.record_time <= request.end_time,
            )
        )
        if request.compressor_id:
            vibration_query = vibration_query.filter(
                models.VibrationRecord.compressor_id == request.compressor_id
            )
        vibration_records = vibration_query.order_by(models.VibrationRecord.record_time).all()

        diagnosis_query = db.query(models.Diagnosis).filter(
            and_(
                models.Diagnosis.start_time >= request.start_time,
                models.Diagnosis.end_time <= request.end_time,
            )
        )
        if request.compressor_id:
            diagnosis_query = diagnosis_query.filter(
                models.Diagnosis.compressor_id == request.compressor_id
            )
        diagnoses = diagnosis_query.order_by(models.Diagnosis.diagnosis_time).all()

        anomalies_query = db.query(models.Anomaly).join(models.Diagnosis).filter(
            and_(
                models.Diagnosis.start_time >= request.start_time,
                models.Diagnosis.end_time <= request.end_time,
                models.Anomaly.is_manual_override == False,
            )
        )
        if request.compressor_id:
            anomalies_query = anomalies_query.filter(
                models.Diagnosis.compressor_id == request.compressor_id
            )
        anomalies = anomalies_query.order_by(models.Anomaly.severity.desc(), models.Anomaly.record_time).all()

        file_path, file_name = _generate_excel_report(
            compressor=compressor,
            start_time=request.start_time,
            end_time=request.end_time,
            energy_records=energy_records,
            vibration_records=vibration_records,
            diagnoses=diagnoses,
            anomalies=anomalies,
            report_hash=report_hash,
            filters=request.filters,
            view_state=request.view_state,
            view_state_hash=view_state_hash,
        )

        export_record = models.ExportRecord(
            export_time=datetime.now(),
            export_type="inspection_report",
            compressor_id=request.compressor_id,
            start_time=request.start_time,
            end_time=request.end_time,
            filters=json.dumps(request.filters, ensure_ascii=False) if request.filters else None,
            view_state=json.dumps(request.view_state, ensure_ascii=False) if request.view_state else None,
            file_path=file_path,
            file_name=file_name,
            report_hash=report_hash,
            exported_by=request.exported_by or "system",
            record_count=len(energy_records) + len(vibration_records),
        )
        db.add(export_record)
        db.commit()

        return schemas.ExportResult(
            success=True,
            message="巡检报告导出成功",
            file_path=file_path,
            file_name=file_name,
            record_count=len(energy_records) + len(vibration_records),
            report_hash=report_hash,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")


@router.get("/download/{export_id}")
def download_export(export_id: int, db: Session = Depends(get_db)):
    export_record = db.query(models.ExportRecord).filter(
        models.ExportRecord.id == export_id
    ).first()

    if not export_record:
        raise HTTPException(status_code=404, detail="导出记录不存在")

    if not os.path.exists(export_record.file_path):
        raise HTTPException(status_code=404, detail="文件已不存在")

    return FileResponse(
        path=export_record.file_path,
        filename=export_record.file_name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@router.get("/download-by-hash/{report_hash}")
def download_export_by_hash(report_hash: str, db: Session = Depends(get_db)):
    export_record = db.query(models.ExportRecord).filter(
        models.ExportRecord.report_hash == report_hash
    ).order_by(models.ExportRecord.export_time.desc()).first()

    if not export_record:
        raise HTTPException(status_code=404, detail="导出记录不存在")

    if not os.path.exists(export_record.file_path):
        raise HTTPException(status_code=404, detail="文件已不存在")

    return FileResponse(
        path=export_record.file_path,
        filename=export_record.file_name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@router.get("/list")
def list_exports(
    compressor_id: Optional[int] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.ExportRecord)

    if compressor_id:
        query = query.filter(models.ExportRecord.compressor_id == compressor_id)
    if start_time:
        query = query.filter(models.ExportRecord.export_time >= start_time)
    if end_time:
        query = query.filter(models.ExportRecord.export_time <= end_time)

    exports = query.order_by(models.ExportRecord.export_time.desc()).limit(100).all()

    return [
        {
            "id": e.id,
            "export_time": e.export_time,
            "export_type": e.export_type,
            "compressor_id": e.compressor_id,
            "start_time": e.start_time,
            "end_time": e.end_time,
            "file_name": e.file_name,
            "report_hash": e.report_hash,
            "exported_by": e.exported_by,
            "record_count": e.record_count,
        }
        for e in exports
    ]


def _calculate_view_state_hash(request: schemas.ExportRequest) -> str:
    view_state = request.view_state or {}
    view_state.update({
        "start_time": request.start_time.isoformat(),
        "end_time": request.end_time.isoformat(),
        "compressor_id": request.compressor_id,
        "filters": request.filters or {},
    })
    return hashlib.sha256(json.dumps(view_state, sort_keys=True).encode()).hexdigest()[:16]


def _calculate_report_hash(
    compressor_id: Optional[int],
    start_time: datetime,
    end_time: datetime,
    filters: Optional[Dict[str, Any]],
    view_state: Optional[Dict[str, Any]],
    view_state_hash: str,
) -> str:
    hash_input = {
        "compressor_id": compressor_id,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "filters": filters or {},
        "view_state_hash": view_state_hash,
    }
    return hashlib.sha256(json.dumps(hash_input, sort_keys=True).encode()).hexdigest()[:32]


def _generate_excel_report(
    compressor: Optional[models.Compressor],
    start_time: datetime,
    end_time: datetime,
    energy_records: list,
    vibration_records: list,
    diagnoses: list,
    anomalies: list,
    report_hash: str,
    filters: Optional[Dict[str, Any]],
    view_state: Optional[Dict[str, Any]],
    view_state_hash: str,
) -> tuple:
    export_dir = os.path.join(DATA_DIR, "exports")
    os.makedirs(export_dir, exist_ok=True)

    equipment_no = compressor.equipment_no if compressor else "ALL"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_name = f"空压机巡检报告_{equipment_no}_{start_time.strftime('%Y%m%d')}_{end_time.strftime('%Y%m%d')}_{timestamp}.xlsx"
    file_path = os.path.join(export_dir, file_name)

    with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
        _write_summary_sheet(
            writer, compressor, start_time, end_time,
            energy_records, vibration_records, diagnoses, anomalies,
            report_hash, view_state_hash
        )
        _write_energy_sheet(writer, energy_records)
        _write_vibration_sheet(writer, vibration_records)
        _write_diagnosis_sheet(writer, diagnoses)
        _write_anomalies_sheet(writer, anomalies)
        _write_threshold_sheet(writer)
        _write_audit_sheet(writer, filters, view_state, report_hash, view_state_hash)

    return file_path, file_name


def _write_summary_sheet(
    writer, compressor, start_time, end_time,
    energy_records, vibration_records, diagnoses, anomalies,
    report_hash, view_state_hash
):
    data = []
    equipment_no = compressor.equipment_no if compressor else "全部设备"
    equipment_name = compressor.name if compressor else "-"

    critical_count = len([a for a in anomalies if a.severity == "critical"])
    warning_count = len([a for a in anomalies if a.severity == "warning"])

    total_energy = 0
    if energy_records:
        powers = [r.power or 0 for r in energy_records]
        times = [r.record_time for r in energy_records]
        for i in range(1, len(energy_records)):
            dt = (times[i] - times[i-1]).total_seconds() / 3600
            total_energy += (powers[i] + powers[i-1]) / 2 * dt

    avg_load = 0
    if energy_records:
        loads = [r.load_rate or 0 for r in energy_records if r.load_rate is not None]
        if loads:
            avg_load = sum(loads) / len(loads)

    avg_vib = 0
    if vibration_records:
        vibs = [r.overall_vibration or 0 for r in vibration_records if r.overall_vibration is not None]
        if vibs:
            avg_vib = sum(vibs) / len(vibs)

    data.extend([
        ["空压机能耗诊断 - 巡检报告", ""],
        ["", ""],
        ["设备编号", equipment_no],
        ["设备名称", equipment_name],
        ["报告时间范围", f"{start_time.strftime('%Y-%m-%d %H:%M:%S')} ~ {end_time.strftime('%Y-%m-%d %H:%M:%S')}"],
        ["报告生成时间", datetime.now().strftime('%Y-%m-%d %H:%M:%S')],
        ["报告哈希", report_hash],
        ["视图状态哈希", view_state_hash],
        ["", ""],
        ["一、运行概览", ""],
        ["能耗记录数", len(energy_records)],
        ["振动记录数", len(vibration_records)],
        ["诊断次数", len(diagnoses)],
        ["总能耗(kWh)", round(total_energy, 2)],
        ["平均负载率(%)", round(avg_load, 2)],
        ["平均总振动(mm/s)", round(avg_vib, 4)],
        ["", ""],
        ["二、异常统计", ""],
        ["严重异常数", critical_count],
        ["警告异常数", warning_count],
        ["总异常数", critical_count + warning_count],
    ])

    if diagnoses:
        data.extend([
            ["", ""],
            ["三、诊断摘要", ""],
            ["诊断时间", "能效(%)", "负载率(%)", "异常分数", "异常数", "状态"],
        ])
        for d in diagnoses[-10:]:
            data.append([
                d.diagnosis_time.strftime('%Y-%m-%d %H:%M:%S'),
                d.energy_efficiency,
                d.load_rate_avg,
                d.anomaly_score,
                d.abnormal_count,
                d.status,
            ])

    if anomalies:
        data.extend([
            ["", ""],
            ["四、TOP异常", ""],
            ["时间", "参数", "实际值", "等级", "描述"],
        ])
        for a in anomalies[:20]:
            data.append([
                a.record_time.strftime('%Y-%m-%d %H:%M:%S'),
                a.parameter,
                a.actual_value,
                a.severity,
                a.description,
            ])

    df = pd.DataFrame(data)
    df.to_excel(writer, sheet_name="报告摘要", index=False, header=False)

    worksheet = writer.sheets["报告摘要"]
    for i in range(len(data)):
        worksheet.row_dimensions[i+1].height = 20
    worksheet.column_dimensions['A'].width = 25
    worksheet.column_dimensions['B'].width = 50


def _write_energy_sheet(writer, energy_records):
    data = []
    for r in energy_records:
        data.append({
            "记录时间": r.record_time.strftime('%Y-%m-%d %H:%M:%S'),
            "功率(kW)": r.power,
            "电流(A)": r.current,
            "电压(V)": r.voltage,
            "压力(MPa)": r.pressure,
            "流量(m³/min)": r.flow_rate,
            "温度(℃)": r.temperature,
            "运行小时(h)": r.running_hours,
            "负载率(%)": r.load_rate,
            "是否人工修正": "是" if r.is_manual_edited else "否",
            "修正人": r.edited_by,
            "修正时间": r.edited_at.strftime('%Y-%m-%d %H:%M:%S') if r.edited_at else "",
        })

    df = pd.DataFrame(data)
    df.to_excel(writer, sheet_name="能耗数据", index=False)

    worksheet = writer.sheets["能耗数据"]
    for col in worksheet.columns:
        max_length = 0
        column = col[0].column_letter
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = min(max_length + 2, 30)
        worksheet.column_dimensions[column].width = adjusted_width


def _write_vibration_sheet(writer, vibration_records):
    data = []
    for r in vibration_records:
        data.append({
            "记录时间": r.record_time.strftime('%Y-%m-%d %H:%M:%S'),
            "X向振动(mm/s)": r.x_vibration,
            "Y向振动(mm/s)": r.y_vibration,
            "Z向振动(mm/s)": r.z_vibration,
            "总振动(mm/s)": r.overall_vibration,
            "是否人工修正": "是" if r.is_manual_edited else "否",
            "修正人": r.edited_by,
            "修正时间": r.edited_at.strftime('%Y-%m-%d %H:%M:%S') if r.edited_at else "",
        })

    df = pd.DataFrame(data)
    df.to_excel(writer, sheet_name="振动数据", index=False)

    worksheet = writer.sheets["振动数据"]
    for col in worksheet.columns:
        max_length = 0
        column = col[0].column_letter
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = min(max_length + 2, 30)
        worksheet.column_dimensions[column].width = adjusted_width


def _write_diagnosis_sheet(writer, diagnoses):
    data = []
    for d in diagnoses:
        data.append({
            "诊断时间": d.diagnosis_time.strftime('%Y-%m-%d %H:%M:%S'),
            "时间范围": f"{d.start_time.strftime('%Y-%m-%d')} ~ {d.end_time.strftime('%Y-%m-%d')}",
            "总能耗(kWh)": d.energy_consumption,
            "能效(%)": d.energy_efficiency,
            "平均负载率(%)": d.load_rate_avg,
            "异常分数": d.anomaly_score,
            "异常数": d.abnormal_count,
            "状态": d.status,
            "复核人": d.reviewed_by,
            "复核时间": d.reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if d.reviewed_at else "",
            "复核意见": d.review_comment,
            "是否人工修正": "是" if d.is_manual_corrected else "否",
            "修正人": d.corrected_by,
            "修正时间": d.corrected_at.strftime('%Y-%m-%d %H:%M:%S') if d.corrected_at else "",
            "修正说明": d.correction_note,
            "报告哈希": d.report_hash,
        })

    df = pd.DataFrame(data)
    df.to_excel(writer, sheet_name="诊断记录", index=False)

    worksheet = writer.sheets["诊断记录"]
    for col in worksheet.columns:
        max_length = 0
        column = col[0].column_letter
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = min(max_length + 2, 40)
        worksheet.column_dimensions[column].width = adjusted_width


def _write_anomalies_sheet(writer, anomalies):
    data = []
    for a in anomalies:
        data.append({
            "记录时间": a.record_time.strftime('%Y-%m-%d %H:%M:%S'),
            "参数": a.parameter,
            "实际值": a.actual_value,
            "阈值等级": a.threshold_level,
            "阈值下限": a.threshold_min,
            "阈值上限": a.threshold_max,
            "偏差(%)": round(a.deviation, 2),
            "严重程度": a.severity,
            "异常描述": a.description,
            "处理建议": a.recommendation,
            "是否人工忽略": "是" if a.is_manual_override else "否",
            "忽略说明": a.override_note,
        })

    df = pd.DataFrame(data)
    df.to_excel(writer, sheet_name="异常记录", index=False)

    worksheet = writer.sheets["异常记录"]
    for col in worksheet.columns:
        max_length = 0
        column = col[0].column_letter
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = min(max_length + 2, 50)
        worksheet.column_dimensions[column].width = adjusted_width


def _write_threshold_sheet(writer):
    thresholds = threshold_manager.get_all_thresholds_dict()
    data = []
    for param, levels in thresholds.items():
        for level in levels:
            data.append({
                "参数": param,
                "等级": level["level"],
                "最小值": level["min_value"],
                "最大值": level["max_value"],
                "说明": level["description"],
            })

    df = pd.DataFrame(data)
    df.to_excel(writer, sheet_name="阈值标准", index=False)

    worksheet = writer.sheets["阈值标准"]
    for col in worksheet.columns:
        max_length = 0
        column = col[0].column_letter
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = min(max_length + 2, 40)
        worksheet.column_dimensions[column].width = adjusted_width


def _write_audit_sheet(writer, filters, view_state, report_hash, view_state_hash):
    data = [
        ["导出审计信息", ""],
        ["", ""],
        ["报告哈希", report_hash],
        ["视图状态哈希", view_state_hash],
        ["导出时间", datetime.now().strftime('%Y-%m-%d %H:%M:%S')],
        ["", ""],
        ["筛选条件", json.dumps(filters, ensure_ascii=False, indent=2) if filters else "无"],
        ["", ""],
        ["视图状态", json.dumps(view_state, ensure_ascii=False, indent=2) if view_state else "无"],
        ["", ""],
        ["一致性说明", "本报告内容与导出时屏幕显示范围完全一致，可通过视图状态哈希校验。"],
    ]

    df = pd.DataFrame(data)
    df.to_excel(writer, sheet_name="审计信息", index=False, header=False)

    worksheet = writer.sheets["审计信息"]
    worksheet.column_dimensions['A'].width = 20
    worksheet.column_dimensions['B'].width = 80
    for i in range(len(data)):
        worksheet.row_dimensions[i+1].height = 20
