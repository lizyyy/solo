from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from sqlalchemy.orm import Session
from database import Bed, Patient, Admission, TransferRecord, TurnoverInterval, TurnoverReport
from schemas import TurnoverCalculationRequest
import uuid


def calculate_duration_hours(start: datetime, end: datetime) -> float:
    duration = end - start
    return round(duration.total_seconds() / 3600, 2)


def check_abnormal_interval(duration_hours: float, threshold: float) -> Tuple[bool, str]:
    if duration_hours <= 0:
        return True, "时间区间无效：结束时间早于或等于开始时间"
    if duration_hours > threshold:
        return True, f"周转时间过长（{duration_hours:.1f}小时，阈值{threshold}小时）"
    if duration_hours < 1:
        return True, f"周转时间过短（{duration_hours:.2f}小时，疑似临时占床）"
    return False, ""


def split_by_transfers(
    admission: Admission,
    transfers: List[TransferRecord],
    start_date: datetime,
    end_date: datetime
) -> List[Dict]:
    intervals = []
    current_start = max(admission.admission_time, start_date)
    
    sorted_transfers = sorted(transfers, key=lambda x: x.transfer_time)
    
    for transfer in sorted_transfers:
        if transfer.transfer_time <= current_start:
            continue
        if transfer.transfer_time > end_date:
            break
        
        interval_end = min(transfer.transfer_time, end_date)
        if interval_end > current_start:
            intervals.append({
                "bed_id": transfer.from_bed_id,
                "interval_start": current_start,
                "interval_end": interval_end,
                "ward": transfer.from_ward,
                "has_transfer": True,
                "is_transfer_end": True
            })
        current_start = transfer.transfer_time
    
    final_end = admission.discharge_time or end_date
    final_end = min(final_end, end_date)
    
    if final_end > current_start:
        intervals.append({
            "bed_id": admission.bed_id,
            "interval_start": current_start,
            "interval_end": final_end,
            "ward": admission.ward,
            "has_transfer": len(sorted_transfers) > 0,
            "is_transfer_end": False
        })
    
    return intervals


def process_admission_intervals(
    db: Session,
    admission: Admission,
    patient: Patient,
    bed: Bed,
    transfers: List[TransferRecord],
    start_date: datetime,
    end_date: datetime,
    abnormal_threshold: float,
    report_id: str
) -> List[TurnoverInterval]:
    intervals = []
    
    split_intervals = split_by_transfers(admission, transfers, start_date, end_date)
    
    for idx, interval_data in enumerate(split_intervals):
        duration = calculate_duration_hours(
            interval_data["interval_start"],
            interval_data["interval_end"]
        )
        is_abnormal, abnormal_reason = check_abnormal_interval(duration, abnormal_threshold)
        
        interval_bed = db.query(Bed).filter(Bed.id == interval_data["bed_id"]).first()
        
        interval = TurnoverInterval(
            bed_id=interval_data["bed_id"],
            bed_number=interval_bed.bed_number if interval_bed else "Unknown",
            ward=interval_data["ward"],
            patient_id=patient.patient_id,
            patient_name=patient.name,
            admission_number=admission.admission_number,
            interval_start=interval_data["interval_start"],
            interval_end=interval_data["interval_end"],
            duration_hours=duration,
            interval_type="occupied",
            is_abnormal=is_abnormal,
            abnormal_reason=abnormal_reason if is_abnormal else None,
            is_pre_discharge=admission.is_pre_discharge,
            has_transfer=interval_data["has_transfer"],
            transfer_count=len(transfers),
            report_id=report_id,
            status="processed",
            needs_review=is_abnormal
        )
        intervals.append(interval)
    
    return intervals


