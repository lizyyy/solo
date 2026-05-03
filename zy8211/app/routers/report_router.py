from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from datetime import datetime, date, timedelta
from typing import Optional, List
import io
import csv
from io import StringIO

from app.models import (
    get_db, DehydratorRun, ChemicalBatch, LabMoistureResult,
    ExceptionReview, ReviewRule, ExceptionType
)

router = APIRouter(prefix="/report", tags=["报告接口"])


def generate_markdown_report(
    start_date: date,
    end_date: date,
    db: Session
) -> str:
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())
    
    runs = db.query(DehydratorRun).filter(
        DehydratorRun.shift_date >= start_dt,
        DehydratorRun.shift_date <= end_dt
    ).all()
    
    total_runs = len(runs)
    total_feed_volume = sum(r.feed_sludge_volume for r in runs)
    total_dry_solids = sum(r.dry_solids_input or 0 for r in runs)
    
    lab_results = db.query(LabMoistureResult).filter(
        LabMoistureResult.sample_time >= start_dt,
        LabMoistureResult.sample_time <= end_dt
    ).all()
    
    avg_moisture = None
    if lab_results:
        avg_moisture = sum(r.moisture_content for r in lab_results) / len(lab_results)
    
    exceptions = db.query(ExceptionReview).filter(
        ExceptionReview.created_at >= start_dt,
        ExceptionReview.created_at <= end_dt
    ).all()
    
    total_exceptions = len(exceptions)
    resolved = sum(1 for e in exceptions if e.is_resolved)
    unresolved = total_exceptions - resolved
    
    batches = db.query(ChemicalBatch).filter(
        ChemicalBatch.start_time <= end_dt,
        (ChemicalBatch.end_time == None) | (ChemicalBatch.end_time >= start_dt)
    ).all()
    
    markdown = f"""# 污泥脱水药剂投加复核报告

**报告周期**: {start_date.strftime('%Y-%m-%d')} 至 {end_date.strftime('%Y-%m-%d')}

**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## 一、运行概览

| 指标 | 数值 |
|------|------|
| 总运行次数 | {total_runs} |
| 总进泥量 | {total_feed_volume:.2f} m³ |
| 总绝干泥量 | {total_dry_solids:.2f} t |
| 平均含水率 | {avg_moisture:.2f}% |

---

## 二、药剂批次统计

"""
    
    if batches:
        markdown += "| 批次ID | 药剂类型 | 运行次数 | 进泥量 | 绝干泥量 | 投加率 | 平均含水率 |\n"
        markdown += "|--------|----------|----------|--------|----------|--------|------------|\n"
        
        for batch in batches:
            batch_runs = [r for r in runs if r.batch_id == batch.batch_id]
            batch_feed = sum(r.feed_sludge_volume for r in batch_runs)
            batch_dry = sum(r.dry_solids_input or 0 for r in batch_runs)
            
            actual_rate = None
            if batch_dry > 0 and batch.total_chemical_used:
                actual_rate = batch.total_chemical_used / batch_dry
            
            batch_labs = [l for l in lab_results if l.batch_id == batch.batch_id]
            batch_moisture = None
            if batch_labs:
                batch_moisture = sum(l.moisture_content for l in batch_labs) / len(batch_labs)
            
            rate_str = f"{actual_rate:.3f} kg/t" if actual_rate else "-"
            moisture_str = f"{batch_moisture:.2f}%" if batch_moisture else "-"
            
            markdown += f"| {batch.batch_id} | {batch.chemical_type} | {len(batch_runs)} | {batch_feed:.2f} m³ | {batch_dry:.2f} t | {rate_str} | {moisture_str} |\n"
    else:
        markdown += "无药剂批次数据\n"
    
    markdown += """
---

## 三、异常复核统计

"""
    
    exception_types = {}
    for e in exceptions:
        if e.exception_type not in exception_types:
            exception_types[e.exception_type] = {"total": 0, "resolved": 0, "unresolved": 0}
        exception_types[e.exception_type]["total"] += 1
        if e.is_resolved:
            exception_types[e.exception_type]["resolved"] += 1
        else:
            exception_types[e.exception_type]["unresolved"] += 1
    
    markdown += f"**总异常数**: {total_exceptions}, **已处理**: {resolved}, **未处理**: {unresolved}\n\n"
    
    if exception_types:
        markdown += "| 异常类型 | 总数 | 已处理 | 未处理 |\n"
        markdown += "|----------|------|--------|--------|\n"
        
        type_names = {
            "dosage_mismatch": "投加量不匹配",
            "feed_sludge_mismatch": "进泥量异常",
            "moisture_exceed": "含水率超标",
            "cross_shift_batch": "跨班次批次",
            "missing_batch": "缺失批次",
            "missing_lab_result": "缺失检测结果"
        }
        
        for exc_type, stats in exception_types.items():
            display_name = type_names.get(exc_type, exc_type)
            markdown += f"| {display_name} | {stats['total']} | {stats['resolved']} | {stats['unresolved']} |\n"
    
    markdown += """
---

## 四、未处理异常详情

"""
    
    unresolved_exceptions = [e for e in exceptions if not e.is_resolved]
    
    if unresolved_exceptions:
        markdown += "| 异常ID | 运行ID | 异常类型 | 描述 | 创建时间 |\n"
        markdown += "|--------|--------|----------|------|----------|\n"
        
        for e in unresolved_exceptions:
            display_type = type_names.get(e.exception_type, e.exception_type)
            markdown += f"| {e.review_id} | {e.run_id} | {display_type} | {e.exception_message} | {e.created_at.strftime('%Y-%m-%d %H:%M')} |\n"
    else:
        markdown += "暂无未处理异常\n"
    
    markdown += """
---

## 五、复核规则

"""
    
    rules = db.query(ReviewRule).filter(ReviewRule.is_enabled == True).all()
    
    if rules:
        markdown += "| 规则ID | 规则名称 | 类型 | 阈值/范围 | 优先级 |\n"
        markdown += "|--------|----------|------|-----------|--------|\n"
        
        for rule in rules:
            range_str = ""
            if rule.threshold_value:
                range_str = f"阈值: {rule.threshold_value}"
            elif rule.min_value and rule.max_value:
                range_str = f"{rule.min_value} - {rule.max_value}"
            elif rule.min_value:
                range_str = f">= {rule.min_value}"
            elif rule.max_value:
                range_str = f"<= {rule.max_value}"
            
            markdown += f"| {rule.rule_id} | {rule.rule_name} | {rule.rule_type} | {range_str} | {rule.priority} |\n"
    else:
        markdown += "无启用的复核规则\n"
    
    return markdown


