from fastapi import FastAPI
from fastapi.responses import JSONResponse, Response, FileResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
import json
import hashlib
from models import (
    Session, Batch, AuthRecord, RiskType,
    create_tables, get_batch_by_hash, create_batch,
    create_auth_record, get_records_by_batch, get_all_batches,
    get_records_by_filters, update_batch_status
)

app = FastAPI(title="批量授权回收服务")

create_tables()


class AuthRecordItem(BaseModel):
    business_order_no: str
    channel: str
    payer_account: str
    payee_account: str
    amount: float
    receipt_no: str
    receipt_time: str
    operator: str
    risk_type: RiskType = RiskType.NORMAL
    exception_desc: Optional[str] = None


class BatchSubmitRequest(BaseModel):
    operator: str
    batch_name: str
    records: List[AuthRecordItem]


def generate_content_hash(records: List[AuthRecordItem]) -> str:
    content = json.dumps([r.model_dump() for r in records], sort_keys=True)
    return hashlib.sha256(content.encode()).hexdigest()


@app.post("/api/v1/batch/submit")
async def submit_batch(request: BatchSubmitRequest):
    content_hash = generate_content_hash(request.records)
    existing_batch = get_batch_by_hash(content_hash)
    
    if existing_batch:
        return JSONResponse(
            status_code=409,
            content={
                "code": 409,
                "message": "内容重复，该批次已存在",
                "data": {
                    "batch_id": existing_batch.id,
                    "batch_name": existing_batch.batch_name,
                    "operator": existing_batch.operator,
                    "created_at": existing_batch.created_at.isoformat(),
                    "status": existing_batch.status
                }
            }
        )
    
    batch = create_batch(
        operator=request.operator,
        batch_name=request.batch_name,
        content_hash=content_hash,
        total_count=len(request.records)
    )
    
    exception_count = 0
    for idx, item in enumerate(request.records):
        if item.risk_type != RiskType.NORMAL:
            exception_count += 1
        create_auth_record(
            batch_id=batch.id,
            business_order_no=item.business_order_no,
            channel=item.channel,
            payer_account=item.payer_account,
            payee_account=item.payee_account,
            amount=item.amount,
            receipt_no=item.receipt_no,
            receipt_time=item.receipt_time,
            operator=item.operator,
            risk_type=item.risk_type,
            exception_desc=item.exception_desc,
            sequence=idx + 1
        )
    
    update_batch_status(batch.id, "completed", exception_count)
    
    return {
        "code": 200,
        "message": "批次提交成功",
        "data": {
            "batch_id": batch.id,
            "total_count": batch.total_count,
            "exception_count": exception_count
        }
    }


@app.get("/api/v1/batches")
async def list_batches():
    batches = get_all_batches()
    return {
        "code": 200,
        "data": [
            {
                "batch_id": b.id,
                "batch_name": b.batch_name,
                "operator": b.operator,
                "status": b.status,
                "total_count": b.total_count,
                "exception_count": b.exception_count,
                "created_at": b.created_at.isoformat()
            }
            for b in batches
        ]
    }


@app.get("/api/v1/records")
async def query_records(
    batch_id: Optional[int] = None,
    operator: Optional[str] = None,
    risk_type: Optional[RiskType] = None
):
    records = get_records_by_filters(batch_id, operator, risk_type)
    return {
        "code": 200,
        "data": [
            {
                "id": r.id,
                "batch_id": r.batch_id,
                "business_order_no": r.business_order_no,
                "channel": r.channel,
                "payer_account": r.payer_account,
                "payee_account": r.payee_account,
                "amount": r.amount,
                "receipt_no": r.receipt_no,
                "receipt_time": r.receipt_time,
                "operator": r.operator,
                "risk_type": r.risk_type.value,
                "exception_desc": r.exception_desc,
                "sequence": r.sequence,
                "created_at": r.created_at.isoformat()
            }
            for r in records
        ]
    }


