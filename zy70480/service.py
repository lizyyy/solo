import hashlib
import json
import time
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from models import Batch, RecordingRecord, CompensationResult, ManualCorrection, ProcessingReport
from schemas import BatchCreate, SourceType, BatchStatus, ManualCorrectionCreate

def calculate_content_hash(records_data: List[Dict]) -> str:
    sorted_records = sorted(records_data, key=lambda x: x.get('recording_id', ''))
    content_str = json.dumps(sorted_records, sort_keys=True, default=str)
    return hashlib.sha256(content_str.encode()).hexdigest()

def generate_sample_cross_day_data() -> List[Dict]:
    base_time = datetime.now() - timedelta(days=2)
    samples = [
        {
            "recording_id": "REC-2026-001",
            "customer_id": "CUST-001",
            "agent_id": "AGENT-05",
            "call_time": base_time - timedelta(hours=48),
            "duration": 320,
            "source_channel": "phone",
            "issue_type": "refund_delay",
            "content_summary": "用户投诉退款申请提交3天未处理，客服承诺24小时内处理但超时",
            "is_mixed_source": False,
            "original_status": "unprocessed"
        },
        {
            "recording_id": "REC-2026-002",
            "customer_id": "CUST-002",
            "agent_id": "AGENT-12",
            "call_time": base_time - timedelta(hours=36),
            "duration": 450,
            "source_channel": "phone",
            "issue_type": "quality_issue",
            "content_summary": "用户收到商品有质量问题，要求退换货但客服态度消极",
            "is_mixed_source": False,
            "original_status": "pending"
        },
        {
            "recording_id": "REC-2026-003",
            "customer_id": "CUST-003",
            "agent_id": "AGENT-08",
            "call_time": base_time - timedelta(hours=24),
            "duration": 180,
            "source_channel": "chat",
            "issue_type": "miscommunication",
            "content_summary": "客服信息传达错误，导致用户错过促销活动",
            "is_mixed_source": False,
            "original_status": "escalated"
        },
        {
            "recording_id": "REC-2026-004",
            "customer_id": "CUST-004",
            "agent_id": "AGENT-15",
            "call_time": base_time - timedelta(hours=12),
            "duration": 520,
            "source_channel": "phone",
            "issue_type": "billing_error",
            "content_summary": "账单重复扣费，用户多次来电要求处理均未得到解决",
            "is_mixed_source": False,
            "original_status": "unprocessed"
        },
        {
            "recording_id": "REC-2026-005",
            "customer_id": "CUST-005",
            "agent_id": "AGENT-20",
            "call_time": base_time - timedelta(hours=6),
            "duration": 280,
            "source_channel": "app",
            "issue_type": "mixed_source_issue",
            "content_summary": "该记录来源混杂：同时涉及退款申请、商品投诉、服务态度多项问题，系统来源标记不明确",
            "is_mixed_source": True,
            "original_status": "conflict"
        },
        {
            "recording_id": "REC-2026-006",
            "customer_id": "CUST-006",
            "agent_id": "AGENT-03",
            "call_time": base_time - timedelta(hours=2),
            "duration": 390,
            "source_channel": "phone",
            "issue_type": "delivery_delay",
            "content_summary": "商品超时配送，用户要求赔偿运费和时间损失",
            "is_mixed_source": False,
            "original_status": "pending"
        }
    ]
    return samples

def determine_compensation(record: RecordingRecord) -> Tuple[str, float, str]:
    if record.is_mixed_source:
        return ("partial_compensation", 50.0, "来源混杂问题，部分补偿待进一步核实")
    
    compensation_rules = {
        "refund_delay": ("full_refund", 100.0, "退款延迟超过24小时，全额退款补偿"),
        "quality_issue": ("product_replace", 80.0, "商品质量问题，退换货+80元代金券"),
        "miscommunication": ("coupon_compensation", 30.0, "客服传达错误，30元代金券补偿"),
        "billing_error": ("refund + compensation", 150.0, "重复扣费错误，退款+150元现金补偿"),
        "delivery_delay": ("shipping_refund", 20.0, "配送延迟，退还运费+20元优惠券"),
        "mixed_source_issue": ("partial_compensation", 50.0, "多问题混合，先部分补偿")
    }
    
    rule = compensation_rules.get(record.issue_type, ("review_required", 0.0, "需要人工审核"))
    return rule