def generate_csv_report(
    start_date: date,
    end_date: date,
    db: Session
) -> str:
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())
    
    runs = db.query(DehydratorRun).filter(
        DehydratorRun.shift_date >= start_dt,
        DehydratorRun.shift_date <= end_dt
    ).order_by(DehydratorRun.start_time).all()
    
    output = StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "运行ID", "脱水机", "开始时间", "结束时间", "班次",
        "进泥量(m³)", "进泥浓度(%)", "绝干泥量(t)",
        "药剂批次", "投加量(kg)", "投加率(kg/t)",
        "含水率(%)", "异常数", "已处理异常"
    ])
    
    for run in runs:
        batch = None
        if run.batch_id:
            batch = db.query(ChemicalBatch).filter(
                ChemicalBatch.batch_id == run.batch_id
            ).first()
        
        lab_results = db.query(LabMoistureResult).filter(
            LabMoistureResult.run_id == run.run_id
        ).all()
        
        avg_moisture = None
        if lab_results:
            avg_moisture = sum(r.moisture_content for r in lab_results) / len(lab_results)
        
        exceptions = db.query(ExceptionReview).filter(
            ExceptionReview.run_id == run.run_id
        ).all()
        
        exception_count = len(exceptions)
        resolved_count = sum(1 for e in exceptions if e.is_resolved)
        
        dosage_rate = None
        chemical_used = None
        if batch and batch.total_chemical_used:
            chemical_used = batch.total_chemical_used
            if run.dry_solids_input and run.dry_solids_input > 0:
                dosage_rate = batch.total_chemical_used / run.dry_solids_input
        
        writer.writerow([
            run.run_id,
            run.machine_id,
            run.start_time.strftime('%Y-%m-%d %H:%M:%S') if run.start_time else "",
            run.end_time.strftime('%Y-%m-%d %H:%M:%S') if run.end_time else "",
            run.shift,
            f"{run.feed_sludge_volume:.2f}" if run.feed_sludge_volume else "",
            f"{run.feed_sludge_concentration:.2f}" if run.feed_sludge_concentration else "",
            f"{run.dry_solids_input:.2f}" if run.dry_solids_input else "",
            run.batch_id or "",
            f"{chemical_used:.2f}" if chemical_used else "",
            f"{dosage_rate:.3f}" if dosage_rate else "",
            f"{avg_moisture:.2f}" if avg_moisture else "",
            exception_count,
            resolved_count
        ])
    
    return output.getvalue()