@app.get("/api/v1/batch/{batch_id}/summary")
async def get_batch_summary(batch_id: int, format: str = "json"):
    records = get_records_by_batch(batch_id)
    if not records:
        return JSONResponse(status_code=404, content={"code": 404, "message": "批次不存在"})
    
    sorted_records = sorted(records, key=lambda x: (x.business_order_no, x.sequence, x.receipt_time))
    
    order_summary: Dict[str, Dict[str, Any]] = {}
    for r in sorted_records:
        if r.business_order_no not in order_summary:
            order_summary[r.business_order_no] = {
                "business_order_no": r.business_order_no,
                "exceptions": [],
                "corrections": [],
                "conclusion": ""
            }
        
        if r.risk_type != RiskType.NORMAL:
            order_summary[r.business_order_no]["exceptions"].append({
                "risk_type": r.risk_type.value,
                "description": r.exception_desc or "",
                "receipt_no": r.receipt_no,
                "sequence": r.sequence
            })
        else:
            has_prior_exception = len(order_summary[r.business_order_no]["exceptions"]) > 0
            if has_prior_exception:
                order_summary[r.business_order_no]["corrections"].append({
                    "description": "后续正常回执，确认授权完成",
                    "receipt_no": r.receipt_no,
                    "sequence": r.sequence,
                    "channel": r.channel
                })
            elif not order_summary[r.business_order_no]["exceptions"]:
                pass
    
    for order_no in order_summary:
        exceptions = order_summary[order_no]["exceptions"]
        corrections = order_summary[order_no]["corrections"]
        if exceptions:
            risk_types = set(e["risk_type"] for e in exceptions)
            if corrections:
                order_summary[order_no]["conclusion"] = f"该单据存在{len(exceptions)}条异常记录，涉及风险类型：{','.join(risk_types)}；后续有{len(corrections)}条修正回执确认，授权最终完成"
            else:
                order_summary[order_no]["conclusion"] = f"该单据存在{len(exceptions)}条异常记录，涉及风险类型：{','.join(risk_types)}，暂无后续修正回执"
        else:
            order_summary[order_no]["conclusion"] = "该单据无异常，授权回收完成"
    
    summary_list = list(order_summary.values())
    
    if format == "markdown":
        md_content = generate_markdown_summary(batch_id, summary_list)
        return Response(content=md_content, media_type="text/markdown")
    elif format == "download":
        md_content = generate_markdown_summary(batch_id, summary_list)
        file_path = f"/tmp/batch_{batch_id}_summary.md"
        with open(file_path, "w") as f:
            f.write(md_content)
        return FileResponse(file_path, filename=f"batch_{batch_id}_summary.md")
    
    return {
        "code": 200,
        "data": {
            "batch_id": batch_id,
            "total_orders": len(summary_list),
            "orders_with_exceptions": sum(1 for s in summary_list if s["exceptions"]),
            "orders_with_corrections": sum(1 for s in summary_list if s["corrections"]),
            "details": summary_list
        }
    }


def generate_markdown_summary(batch_id: int, summary_list: List[Dict]) -> str:
    lines = [
        f"# 批次 {batch_id} 授权回收摘要",
        "",
        f"**统计信息**:",
        f"- 业务单据总数: {len(summary_list)}",
        f"- 存在异常单据数: {sum(1 for s in summary_list if s['exceptions'])}",
        f"- 已修正单据数: {sum(1 for s in summary_list if s['corrections'])}",
        f"- 无异常单据数: {sum(1 for s in summary_list if not s['exceptions'])}",
        "",
        "---",
        ""
    ]
    
    for summary in summary_list:
        lines.append(f"## 业务单号: {summary['business_order_no']}")
        lines.append("")
        
        if summary["exceptions"]:
            lines.append("### 异常记录")
            for e in summary["exceptions"]:
                lines.append(f"- **风险类型**: {e['risk_type']}")
                lines.append(f"  **回执号**: {e['receipt_no']}")
                lines.append(f"  **描述**: {e['description']}")
                lines.append("")
        
        if summary["corrections"]:
            lines.append("### 修正记录")
            for c in summary["corrections"]:
                lines.append(f"- **回执号**: {c['receipt_no']}")
                lines.append(f"  **渠道**: {c['channel']}")
                lines.append(f"  **描述**: {c['description']}")
                lines.append("")
        
        lines.append("### 结论")
        lines.append(summary["conclusion"])
        lines.append("")
        lines.append("---")
        lines.append("")
    
    return "\n".join(lines)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
