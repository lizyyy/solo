import json
import csv
from datetime import datetime, date
from typing import List, Dict, Any
from io import StringIO
from models import Customer, StorageItem, UsageRecord, TransferRequest
from service import StorageService


class ReportGenerator:
    def __init__(self, service: StorageService):
        self.service = service

    def _get_customer_name(self, customer_id: str) -> str:
        customer = self.service.get_customer(customer_id)
        return customer.name if customer else "未知客户"

    def generate_storage_report(self, format: str = "json") -> str:
        items = list(self.service.data_store.storage_items.values())
        report_data = {
            "report_type": "storage_summary",
            "generated_at": datetime.now().isoformat(),
            "total_items": len(items),
            "total_quantity": sum(item.quantity for item in items),
            "items": [
                {
                    "storage_id": item.storage_id,
                    "customer_name": self._get_customer_name(item.customer_id),
                    "customer_id": item.customer_id,
                    "product_name": item.product_name,
                    "category": item.category,
                    "batch_no": item.batch_no,
                    "expiry_date": item.expiry_date,
                    "quantity": item.quantity,
                    "unit": item.unit,
                    "days_until_expiry": item.days_until_expiry(),
                    "is_expired": item.is_expired()
                }
                for item in items
            ]
        }

        if format == "json":
            return json.dumps(report_data, ensure_ascii=False, indent=2)
        elif format == "csv":
            return self._dict_to_csv(report_data["items"])
        else:
            return self._format_human_readable(report_data)

    def generate_expiry_report(self, days: int = 30, format: str = "json") -> str:
        expiring = self.service.get_expiring_items(days)
        expired = self.service.get_expired_items()

        report_data = {
            "report_type": "expiry_alert",
            "generated_at": datetime.now().isoformat(),
            "check_days": days,
            "expiring_count": len(expiring),
            "expired_count": len(expired),
            "expiring_items": [
                {
                    "storage_id": item.storage_id,
                    "customer_name": self._get_customer_name(item.customer_id),
                    "customer_id": item.customer_id,
                    "product_name": item.product_name,
                    "batch_no": item.batch_no,
                    "expiry_date": item.expiry_date,
                    "quantity": item.quantity,
                    "unit": item.unit,
                    "days_left": item.days_until_expiry()
                }
                for item in expiring
            ],
            "expired_items": [
                {
                    "storage_id": item.storage_id,
                    "customer_name": self._get_customer_name(item.customer_id),
                    "customer_id": item.customer_id,
                    "product_name": item.product_name,
                    "batch_no": item.batch_no,
                    "expiry_date": item.expiry_date,
                    "quantity": item.quantity,
                    "unit": item.unit,
                    "days_expired": -item.days_until_expiry()
                }
                for item in expired
            ]
        }

        if format == "json":
            return json.dumps(report_data, ensure_ascii=False, indent=2)
        elif format == "csv":
            all_items = report_data["expiring_items"] + report_data["expired_items"]
            for item in all_items:
                if "days_left" in item:
                    item["status"] = "即将过期"
                    item["days"] = item["days_left"]
                    item["days_expired"] = 0
                else:
                    item["status"] = "已过期"
                    item["days"] = -item["days_expired"]
                    item["days_left"] = 0
            return self._dict_to_csv(all_items)
        else:
            return self._format_expiry_human_readable(report_data)

    def generate_transfer_report(self, format: str = "json") -> str:
        transfers = list(self.service.data_store.transfer_requests.values())

        report_data = {
            "report_type": "transfer_summary",
            "generated_at": datetime.now().isoformat(),
            "total_requests": len(transfers),
            "pending_count": len([t for t in transfers if t.status.value == "pending"]),
            "approved_count": len([t for t in transfers if t.status.value == "approved"]),
            "rejected_count": len([t for t in transfers if t.status.value == "rejected"]),
            "transfers": [
                {
                    "transfer_id": t.transfer_id,
                    "from_customer": self._get_customer_name(t.from_customer_id),
                    "to_customer": self._get_customer_name(t.to_customer_id),
                    "storage_id": t.storage_id,
                    "quantity": t.quantity,
                    "status": t.status.value,
                    "created_at": t.created_at,
                    "notes": t.notes
                }
                for t in transfers
            ]
        }

        if format == "json":
            return json.dumps(report_data, ensure_ascii=False, indent=2)
        elif format == "csv":
            return self._dict_to_csv(report_data["transfers"])
        else:
            return self._format_transfer_human_readable(report_data)

    def _dict_to_csv(self, data: List[Dict[str, Any]]) -> str:
        if not data:
            return ""
        output = StringIO()
        all_fields = set()
        for item in data:
            all_fields.update(item.keys())
        writer = csv.DictWriter(output, fieldnames=sorted(all_fields), extrasaction='ignore')
        writer.writeheader()
        writer.writerows(data)
        return output.getvalue()

    def _format_human_readable(self, data: Dict[str, Any]) -> str:
        lines = [
            "=" * 80,
            f"寄存商品汇总报告",
            f"生成时间: {data['generated_at']}",
            "=" * 80,
            f"寄存总数: {data['total_items']} 条",
            f"总数量: {data['total_quantity']} 单位",
            "",
            "-" * 80,
            f"{'客户':<12} {'商品':<16} {'批次':<12} {'效期':<12} {'数量':<6} {'状态':<10}",
            "-" * 80
        ]

        for item in data["items"]:
            status = "已过期" if item["is_expired"] else f"剩{item['days_until_expiry']}天"
            lines.append(
                f"{item['customer_name']:<12} {item['product_name']:<16} {item['batch_no']:<12} "
                f"{item['expiry_date']:<12} {item['quantity']:>4}{item['unit']:<2} {status:<10}"
            )

        lines.append("=" * 80)
        return "\n".join(lines)

    def _format_expiry_human_readable(self, data: Dict[str, Any]) -> str:
        lines = [
            "=" * 80,
            f"效期提醒报告 (未来{data['check_days']}天内过期)",
            f"生成时间: {data['generated_at']}",
            "=" * 80,
            f"即将过期: {data['expiring_count']} 条",
            f"已过期: {data['expired_count']} 条",
            ""
        ]

        if data["expired_items"]:
            lines.extend([
                "【已过期商品】",
                "-" * 80,
                f"{'客户':<12} {'商品':<16} {'批次':<12} {'效期':<12} {'数量':<6}",
                "-" * 80
            ])
            for item in data["expired_items"]:
                lines.append(
                    f"{item['customer_name']:<12} {item['product_name']:<16} {item['batch_no']:<12} "
                    f"{item['expiry_date']:<12} {item['quantity']:>4}{item['unit']:<2}"
                )
            lines.append("")

        if data["expiring_items"]:
            lines.extend([
                "【即将过期商品】",
                "-" * 80,
                f"{'客户':<12} {'商品':<16} {'批次':<12} {'效期':<12} {'剩余天数':<8} {'数量':<6}",
                "-" * 80
            ])
            for item in data["expiring_items"]:
                lines.append(
                    f"{item['customer_name']:<12} {item['product_name']:<16} {item['batch_no']:<12} "
                    f"{item['expiry_date']:<12} {item['days_left']:>6}天 {item['quantity']:>4}{item['unit']:<2}"
                )

        lines.append("=" * 80)
        return "\n".join(lines)

    def _format_transfer_human_readable(self, data: Dict[str, Any]) -> str:
        lines = [
            "=" * 80,
            f"转赠申请汇总报告",
            f"生成时间: {data['generated_at']}",
            "=" * 80,
            f"待审批: {data['pending_count']} 条",
            f"已通过: {data['approved_count']} 条",
            f"已拒绝: {data['rejected_count']} 条",
            "",
            "-" * 80,
            f"{'申请ID':<10} {'转出客户':<10} {'转入客户':<10} {'数量':<6} {'状态':<10}",
            "-" * 80
        ]

        status_map = {"pending": "待审批", "approved": "已通过", "rejected": "已拒绝"}
        for t in data["transfers"]:
            lines.append(
                f"{t['transfer_id']:<10} {t['from_customer']:<10} {t['to_customer']:<10} "
                f"{t['quantity']:>4} {status_map.get(t['status'], t['status']):<10}"
            )

        lines.append("=" * 80)
        return "\n".join(lines)

    def save_report(self, content: str, filename: str):
        with open(filename, "w", encoding="utf-8") as f:
            f.write(content)
        return filename