@router.get("/markdown")
def export_markdown_report(
    start_date: date = Query(..., description="开始日期"),
    end_date: date = Query(..., description="结束日期"),
    db: Session = Depends(get_db)
):
    markdown = generate_markdown_report(start_date, end_date, db)
    
    return StreamingResponse(
        io.BytesIO(markdown.encode('utf-8')),
        media_type="text/markdown",
        headers={
            "Content-Disposition": f"attachment; filename=sludge_report_{start_date}_{end_date}.md"
        }
    )


@router.get("/csv")
def export_csv_report(
    start_date: date = Query(..., description="开始日期"),
    end_date: date = Query(..., description="结束日期"),
    db: Session = Depends(get_db)
):
    csv_content = generate_csv_report(start_date, end_date, db)
    
    return StreamingResponse(
        io.BytesIO(csv_content.encode('utf-8-sig')),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=sludge_report_{start_date}_{end_date}.csv"
        }
    )


@router.get("/exceptions/csv")
def export_exceptions_csv(
    start_date: Optional[date] = Query(None, description="开始日期"),
    end_date: Optional[date] = Query(None, description="结束日期"),
    is_resolved: Optional[bool] = Query(None, description="是否已处理"),
    db: Session = Depends(get_db)
):
    query = db.query(ExceptionReview)
    
    if start_date:
        start_dt = datetime.combine(start_date, datetime.min.time())
        query = query.filter(ExceptionReview.created_at >= start_dt)
    
    if end_date:
        end_dt = datetime.combine(end_date, datetime.max.time())
        query = query.filter(ExceptionReview.created_at <= end_dt)
    
    if is_resolved is not None:
        query = query.filter(ExceptionReview.is_resolved == is_resolved)
    
    exceptions = query.order_by(ExceptionReview.created_at.desc()).all()
    
    output = StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "异常ID", "运行ID", "异常类型", "异常描述",
        "是否已处理", "处理说明", "处理人", "处理时间", "创建时间"
    ])
    
    type_names = {
        "dosage_mismatch": "投加量不匹配",
        "feed_sludge_mismatch": "进泥量异常",
        "moisture_exceed": "含水率超标",
        "cross_shift_batch": "跨班次批次",
        "missing_batch": "缺失批次",
        "missing_lab_result": "缺失检测结果"
    }
    
    for e in exceptions:
        display_type = type_names.get(e.exception_type, e.exception_type)
        writer.writerow([
            e.review_id,
            e.run_id,
            display_type,
            e.exception_message,
            "是" if e.is_resolved else "否",
            e.resolution_note or "",
            e.resolved_by or "",
            e.resolved_at.strftime('%Y-%m-%d %H:%M:%S') if e.resolved_at else "",
            e.created_at.strftime('%Y-%m-%d %H:%M:%S')
        ])
    
    csv_content = output.getvalue()
    
    filename = "exceptions"
    if start_date and end_date:
        filename = f"exceptions_{start_date}_{end_date}"
    
    return StreamingResponse(
        io.BytesIO(csv_content.encode('utf-8-sig')),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}.csv"
        }
    )
