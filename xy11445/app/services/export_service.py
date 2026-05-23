from datetime import datetime
from typing import Optional, List, Dict, Any
from io import BytesIO
import pandas as pd
from sqlalchemy.orm import Session

from app.models.enums import WorkOrderStatus
from app.models.database import WorkOrder


class ExportService:
    def __init__(self, db: Session):
        self.db = db

    def get_area_summary(
        self,
        area: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        query = self.db.query(WorkOrder)

        if area:
            query = query.filter(WorkOrder.area == area)
        if start_date:
            query = query.filter(WorkOrder.created_at >= start_date)
        if end_date:
            query = query.filter(WorkOrder.created_at <= end_date)
        if status:
            query = query.filter(WorkOrder.status == status)

        work_orders = query.all()

        result = []
        for wo in work_orders:
            item = {
                "工单号": wo.order_no,
                "充电桩编号": wo.pile_no,
                "片区": wo.area,
                "来源": self._format_source(wo.source),
                "告警类型": wo.alarm_type,
                "告警级别": wo.alarm_level,
                "告警时间": wo.alarm_time.strftime("%Y-%m-%d %H:%M:%S") if wo.alarm_time else "",
                "当前状态": self._format_status(wo.status),
                "冻结前状态": self._format_status(wo.status_before_freeze) if wo.status_before_freeze else "",
                "故障时长(小时)": wo.fault_duration if wo.fault_duration else 0,
                "冻结前故障时长(小时)": wo.fault_duration_before if wo.fault_duration_before else "",
                "处理人": wo.handler or "",
                "复核人": wo.reviewer or "",
                "复核意见": wo.review_reason or "",
                "人工调整理由": wo.manual_reason or "",
                "创建时间": wo.created_at.strftime("%Y-%m-%d %H:%M:%S") if wo.created_at else "",
                "冻结时间": wo.frozen_at.strftime("%Y-%m-%d %H:%M:%S") if wo.frozen_at else "",
                "归档时间": wo.archived_at.strftime("%Y-%m-%d %H:%M:%S") if wo.archived_at else "",
                "数据来源说明": self._get_data_source_note(wo),
            }
            result.append(item)

        return result

    def _format_source(self, source: str) -> str:
        source_map = {
            "pile_alarm": "桩端告警",
            "inspection_form": "巡检表",
            "customer_complaint": "客服投诉单",
            "manual_supplement": "临时补录单",
        }
        return source_map.get(source, source)

    def _format_status(self, status: str) -> str:
        status_map = {
            "pending": "待处理",
            "processing": "处理中",
            "pending_review": "待复核",
            "reviewed": "已复核",
            "frozen": "已冻结",
            "archived": "已归档",
            "rejected": "已驳回",
            "withdrawn": "已撤回",
        }
        return status_map.get(status, status)

    def _get_data_source_note(self, wo: WorkOrder) -> str:
        notes = []
        if wo.status == WorkOrderStatus.FROZEN.value and wo.status_before_freeze:
            notes.append(f"冻结前状态: {self._format_status(wo.status_before_freeze)}")
        if wo.manual_reason:
            notes.append("有人工调整")
        if wo.fault_duration_before and wo.fault_duration != wo.fault_duration_before:
            diff = (wo.fault_duration or 0) - (wo.fault_duration_before or 0)
            notes.append(f"故障时长调整: {diff:+.2f}小时")
        return "; ".join(notes)

    def get_statistics_summary(
        self,
        area: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        query = self.db.query(WorkOrder)

        if area:
            query = query.filter(WorkOrder.area == area)
        if start_date:
            query = query.filter(WorkOrder.created_at >= start_date)
        if end_date:
            query = query.filter(WorkOrder.created_at <= end_date)

        work_orders = query.all()

        total_count = len(work_orders)
        total_fault_duration = sum(wo.fault_duration or 0 for wo in work_orders)

        status_stats = {}
        source_stats = {}
        area_stats = {}

        for wo in work_orders:
            status = self._format_status(wo.status)
            status_stats[status] = status_stats.get(status, 0) + 1

            source = self._format_source(wo.source)
            source_stats[source] = source_stats.get(source, 0) + 1

            area_stats[wo.area] = area_stats.get(wo.area, 0) + 1

        frozen_count = sum(1 for wo in work_orders if wo.status == WorkOrderStatus.FROZEN.value)
        manual_adjust_count = sum(1 for wo in work_orders if wo.manual_reason)

        return {
            "汇总信息": {
                "总工单数量": total_count,
                "总故障时长(小时)": round(total_fault_duration, 2),
                "平均故障时长(小时)": round(total_fault_duration / total_count, 2) if total_count > 0 else 0,
                "已冻结工单数": frozen_count,
                "有人工调整工单数": manual_adjust_count,
            },
            "按状态统计": status_stats,
            "按来源统计": source_stats,
            "按片区统计": area_stats,
        }

    def export_to_excel(
        self,
        output_path: Optional[str] = None,
        area: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        status: Optional[str] = None,
    ) -> bytes:
        summary_data = self.get_area_summary(area, start_date, end_date, status)
        statistics_data = self.get_statistics_summary(area, start_date, end_date)

        output = BytesIO()

        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df_summary = pd.DataFrame(summary_data)
            df_summary.to_excel(writer, sheet_name="工单明细", index=False)

            stats_flat = []
            for category, stats in statistics_data.items():
                if isinstance(stats, dict):
                    for key, value in stats.items():
                        stats_flat.append({
                            "分类": category,
                            "项目": key,
                            "数值": value,
                        })
                else:
                    stats_flat.append({
                        "分类": category,
                        "项目": "",
                        "数值": stats,
                    })

            df_stats = pd.DataFrame(stats_flat)
            df_stats.to_excel(writer, sheet_name="统计汇总", index=False)

        output.seek(0)
        excel_data = output.read()

        if output_path:
            with open(output_path, "wb") as f:
                f.write(excel_data)

        return excel_data

    def export_to_csv(
        self,
        output_path: Optional[str] = None,
        area: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        status: Optional[str] = None,
    ) -> str:
        summary_data = self.get_area_summary(area, start_date, end_date, status)
        df = pd.DataFrame(summary_data)
        csv_data = df.to_csv(index=False)

        if output_path:
            with open(output_path, "w", encoding="utf-8-sig") as f:
                f.write(csv_data)

        return csv_data
