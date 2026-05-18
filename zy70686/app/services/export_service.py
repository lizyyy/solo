from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime, timedelta
from typing import Optional, List
import pandas as pd
from io import BytesIO
from app.models import AlertReport, ReplenishmentOrder, SalesRecord


class ExportService:
    def __init__(self, db: Session):
        self.db = db

    def export_alerts_to_excel(
        self,
        store_id: Optional[int] = None,
        status: Optional[str] = None,
        days: int = 30
    ) -> BytesIO:
        time_threshold = datetime.utcnow() - timedelta(days=days)
        query = self.db.query(AlertReport).filter(AlertReport.created_at >= time_threshold)

        if store_id:
            query = query.filter(AlertReport.store_id == store_id)
        if status:
            query = query.filter(AlertReport.status == status)

        alerts = query.order_by(AlertReport.created_at.desc()).all()

        data = []
        for alert in alerts:
            data.append({
                "预警编号": alert.alert_no,
                "门店ID": alert.store_id,
                "原料ID": alert.material_id,
                "预警类型": alert.alert_type,
                "预警级别": alert.alert_level,
                "当前库存": alert.current_stock,
                "预测消耗量": alert.forecast_consumption,
                "预计耗尽天数": alert.estimated_runout_days,
                "状态": alert.status,
                "合并来源": alert.merged_from,
                "处理人": alert.handled_by,
                "处理时间": alert.handled_at.strftime("%Y-%m-%d %H:%M:%S") if alert.handled_at else None,
                "创建时间": alert.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "备注": alert.remarks
            })

        df = pd.DataFrame(data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="预警报告")
        output.seek(0)
        return output

    def export_replenishment_to_excel(
        self,
        store_id: Optional[int] = None,
        status: Optional[str] = None,
        days: int = 30
    ) -> BytesIO:
        time_threshold = datetime.utcnow() - timedelta(days=days)
        query = self.db.query(ReplenishmentOrder).filter(ReplenishmentOrder.created_at >= time_threshold)

        if store_id:
            query = query.filter(ReplenishmentOrder.store_id == store_id)
        if status:
            query = query.filter(ReplenishmentOrder.status == status)

        orders = query.order_by(ReplenishmentOrder.created_at.desc()).all()

        data = []
        for order in orders:
            data.append({
                "补货单号": order.order_no,
                "门店ID": order.store_id,
                "原料ID": order.material_id,
                "补货数量": order.quantity,
                "状态": order.status,
                "优先级": order.priority,
                "预计到货时间": order.estimated_arrival.strftime("%Y-%m-%d %H:%M:%S") if order.estimated_arrival else None,
                "实际到货时间": order.actual_arrival.strftime("%Y-%m-%d %H:%M:%S") if order.actual_arrival else None,
                "需要人工复核": "是" if order.need_manual_review else "否",
                "复核原因": order.review_reason,
                "创建人": order.created_by,
                "创建时间": order.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "备注": order.remarks
            })

        df = pd.DataFrame(data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="补货订单")
        output.seek(0)
        return output

    def export_sales_to_excel(
        self,
        store_id: Optional[int] = None,
        material_id: Optional[int] = None,
        days: int = 30
    ) -> BytesIO:
        time_threshold = datetime.utcnow() - timedelta(days=days)
        query = self.db.query(SalesRecord).filter(SalesRecord.sales_date >= time_threshold)

        if store_id:
            query = query.filter(SalesRecord.store_id == store_id)
        if material_id:
            query = query.filter(SalesRecord.material_id == material_id)

        sales = query.order_by(SalesRecord.sales_date.desc()).all()

        data = []
        for sale in sales:
            data.append({
                "记录ID": sale.id,
                "门店ID": sale.store_id,
                "原料ID": sale.material_id,
                "销售数量": sale.quantity,
                "销售日期": sale.sales_date.strftime("%Y-%m-%d %H:%M:%S"),
                "创建时间": sale.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })

        df = pd.DataFrame(data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="销售记录")
        output.seek(0)
        return output

    def export_forecast_report_to_excel(self, forecast_data: dict) -> BytesIO:
        data = []
        for item in forecast_data.get("items", []):
            data.append({
                "原料ID": item["material_id"],
                "原料名称": item["material_name"],
                "分类": item["category"],
                "当前库存": item["current_stock"],
                "单位": item["unit"],
                "日均消耗量": item["avg_daily_consumption"],
                f"{forecast_data['forecast_days']}天预测消耗量": item["forecast_consumption"],
                "预计耗尽天数": item["estimated_runout_days"],
                "安全库存水平": item["safety_stock_level"],
                "补货点": item["reorder_point"],
                "需要补货": "是" if item["need_replenishment"] else "否",
                "建议补货量": item["suggested_quantity"]
            })

        df = pd.DataFrame(data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="预测报告")

            summary_data = [{
                "门店ID": forecast_data["store_id"],
                "门店名称": forecast_data["store_name"],
                "预测日期": forecast_data["forecast_date"],
                "预测天数": forecast_data["forecast_days"],
                "生成时间": forecast_data["generated_at"]
            }]
            pd.DataFrame(summary_data).to_excel(writer, index=False, sheet_name="摘要")

        output.seek(0)
        return output
