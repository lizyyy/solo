import os
import uuid
from datetime import datetime
from typing import List, Dict, Any
import pandas as pd
from sqlalchemy.orm import Session
from app.models import DeliveryOrder, DeliveryItem, TemperatureRecord, AnomalyRecord
from app.schemas import DeliveryOrderQuery
from app.services.delivery_service import DeliveryService


class ReportService:
    def __init__(self, db: Session):
        self.db = db
        self.delivery_service = DeliveryService(db)
        self.export_dir = "./data/exports"
        os.makedirs(self.export_dir, exist_ok=True)

    def generate_delivery_report_data(self, query_params: DeliveryOrderQuery,
                                       include_details: bool = True) -> Dict[str, Any]:
        result = self.delivery_service.query_delivery_orders(query_params)
        orders = result["items"]

        summary_data = []
        items_data = []
        temperature_data = []
        anomalies_data = []

        for order in orders:
            summary_data.append({
                "订单编号": order.order_number,
                "供应商": order.supplier_name,
                "配送日期": order.delivery_date.strftime("%Y-%m-%d") if order.delivery_date else "",
                "状态": order.status.value,
                "签收人": order.received_by or "",
                "签收时间": order.received_at.strftime("%Y-%m-%d %H:%M:%S") if order.received_at else "",
                "货品总数": order.total_items,
                "异常数": order.anomaly_count,
                "备注": order.remarks or ""
            })

            if include_details:
                for item in order.items:
                    items_data.append({
                        "订单编号": order.order_number,
                        "产品编码": item.product_code,
                        "产品名称": item.product_name,
                        "批号": item.batch_number,
                        "数量": item.quantity,
                        "单位": item.unit,
                        "生产日期": item.manufacture_date.strftime("%Y-%m-%d") if item.manufacture_date else "",
                        "有效期": item.expiry_date.strftime("%Y-%m-%d") if item.expiry_date else "",
                        "存储条件": item.storage_condition or "",
                        "最低温度": item.min_temperature if item.min_temperature is not None else "",
                        "最高温度": item.max_temperature if item.max_temperature is not None else "",
                        "是否已检验": "是" if item.is_inspected else "否",
                        "检验人": item.inspected_by or "",
                        "检验时间": item.inspected_at.strftime("%Y-%m-%d %H:%M:%S") if item.inspected_at else "",
                        "检验结果": item.inspection_result or "",
                        "备注": item.remarks or ""
                    })

                for temp in order.temperature_records:
                    temperature_data.append({
                        "订单编号": order.order_number,
                        "记录时间": temp.record_time.strftime("%Y-%m-%d %H:%M:%S") if temp.record_time else "",
                        "温度(℃)": temp.temperature,
                        "湿度(%)": temp.humidity if temp.humidity is not None else "",
                        "设备ID": temp.device_id or "",
                        "位置": temp.location or "",
                        "是否异常": "是" if temp.is_anomaly else "否",
                        "异常类型": temp.anomaly_type.value if temp.anomaly_type else "",
                        "备注": temp.remarks or ""
                    })

                for anomaly in order.anomalies:
                    anomalies_data.append({
                        "订单编号": order.order_number,
                        "异常类型": anomaly.anomaly_type.value,
                        "描述": anomaly.description,
                        "严重程度": anomaly.severity,
                        "报告人": anomaly.reported_by or "",
                        "报告时间": anomaly.reported_at.strftime("%Y-%m-%d %H:%M:%S") if anomaly.reported_at else "",
                        "状态": anomaly.status,
                        "解决人": anomaly.resolved_by or "",
                        "解决时间": anomaly.resolved_at.strftime("%Y-%m-%d %H:%M:%S") if anomaly.resolved_at else "",
                        "解决方案": anomaly.resolution or ""
                    })

        return {
            "summary": summary_data,
            "items": items_data,
            "temperature": temperature_data,
            "anomalies": anomalies_data,
            "total": result["total"]
        }

    def export_to_excel(self, query_params: DeliveryOrderQuery,
                         include_details: bool = True) -> str:
        data = self.generate_delivery_report_data(query_params, include_details)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"delivery_report_{timestamp}.xlsx"
        filepath = os.path.join(self.export_dir, filename)

        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            df_summary = pd.DataFrame(data["summary"])
            df_summary.to_excel(writer, sheet_name='到货单汇总', index=False)

            if include_details:
                if data["items"]:
                    df_items = pd.DataFrame(data["items"])
                    df_items.to_excel(writer, sheet_name='货品明细', index=False)

                if data["temperature"]:
                    df_temp = pd.DataFrame(data["temperature"])
                    df_temp.to_excel(writer, sheet_name='温度记录', index=False)

                if data["anomalies"]:
                    df_anomalies = pd.DataFrame(data["anomalies"])
                    df_anomalies.to_excel(writer, sheet_name='异常记录', index=False)

        return filepath

    def export_to_csv(self, query_params: DeliveryOrderQuery) -> Dict[str, str]:
        data = self.generate_delivery_report_data(query_params)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        files = {}

        df_summary = pd.DataFrame(data["summary"])
        summary_path = os.path.join(self.export_dir, f"delivery_summary_{timestamp}.csv")
        df_summary.to_csv(summary_path, index=False, encoding='utf-8-sig')
        files["summary"] = summary_path

        if data["items"]:
            df_items = pd.DataFrame(data["items"])
            items_path = os.path.join(self.export_dir, f"delivery_items_{timestamp}.csv")
            df_items.to_csv(items_path, index=False, encoding='utf-8-sig')
            files["items"] = items_path

        if data["temperature"]:
            df_temp = pd.DataFrame(data["temperature"])
            temp_path = os.path.join(self.export_dir, f"temperature_records_{timestamp}.csv")
            df_temp.to_csv(temp_path, index=False, encoding='utf-8-sig')
            files["temperature"] = temp_path

        if data["anomalies"]:
            df_anomalies = pd.DataFrame(data["anomalies"])
            anomalies_path = os.path.join(self.export_dir, f"anomalies_{timestamp}.csv")
            df_anomalies.to_csv(anomalies_path, index=False, encoding='utf-8-sig')
            files["anomalies"] = anomalies_path

        return files

    def get_export_files(self) -> List[Dict[str, Any]]:
        files = []
        for filename in os.listdir(self.export_dir):
            filepath = os.path.join(self.export_dir, filename)
            if os.path.isfile(filepath):
                stat = os.stat(filepath)
                files.append({
                    "filename": filename,
                    "filepath": filepath,
                    "size": stat.st_size,
                    "created_at": datetime.fromtimestamp(stat.st_ctime)
                })
        return sorted(files, key=lambda x: x["created_at"], reverse=True)

    def generate_statistics_report(self, start_date: datetime = None,
                                    end_date: datetime = None) -> Dict[str, Any]:
        stats = self.delivery_service.get_statistics(start_date, end_date)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"statistics_report_{timestamp}.xlsx"
        filepath = os.path.join(self.export_dir, filename)

        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            overview_data = [{
                "统计项": "总到货单数",
                "数值": stats["total_orders"]
            }, {
                "统计项": "有异常的到货单数",
                "数值": stats["orders_with_anomaly"]
            }, {
                "统计项": "异常率(%)",
                "数值": round(stats["anomaly_rate"], 2)
            }]
            df_overview = pd.DataFrame(overview_data)
            df_overview.to_excel(writer, sheet_name='统计概览', index=False)

            status_data = [{"状态": k, "数量": v} for k, v in stats["status_distribution"].items()]
            df_status = pd.DataFrame(status_data)
            df_status.to_excel(writer, sheet_name='状态分布', index=False)

            anomaly_data = [{"异常类型": k, "数量": v} for k, v in stats["anomaly_distribution"].items()]
            df_anomaly = pd.DataFrame(anomaly_data)
            df_anomaly.to_excel(writer, sheet_name='异常类型分布', index=False)

        return {
            "statistics": stats,
            "report_path": filepath
        }

    def generate_temperature_report(self, order_id: int) -> Dict[str, Any]:
        order = self.delivery_service.get_delivery_order(order_id)
        if not order:
            raise ValueError("到货单不存在")

        temp_records = self.delivery_service.get_temperature_records(order_id)

        data = []
        min_temp = float('inf')
        max_temp = float('-inf')
        avg_temp = 0
        anomaly_count = 0

        for temp in temp_records:
            data.append({
                "时间": temp.record_time.strftime("%Y-%m-%d %H:%M:%S") if temp.record_time else "",
                "温度(℃)": temp.temperature,
                "湿度(%)": temp.humidity if temp.humidity is not None else "",
                "是否异常": "是" if temp.is_anomaly else "否"
            })

            if temp.temperature < min_temp:
                min_temp = temp.temperature
            if temp.temperature > max_temp:
                max_temp = temp.temperature
            avg_temp += temp.temperature
            if temp.is_anomaly:
                anomaly_count += 1

        if temp_records:
            avg_temp /= len(temp_records)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"temperature_report_{order.order_number}_{timestamp}.xlsx"
        filepath = os.path.join(self.export_dir, filename)

        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            df_data = pd.DataFrame(data)
            df_data.to_excel(writer, sheet_name='温度记录', index=False)

            summary_data = [{
                "订单编号": order.order_number,
                "记录总数": len(temp_records),
                "最低温度(℃)": round(min_temp, 2) if temp_records else 0,
                "最高温度(℃)": round(max_temp, 2) if temp_records else 0,
                "平均温度(℃)": round(avg_temp, 2) if temp_records else 0,
                "异常记录数": anomaly_count
            }]
            df_summary = pd.DataFrame(summary_data)
            df_summary.to_excel(writer, sheet_name='温度统计', index=False)

        return {
            "order_number": order.order_number,
            "total_records": len(temp_records),
            "min_temperature": min_temp if temp_records else None,
            "max_temperature": max_temp if temp_records else None,
            "avg_temperature": avg_temp if temp_records else None,
            "anomaly_count": anomaly_count,
            "report_path": filepath
        }

    def get_export_file_path(self, filename: str) -> str:
        filepath = os.path.join(self.export_dir, filename)
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"文件不存在: {filename}")
        return filepath
