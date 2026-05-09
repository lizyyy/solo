import csv
import io
import json
from datetime import datetime
from typing import List
from app.schemas import ExportItem


class ExportService:
    @staticmethod
    def export_to_csv(items: List[ExportItem], customer_id: str, export_time: datetime) -> str:
        output = io.StringIO(newline='')
        writer = csv.writer(output)
        
        writer.writerow([
            "回单索引", "原交易ID", "交易日期", "交易类型",
            "交易金额(分)", "交易金额(元)", "对手方",
            "补打次数", "最后下载时间", "最后操作人"
        ])
        
        total_amount = 0
        total_reprint_count = 0
        
        for item in items:
            amount_yuan = item.transaction_amount / 100.0
            writer.writerow([
                item.receipt_index,
                item.original_transaction_id,
                item.transaction_date.strftime("%Y-%m-%d %H:%M:%S"),
                item.transaction_type,
                item.transaction_amount,
                f"{amount_yuan:.2f}",
                item.counterparty_name,
                item.reprint_count,
                item.last_download_at.strftime("%Y-%m-%d %H:%M:%S") if item.last_download_at else "",
                item.last_operator or ""
            ])
            total_amount += item.transaction_amount
            total_reprint_count += item.reprint_count
        
        writer.writerow([])
        writer.writerow([
            "汇总", "", "", "",
            total_amount, f"{total_amount / 100.0:.2f}",
            "", total_reprint_count, "", ""
        ])
        
        writer.writerow([])
        writer.writerow(["客户ID", customer_id])
        writer.writerow(["导出时间", export_time.strftime("%Y-%m-%d %H:%M:%S")])
        writer.writerow(["记录数", len(items)])
        
        return output.getvalue()
    
    @staticmethod
    def export_to_json(items: List[ExportItem], customer_id: str, export_time: datetime) -> str:
        total_amount = sum(item.transaction_amount for item in items)
        total_reprint_count = sum(item.reprint_count for item in items)
        
        data = {
            "customer_id": customer_id,
            "export_time": export_time.strftime("%Y-%m-%d %H:%M:%S"),
            "summary": {
                "record_count": len(items),
                "total_amount_fen": total_amount,
                "total_amount_yuan": f"{total_amount / 100.0:.2f}",
                "total_reprint_count": total_reprint_count
            },
            "records": [
                {
                    "receipt_index": item.receipt_index,
                    "original_transaction_id": item.original_transaction_id,
                    "transaction_date": item.transaction_date.strftime("%Y-%m-%d %H:%M:%S"),
                    "transaction_type": item.transaction_type,
                    "transaction_amount_fen": item.transaction_amount,
                    "transaction_amount_yuan": f"{item.transaction_amount / 100.0:.2f}",
                    "counterparty_name": item.counterparty_name,
                    "reprint_count": item.reprint_count,
                    "last_download_at": item.last_download_at.strftime("%Y-%m-%d %H:%M:%S") if item.last_download_at else None,
                    "last_operator": item.last_operator
                }
                for item in items
            ]
        }
        
        return json.dumps(data, ensure_ascii=False, indent=2)
    
    @staticmethod
    def validate_export_data(items: List[ExportItem]) -> dict:
        errors = []
        warnings = []
        
        receipt_indices = set()
        transaction_ids = set()
        
        for idx, item in enumerate(items):
            if item.receipt_index in receipt_indices:
                errors.append(f"第{idx+1}行: 回单索引重复 - {item.receipt_index}")
            receipt_indices.add(item.receipt_index)
            
            if item.transaction_amount < 0:
                errors.append(f"第{idx+1}行: 交易金额异常 - {item.transaction_amount}")
            
            if item.reprint_count < 0:
                errors.append(f"第{idx+1}行: 补打次数异常 - {item.reprint_count}")
            
            if item.reprint_count > 0 and not item.last_download_at:
                warnings.append(f"第{idx+1}行: 有补打记录但无下载时间 - {item.receipt_index}")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "record_count": len(items)
        }