def generate_turnover_report(
    db: Session,
    request: TurnoverCalculationRequest
) -> Tuple[TurnoverReport, List[TurnoverInterval]]:
    report_id = f"RPT{datetime.now().strftime('%Y%m%d')}{uuid.uuid4().hex[:6].upper()}"
    
    report_name = request.report_name or f"{request.ward}周转报告_{request.start_date.strftime('%Y%m%d')}"
    
    ward = request.ward
    
    ward_admission_numbers = set()
    
    admissions_in_ward = db.query(Admission).filter(
        Admission.ward == ward,
        Admission.admission_time < request.end_date,
        (Admission.discharge_time.is_(None) | (Admission.discharge_time > request.start_date))
    ).all()
    for adm in admissions_in_ward:
        ward_admission_numbers.add(adm.admission_number)
    
    transfers_from_ward = db.query(TransferRecord).filter(
        TransferRecord.from_ward == ward,
        TransferRecord.transfer_time >= request.start_date,
        TransferRecord.transfer_time <= request.end_date
    ).all()
    for trans in transfers_from_ward:
        ward_admission_numbers.add(trans.admission_number)
    
    transfers_to_ward = db.query(TransferRecord).filter(
        TransferRecord.to_ward == ward,
        TransferRecord.transfer_time >= request.start_date,
        TransferRecord.transfer_time <= request.end_date
    ).all()
    for trans in transfers_to_ward:
        ward_admission_numbers.add(trans.admission_number)
    
    all_candidate_intervals = []
    
    for admission_number in ward_admission_numbers:
        admission = db.query(Admission).filter(
            Admission.admission_number == admission_number
        ).first()
        if not admission:
            continue
            
        patient = db.query(Patient).filter(Patient.patient_id == admission.patient_id).first()
        bed = db.query(Bed).filter(Bed.id == admission.bed_id).first()
        
        transfers = db.query(TransferRecord).filter(
            TransferRecord.admission_number == admission.admission_number,
            TransferRecord.transfer_time >= request.start_date,
            TransferRecord.transfer_time <= request.end_date
        ).order_by(TransferRecord.transfer_time).all()
        
        if patient and bed:
            intervals = process_admission_intervals(
                db, admission, patient, bed, transfers,
                request.start_date, request.end_date,
                request.abnormal_threshold_hours,
                report_id
            )
            all_candidate_intervals.extend(intervals)
    
    ward_intervals = [i for i in all_candidate_intervals if i.ward == ward]
    
    total_intervals = len(ward_intervals)
    abnormal_intervals = sum(1 for i in ward_intervals if i.is_abnormal)
    transfer_count = sum(1 for i in ward_intervals if i.has_transfer)
    pre_discharge_count = sum(1 for i in ward_intervals if i.is_pre_discharge)
    avg_turnover = (
        sum(i.duration_hours for i in ward_intervals) / total_intervals
        if total_intervals > 0 else 0
    )
    
    report = TurnoverReport(
        report_id=report_id,
        report_name=report_name,
        ward=ward,
        start_date=request.start_date,
        end_date=request.end_date,
        total_intervals=total_intervals,
        abnormal_intervals=abnormal_intervals,
        transfer_count=transfer_count,
        pre_discharge_count=pre_discharge_count,
        average_turnover_hours=round(avg_turnover, 2),
        status="generated",
        generated_by=request.generated_by
    )
    
    db.add(report)
    for interval in ward_intervals:
        db.add(interval)
    db.commit()
    db.refresh(report)
    
    return report, ward_intervals


def review_intervals(
    db: Session,
    interval_ids: List[int],
    review_notes: str,
    reviewed_by: str,
    approve: bool
) -> List[TurnoverInterval]:
    intervals = db.query(TurnoverInterval).filter(
        TurnoverInterval.id.in_(interval_ids)
    ).all()
    
    reviewed_at = datetime.utcnow()
    
    for interval in intervals:
        if interval.status == "reviewed":
            continue
        interval.needs_review = not approve
        interval.review_notes = review_notes
        interval.reviewed_by = reviewed_by
        interval.reviewed_at = reviewed_at
        interval.status = "reviewed"
    
    db.commit()
    return intervals


def export_report_to_excel(
    db: Session,
    report_id: str,
    output_path: str
) -> Dict:
    import pandas as pd
    
    report = db.query(TurnoverReport).filter(TurnoverReport.report_id == report_id).first()
    if not report:
        raise ValueError("Report not found")
    
    intervals = db.query(TurnoverInterval).filter(
        TurnoverInterval.report_id == report_id
    ).order_by(TurnoverInterval.bed_number, TurnoverInterval.interval_start).all()
    
    data = []
    for interval in intervals:
        data.append({
            "床位号": interval.bed_number,
            "病区": interval.ward,
            "患者ID": interval.patient_id,
            "患者姓名": interval.patient_name,
            "住院号": interval.admission_number,
            "开始时间": interval.interval_start.strftime("%Y-%m-%d %H:%M:%S"),
            "结束时间": interval.interval_end.strftime("%Y-%m-%d %H:%M:%S"),
            "时长(小时)": interval.duration_hours,
            "是否异常": "是" if interval.is_abnormal else "否",
            "异常原因": interval.abnormal_reason or "",
            "是否预出院": "是" if interval.is_pre_discharge else "否",
            "是否转科": "是" if interval.has_transfer else "否",
            "转科次数": interval.transfer_count,
            "需人工复核": "是" if interval.needs_review else "否",
            "复核备注": interval.review_notes or "",
            "复核人": interval.reviewed_by or "",
            "复核时间": interval.reviewed_at.strftime("%Y-%m-%d %H:%M:%S") if interval.reviewed_at else ""
        })
    
    df = pd.DataFrame(data)
    
    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='周转明细', index=False)
        
        summary_data = {
            "项目": [
                "报告ID", "报告名称", "病区", "开始日期", "结束日期",
                "总区间数", "异常区间数", "转科次数", "预出院次数", "平均周转时长(小时)"
            ],
            "数值": [
                report.report_id,
                report.report_name,
                report.ward,
                report.start_date.strftime("%Y-%m-%d"),
                report.end_date.strftime("%Y-%m-%d"),
                report.total_intervals,
                report.abnormal_intervals,
                report.transfer_count,
                report.pre_discharge_count,
                report.average_turnover_hours
            ]
        }
        pd.DataFrame(summary_data).to_excel(writer, sheet_name='报告汇总', index=False)
    
    report.exported_at = datetime.utcnow()
    db.commit()
    
    return {
        "report_id": report_id,
        "export_path": output_path,
        "record_count": len(data),
        "exported_at": report.exported_at
    }
