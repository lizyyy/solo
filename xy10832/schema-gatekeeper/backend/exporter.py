import pandas as pd
from io import BytesIO
from datetime import datetime
from typing import List, Dict, Any


def export_to_excel(data: Dict[str, Any], filename: str = None) -> BytesIO:
    output = BytesIO()
    
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        for sheet_name, sheet_data in data.items():
            if isinstance(sheet_data, list) and len(sheet_data) > 0:
                df = pd.DataFrame(sheet_data)
                df.to_excel(writer, sheet_name=sheet_name, index=False)
            elif isinstance(sheet_data, dict):
                df = pd.DataFrame([sheet_data])
                df.to_excel(writer, sheet_name=sheet_name, index=False)
    
    output.seek(0)
    return output


def generate_impact_report_export(change_request, intercept_records: List, affected_consumers: List, breaking_changes: List) -> Dict[str, Any]:
    export_data = {
        "变更概览": [],
        "破坏性变更": [],
        "受影响消费者": [],
        "拦截记录": []
    }
    
    export_data["变更概览"] = [{
        "申请ID": change_request.request_id,
        "变更标题": change_request.title,
        "变更类型": change_request.change_type,
        "创建人": change_request.created_by,
        "创建时间": change_request.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        "当前状态": change_request.status,
        "破坏性变更数量": len(breaking_changes),
        "受影响消费者数量": len(affected_consumers)
    }]
    
    for change in breaking_changes:
        export_data["破坏性变更"].append({
            "变更类型": change.get("type"),
            "字段名": change.get("field"),
            "变更描述": change.get("message"),
            "严重程度": change.get("severity")
        })
    
    for consumer in affected_consumers:
        export_data["受影响消费者"].append({
            "消费者ID": consumer.get("consumer_id"),
            "消费者名称": consumer.get("consumer_name"),
            "所属团队": consumer.get("team"),
            "联系邮箱": consumer.get("email"),
            "受影响字段": ", ".join([f.get("field") for f in consumer.get("affected_fields", [])])
        })
    
    for record in intercept_records:
        consumer = record.consumer
        export_data["拦截记录"].append({
            "拦截ID": record.id,
            "消费者": consumer.name if consumer else "未知",
            "拦截原因": record.reason,
            "严重程度": record.severity,
            "状态": record.status,
            "拦截时间": record.intercept_time.strftime("%Y-%m-%d %H:%M:%S")
        })
    
    return export_data


def generate_intercept_records_export(records: List) -> Dict[str, Any]:
    export_data = {
        "异常拦截记录": []
    }
    
    for record in records:
        consumer = record.consumer
        change_request = record.change_request
        
        export_data["异常拦截记录"].append({
            "拦截ID": record.id,
            "变更申请ID": change_request.request_id if change_request else "",
            "变更标题": change_request.title if change_request else "",
            "消费者": consumer.name if consumer else "未知",
            "所属团队": consumer.team if consumer else "",
            "拦截原因": record.reason,
            "严重程度": record.severity,
            "状态": record.status,
            "拦截时间": record.intercept_time.strftime("%Y-%m-%d %H:%M:%S"),
            "解决人": record.resolved_by or "",
            "解决时间": record.resolved_at.strftime("%Y-%m-%d %H:%M:%S") if record.resolved_at else "",
            "解决备注": record.resolution_note or ""
        })
    
    return export_data
