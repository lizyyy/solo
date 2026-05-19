import pandas as pd
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import QualityRecord, LabMeasurement, ReworkRecord, PaperBatch
from typing import Optional

def export_quality_records_to_excel(
    db: Session,
    inspector: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    status: Optional[str] = None,
    anomaly_type: Optional[str] = None,
    batch_number: Optional[str] = None,
    output_path: str = "quality_report.xlsx"
):
    query = db.query(QualityRecord)
    
    if inspector:
        query = query.filter(QualityRecord.inspector == inspector)
    if start_time:
        query = query.filter(QualityRecord.inspection_time >= start_time)
    if end_time:
        query = query.filter(QualityRecord.inspection_time <= end_time)
    if status:
        query = query.filter(QualityRecord.status == status)
    if anomaly_type:
        query = query.filter(QualityRecord.anomaly_type == anomaly_type)
    if batch_number:
        query = query.filter(QualityRecord.batch_number.contains(batch_number))
    
    records = query.order_by(QualityRecord.inspection_time.desc()).all()
    
    summary_data = []
    measurement_data = []
    rework_data = []
    
    for record in records:
        paper_batch = record.paper_batch
        summary_data.append({
            "记录ID": record.id,
            "批次号": record.batch_number,
            "产品类型": record.product_type,
            "纸张批次": paper_batch.batch_number if paper_batch else "",
            "纸张类型": paper_batch.paper_type if paper_batch else "",
            "检验员": record.inspector,
            "检验时间": record.inspection_time.strftime("%Y-%m-%d %H:%M:%S"),
            "状态": record.status,
            "总体结果": record.overall_result,
            "判定原因": record.reason,
            "异常类型": record.anomaly_type or "",
            "留样": "是" if record.sample_retained else "否",
            "备注": record.notes or ""
        })
        
        for meas in record.lab_measurements:
            measurement_data.append({
                "记录ID": record.id,
                "批次号": record.batch_number,
                "测点": meas.measurement_point,
                "L值": meas.l_value,
                "a值": meas.a_value,
                "b值": meas.b_value,
                "标准L": meas.standard_l,
                "标准a": meas.standard_a,
                "标准b": meas.standard_b,
                "ΔL": meas.delta_l,
                "Δa": meas.delta_a,
                "Δb": meas.delta_b,
                "ΔE": meas.delta_e,
                "异常": "是" if meas.is_anomaly else "否",
                "异常原因": meas.anomaly_reason or ""
            })
        
        for rework in record.rework_records:
            rework_data.append({
                "记录ID": record.id,
                "批次号": record.batch_number,
                "返工类型": rework.rework_type,
                "返工原因": rework.rework_reason,
                "操作员": rework.operator or "",
                "返工时间": rework.rework_time.strftime("%Y-%m-%d %H:%M:%S"),
                "结果": rework.result,
                "备注": rework.notes or ""
            })
    
    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        df_summary = pd.DataFrame(summary_data)
        df_summary.to_excel(writer, sheet_name='检验汇总', index=False)
        
        df_measurements = pd.DataFrame(measurement_data)
        df_measurements.to_excel(writer, sheet_name='Lab测量数据', index=False)
        
        if rework_data:
            df_rework = pd.DataFrame(rework_data)
            df_rework.to_excel(writer, sheet_name='返工记录', index=False)
    
    return output_path
