import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .config import AppConfig
from .models import (
    AuditEntry,
    BatchInfo,
    CabinetInventory,
    OrderReplayState,
    OrderStatus,
    QuarantinedEvent,
)


class ReportExporter:
    def __init__(self, output_dir: Path, config: AppConfig):
        self.output_dir = output_dir
        self.config = config
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def export_markdown_reconciliation(
        self,
        batches: List[BatchInfo],
        inventories: List[CabinetInventory],
        orders: List[OrderReplayState],
        quarantined_events: List[QuarantinedEvent],
        audit_log: List[AuditEntry],
        filename: Optional[str] = None,
    ) -> Path:
        if filename is None:
            filename = f"reconciliation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"

        filepath = self.output_dir / filename

        paid_orders = [o for o in orders if o.status == OrderStatus.PAID]
        open_orders = [o for o in orders if o.status == OrderStatus.OPEN]
        closed_orders = [o for o in orders if o.status == OrderStatus.CLOSED]
        disputed_orders = [o for o in orders if o.status == OrderStatus.DISPUTED]

        total_expected = sum(o.total_amount for o in orders)
        total_paid = sum(o.paid_amount for o in orders)

        content = f"""# 对账报告

生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## 摘要

| 指标 | 数值 |
|------|------|
| 批次数量 | {len(batches)} |
| 已应用批次 | {sum(1 for b in batches if b.applied)} |
| 柜机数量 | {len(inventories)} |
| 订单总数 | {len(orders)} |
| - 已支付 | {len(paid_orders)} |
| - 已关闭 | {len(closed_orders)} |
| - 进行中 | {len(open_orders)} |
| - 有争议 | {len(disputed_orders)} |
| 隔离事件数 | {len(quarantined_events)} |
| **预期总金额** | **¥{total_expected:.2f}** |
| **实际支付金额** | **¥{total_paid:.2f}** |
| **差异** | **¥{total_paid - total_expected:.2f}** |

---

## 批次明细

"""

        if batches:
            content += "| 批次号 | 导入时间 | 源文件 | 事件数 | 有效事件 | 隔离事件 | 状态 |\n"
            content += "|--------|----------|--------|--------|----------|----------|------|\n"
            for batch in batches:
                status = "已应用" if batch.applied else "待应用"
                if batch.dry_run:
                    status = "试运行"
                content += (
                    f"| {batch.batch_id} | "
                    f"{batch.import_time.strftime('%Y-%m-%d %H:%M')} | "
                    f"{len(batch.source_files)} | "
                    f"{batch.event_count} | "
                    f"{batch.valid_event_count} | "
                    f"{batch.quarantined_count} | "
                    f"{status} |\n"
                )
        else:
            content += "_暂无批次数据_\n"

        content += """

---

## 库存差异明细

"""

        if inventories:
            content += "| 柜机ID | 柜机名称 | 货道 | SKU | 账面数量 | 版本 |\n"
            content += "|--------|----------|------|-----|----------|------|\n"
            for inv in inventories:
                cabinet = self.config.get_cabinet(inv.cabinet_id)
                cab_name = cabinet.name if cabinet else "未知柜机"
                for channel_id, qty in inv.channels.items():
                    channel = self.config.get_channel(inv.cabinet_id, channel_id)
                    sku_id = channel.sku_id if channel else "未知SKU"
                    sku = self.config.get_sku(sku_id)
                    sku_name = sku.name if sku else sku_id
                    content += (
                        f"| {inv.cabinet_id} | "
                        f"{cab_name} | "
                        f"{channel_id} | "
                        f"{sku_name} | "
                        f"{qty} | "
                        f"{inv.version} |\n"
                    )
        else:
            content += "_暂无库存数据_\n"

        content += """

---

## 订单明细

"""

        if orders:
            content += "| 订单号 | 柜机 | 状态 | 预期金额 | 实际支付 | 事件数 | 人工补录 |\n"
            content += "|--------|------|------|----------|----------|--------|----------|\n"
            for order in orders:
                has_manual = "是" if order.has_manual_override else "否"
                content += (
                    f"| {order.order_id} | "
                    f"{order.cabinet_id} | "
                    f"{order.status.value} | "
                    f"¥{order.total_amount:.2f} | "
                    f"¥{order.paid_amount:.2f} | "
                    f"{len(order.events)} | "
                    f"{has_manual} |\n"
                )
        else:
            content += "_暂无订单数据_\n"

        if quarantined_events:
            content += """

---

## 隔离事件

"""
            content += "| 事件ID | 类型 | 柜机 | 隔离时间 | 原因 |\n"
            content += "|--------|------|------|----------|------|\n"
            for qe in quarantined_events:
                content += (
                    f"| {qe.event.event_id} | "
                    f"{qe.event.event_type.value} | "
                    f"{qe.event.cabinet_id} | "
                    f"{qe.quarantine_time.strftime('%Y-%m-%d %H:%M')} | "
                    f"{qe.reason} |\n"
                )

        if audit_log:
            content += """

---

## 审计日志

"""
            content += "| 时间 | 操作 | 批次号 | 详情 |\n"
            content += "|------|------|--------|------|\n"
            for entry in audit_log[-20:]:
                content += (
                    f"| {entry.timestamp.strftime('%Y-%m-%d %H:%M:%S')} | "
                    f"{entry.action} | "
                    f"{entry.batch_id} | "
                    f"{json.dumps(entry.details, ensure_ascii=False)} |\n"
                )

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)

        return filepath

    def export_csv_inventory_diff(
        self,
        inventories: List[CabinetInventory],
        filename: Optional[str] = None,
    ) -> Path:
        if filename is None:
            filename = f"inventory_diff_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

        filepath = self.output_dir / filename

        with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "柜机ID",
                "柜机名称",
                "货道ID",
                "SKU ID",
                "SKU名称",
                "账面数量",
                "货道容量",
                "库存版本",
                "最后更新时间",
            ])

            for inv in inventories:
                cabinet = self.config.get_cabinet(inv.cabinet_id)
                cab_name = cabinet.name if cabinet else "未知柜机"

                for channel_id, qty in inv.channels.items():
                    channel = self.config.get_channel(inv.cabinet_id, channel_id)
                    sku_id = channel.sku_id if channel else "未知SKU"
                    sku = self.config.get_sku(sku_id)
                    sku_name = sku.name if sku else sku_id
                    capacity = channel.capacity if channel else 0

                    writer.writerow([
                        inv.cabinet_id,
                        cab_name,
                        channel_id,
                        sku_id,
                        sku_name,
                        qty,
                        capacity,
                        inv.version,
                        inv.last_updated.strftime("%Y-%m-%d %H:%M:%S"),
                    ])

        return filepath

    def export_json_audit_evidence(
        self,
        batches: List[BatchInfo],
        orders: List[OrderReplayState],
        inventories: List[CabinetInventory],
        audit_log: List[AuditEntry],
        filename: Optional[str] = None,
    ) -> Path:
        if filename is None:
            filename = f"audit_evidence_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

        filepath = self.output_dir / filename

        evidence = {
            "export_time": datetime.now().isoformat(),
            "batches": [
                {
                    "batch_id": b.batch_id,
                    "import_time": b.import_time.isoformat(),
                    "source_files": b.source_files,
                    "event_count": b.event_count,
                    "valid_event_count": b.valid_event_count,
                    "quarantined_count": b.quarantined_count,
                    "applied": b.applied,
                    "applied_at": b.applied_at.isoformat() if b.applied_at else None,
                }
                for b in batches
            ],
            "orders": [
                {
                    "order_id": o.order_id,
                    "cabinet_id": o.cabinet_id,
                    "status": o.status.value,
                    "total_amount": o.total_amount,
                    "paid_amount": o.paid_amount,
                    "has_manual_override": o.has_manual_override,
                    "first_seen_at": o.first_seen_at.isoformat() if o.first_seen_at else None,
                    "last_seen_at": o.last_seen_at.isoformat() if o.last_seen_at else None,
                    "event_count": len(o.events),
                    "events": [
                        {
                            "event_id": e.event_id,
                            "event_type": e.event_type.value,
                            "timestamp": e.timestamp.isoformat(),
                        }
                        for e in o.events
                    ],
                }
                for o in orders
            ],
            "inventories": [
                {
                    "cabinet_id": inv.cabinet_id,
                    "last_updated": inv.last_updated.isoformat(),
                    "channels": inv.channels,
                    "version": inv.version,
                }
                for inv in inventories
            ],
            "audit_log": [
                {
                    "timestamp": entry.timestamp.isoformat(),
                    "action": entry.action,
                    "batch_id": entry.batch_id,
                    "user": entry.user,
                    "details": entry.details,
                }
                for entry in audit_log
            ],
        }

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(evidence, f, ensure_ascii=False, indent=2)

        return filepath