def process_single_record(record: RecordingRecord, db: Session) -> CompensationResult:
    start_time = time.time()
    
    result_type, amount, reason = determine_compensation(record)
    execution_time = int((time.time() - start_time) * 1000)
    
    result = CompensationResult(
        id=str(uuid.uuid4()),
        batch_id=record.batch_id,
        record_id=record.id,
        result_type=result_type,
        amount=amount,
        reason=reason,
        evidence=f"录音ID:{record.recording_id}，问题类型:{record.issue_type}",
        execution_time_ms=execution_time
    )
    
    record.compensated_status = result_type
    record.compensation_amount = amount
    record.processed = True
    
    return result

def generate_report(batch: Batch, db: Session, total_execution_time: int) -> ProcessingReport:
    records = db.query(RecordingRecord).filter(RecordingRecord.batch_id == batch.id).all()
    
    before_status = {}
    after_status = {}
    total_compensation = 0
    
    for record in records:
        before_status[record.original_status] = before_status.get(record.original_status, 0) + 1
        after_status[record.compensated_status or "unprocessed"] = after_status.get(record.compensated_status or "unprocessed", 0) + 1
        total_compensation += record.compensation_amount
    
    success_count = sum(1 for r in records if r.processed and r.compensation_amount > 0)
    failed_count = sum(1 for r in records if not r.processed)
    
    next_steps = []
    mixed_count = sum(1 for r in records if r.is_mixed_source)
    if mixed_count > 0:
        next_steps.append(f"处理{mixed_count}条来源混杂的记录，需要人工复核")
    if failed_count > 0:
        next_steps.append(f"重新处理{failed_count}条失败记录")
    if total_compensation > 1000:
        next_steps.append("高金额补偿批次，建议财务审核")
    next_steps.append("生成详细明细清单，提交财务执行打款")
    
    report = ProcessingReport(
        id=str(uuid.uuid4()),
        batch_id=batch.id,
        batch_no=batch.batch_no,
        total_records=len(records),
        success_count=success_count,
        failed_count=failed_count,
        total_execution_time_ms=total_execution_time,
        before_summary=json.dumps(before_status, ensure_ascii=False),
        after_summary=json.dumps(after_status, ensure_ascii=False),
        next_steps=json.dumps(next_steps, ensure_ascii=False)
    )
    
    return report

def generate_markdown_report(report: ProcessingReport, records: List[RecordingRecord], 
                          corrections: List[ManualCorrection], batch: Batch) -> str:
    before = json.loads(report.before_summary)
    after = json.loads(report.after_summary)
    next_steps = json.loads(report.next_steps)
    
    md = [
        f"# 批量补偿处理报告 - 批次 {batch.batch_no}\n",
        f"**生成时间**: {report.created_at.strftime('%Y-%m-%d %H:%M:%S')}\n",
        f"**来源类型**: {batch.source_type}\n",
        f"**总执行时间**: {report.total_execution_time_ms}ms\n\n",
        
        "## 处理前后对比\n",
        "### 处理前状态分布\n",
        "| 状态 | 数量 |\n|------|------|\n"
    ]
    
    for status, count in before.items():
        md.append(f"| {status} | {count} |\n")
    
    md.extend([
        "\n### 处理后状态分布\n",
        "| 状态 | 数量 |\n|------|------|\n"
    ])
    
    for status, count in after.items():
        md.append(f"| {status} | {count} |\n")
    
    md.extend([
        "\n## 执行统计\n",
        f"- 总记录数: {report.total_records}\n",
        f"- 成功处理: {report.success_count}\n",
        f"- 处理失败: {report.failed_count}\n",
        f"- 总补偿金额: {sum(r.compensation_amount for r in records)}元\n\n",
        
        "## 记录明细\n",
        "| 录音ID | 问题类型 | 原始状态 | 补偿结果 | 补偿金额 | 来源标注 |\n",
        "|--------|----------|----------|----------|----------|----------|\n"
    ])
    
    for record in records:
        source_tag = "混杂来源⚠️" if record.is_mixed_source else "正常"
        md.append(f"| {record.recording_id} | {record.issue_type} | {record.original_status} | {record.compensated_status} | {record.compensation_amount}元 | {source_tag} |\n")
    
    if corrections:
        md.extend([
            "\n## 人工修正记录\n",
            "| 批次号 | 录音ID | 操作人 | 修正类型 | 原值 | 修正值 | 修正原因 |\n",
            "|--------|--------|--------|----------|------|--------|----------|\n"
        ])
        for corr in corrections:
            md.append(f"| {batch.batch_no} | {records[0].recording_id if records else 'N/A'} | {corr.operator} | {corr.correction_type} | {corr.original_value} | {corr.corrected_value} | {corr.reason} |\n")
    
    md.extend([
        "\n## 下一步建议\n",
    ])
    
    for i, step in enumerate(next_steps, 1):
        md.append(f"{i}. {step}\n")
    
    return "".join(md)
