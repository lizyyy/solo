import os
from datetime import datetime
from typing import List, Dict, Any

import pandas as pd

from ..models import (
    SettlementRecord,
    CompensationPlan,
    CompensationStatus,
    CompensationType,
    BadRow,
)
from ..tracker import SourceTracker
from ..utils import stable_hash


class SettlementReport:
    def __init__(
        self,
        plans: List[CompensationPlan],
        source_tracker: SourceTracker,
    ):
        self.plans = sorted(plans, key=lambda p: (p.batch_id, p.plan_id))
        self.source_tracker = source_tracker
        self.records: List[SettlementRecord] = []

    def generate_records(self) -> List[SettlementRecord]:
        self.records = []

        for plan in self.plans:
            if plan.status != CompensationStatus.PROCESSED:
                continue

            record_id = f"SETTLE_{stable_hash({'plan_id': plan.plan_id})}"

            amount = 0.0
            if plan.compensation_type == CompensationType.REFUND and plan.refund_amount:
                amount = plan.refund_amount
            elif plan.compensation_type == CompensationType.POINTS and plan.points_amount:
                amount = plan.points_amount / 100.0

            confirmation = None
            for conf in self.source_tracker.trails:
                if conf.order_id == plan.order_id and conf.sku_id == plan.sku_id:
                    confirmation = conf
                    break

            record = SettlementRecord(
                settlement_id=record_id,
                batch_id=plan.batch_id,
                order_id=plan.order_id,
                sku_id=plan.sku_id,
                user_id=plan.user_id,
                compensation_type=plan.compensation_type,
                quantity=plan.quantity,
                amount=amount,
                status=plan.status,
                inventory_written_back=True,
                settled_at=datetime.now(),
                source_trail=[],
                extra={},
            )
            self.records.append(record)

        return sorted(self.records, key=lambda r: (r.batch_id, r.order_id, r.sku_id))

    def get_summary(self) -> Dict[str, Any]:
        summary: Dict[str, Any] = {
            "total_records": len(self.records),
            "total_quantity": 0,
            "total_amount": 0.0,
            "by_type": {},
            "by_batch": {},
        }

        for record in self.records:
            summary["total_quantity"] += record.quantity
            summary["total_amount"] += record.amount

            type_key = record.compensation_type.value
            summary["by_type"][type_key] = summary["by_type"].get(type_key, 0) + 1

            batch_key = record.batch_id
            if batch_key not in summary["by_batch"]:
                summary["by_batch"][batch_key] = {"count": 0, "amount": 0.0}
            summary["by_batch"][batch_key]["count"] += 1
            summary["by_batch"][batch_key]["amount"] += record.amount

        return summary

    def export_to_excel(self, output_path: str, bad_rows: List[BadRow] = None) -> str:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
            self._export_settlement_records(writer)
            self._export_compensation_plans(writer)
            self._export_source_trails(writer)

            if bad_rows:
                self._export_bad_rows(writer, bad_rows)

        return output_path

    def _export_settlement_records(self, writer: pd.ExcelWriter) -> None:
        data = []
        for record in self.records:
            data.append(
                {
                    "结算ID": record.settlement_id,
                    "批次ID": record.batch_id,
                    "订单ID": record.order_id,
                    "SKU_ID": record.sku_id,
                    "用户ID": record.user_id,
                    "补偿类型": record.compensation_type.value,
                    "数量": record.quantity,
                    "金额": round(record.amount, 2),
                    "状态": record.status.value,
                    "库存已回写": "是" if record.inventory_written_back else "否",
                    "结算时间": record.settled_at.strftime("%Y-%m-%d %H:%M:%S"),
                }
            )

        if data:
            df = pd.DataFrame(data)
            df.to_excel(writer, sheet_name="结算记录", index=False)

    def _export_compensation_plans(self, writer: pd.ExcelWriter) -> None:
        data = []
        for plan in self.plans:
            data.append(
                {
                    "方案ID": plan.plan_id,
                    "批次ID": plan.batch_id,
                    "订单ID": plan.order_id,
                    "SKU_ID": plan.sku_id,
                    "用户ID": plan.user_id,
                    "补偿类型": plan.compensation_type.value,
                    "数量": plan.quantity,
                    "退款金额": plan.refund_amount or "",
                    "换货SKU": plan.exchange_sku_id or "",
                    "积分数量": plan.points_amount or "",
                    "状态": plan.status.value,
                    "来源文件": plan.source_file,
                    "来源行": plan.source_row,
                }
            )

        if data:
            df = pd.DataFrame(data)
            df.to_excel(writer, sheet_name="补偿方案", index=False)

    def _export_source_trails(self, writer: pd.ExcelWriter) -> None:
        trails = self.source_tracker.get_all_trails()
        if trails:
            df = pd.DataFrame(trails)
            df.to_excel(writer, sheet_name="来源追踪", index=False)

    def _export_bad_rows(self, writer: pd.ExcelWriter, bad_rows: List[BadRow]) -> None:
        data = [bad_row.to_dict() for bad_row in bad_rows]
        if data:
            df = pd.DataFrame(data)
            df.to_excel(writer, sheet_name="错误记录", index=False)
