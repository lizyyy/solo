from typing import Dict, List, Optional, Any
from datetime import datetime
import pandas as pd
from io import BytesIO
from sqlalchemy.orm import Session
from database import SessionLocal
from models import (
    FoodSample, TemperatureRecord, WasteRecord,
    Store, RuleResult, ExceptionType, RecordStatus
)


class ExportService:
    def __init__(self, db: Optional[Session] = None):
        self.db = db or SessionLocal()

    def __del__(self):
        if hasattr(self, 'db'):
            self.db.close()

    def export_samples_report(self,
                               store_id: Optional[str] = None,
                               manager_id: Optional[str] = None,
                               status: Optional[str] = None,
                               start_time: Optional[datetime] = None,
                               end_time: Optional[datetime] = None,
                               has_exception: Optional[bool] = None,
                               exception_type: Optional[str] = None,
                               batch_id: Optional[str] = None,
                               file_format: str = "xlsx") -> Dict[str, Any]:

        from .quality_service import QualityService
        quality_service = QualityService(self.db)

        result = quality_service.query_samples(
            store_id=store_id,
            manager_id=manager_id,
            status=status,
            start_time=start_time,
            end_time=end_time,
            has_exception=has_exception,
            exception_type=exception_type,
            batch_id=batch_id,
            offset=0,
            limit=10000
        )

        sample_data = []
        for item in result["items"]:
            row = {
                "留样ID": item["id"],
                "门店ID": item["store_id"],
                "门店名称": item.get("store", {}).get("name", ""),
                "门店负责人": item.get("store", {}).get("manager_name", ""),
                "批次ID": item.get("batch_id", ""),
                "菜品名称": item["dish_name"],
                "留样时间": item["sample_time"],
                "留样重量(kg)": item.get("sample_weight", ""),
                "存储位置": item.get("storage_location", ""),
                "留样人": item.get("keeper_name", ""),
                "预计过期时间": item.get("expire_time", ""),
                "实际处置时间": item.get("disposal_time", ""),
                "处置人": item.get("disposal_person", ""),
                "状态": item["status"],
                "是否过期": "是" if item.get("is_expired") else "否",
                "是否有异常": "是" if item.get("has_exception") else "否",
                "是否被拦截": "是" if item.get("is_blocked") else "否",
                "复核状态": item.get("review_status", ""),
                "异常原因": "; ".join([r["reason"] for r in item.get("rule_results", [])])
            }
            sample_data.append(row)

        df = pd.DataFrame(sample_data)

        if file_format == "xlsx":
            output = BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, sheet_name='留样记录', index=False)
                self._write_summary_sheet(writer, result["items"], "留样")
            output.seek(0)
            return {
                "total_records": result["total"],
                "format": "xlsx",
                "data": output.getvalue(),
                "filename": f"留样记录_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
            }
        else:
            csv_data = df.to_csv(index=False, encoding='utf-8-sig')
            return {
                "total_records": result["total"],
                "format": "csv",
                "data": csv_data,
                "filename": f"留样记录_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"
            }

    def export_temperature_report(self,
                                   store_id: Optional[str] = None,
                                   manager_id: Optional[str] = None,
                                   fridge_id: Optional[str] = None,
                                   status: Optional[str] = None,
                                   start_time: Optional[datetime] = None,
                                   end_time: Optional[datetime] = None,
                                   has_exception: Optional[bool] = None,
                                   exception_type: Optional[str] = None,
                                   file_format: str = "xlsx") -> Dict[str, Any]:

        from services.quality_service import QualityService
        quality_service = QualityService(self.db)

        result = quality_service.query_temperature_records(
            store_id=store_id,
            manager_id=manager_id,
            fridge_id=fridge_id,
            status=status,
            start_time=start_time,
            end_time=end_time,
            has_exception=has_exception,
            exception_type=exception_type,
            offset=0,
            limit=10000
        )

        temp_data = []
        for item in result["items"]:
            row = {
                "记录ID": item["id"],
                "门店ID": item["store_id"],
                "门店名称": item.get("store", {}).get("name", ""),
                "门店负责人": item.get("store", {}).get("manager_name", ""),
                "冰箱ID": item.get("fridge_id", ""),
                "冰箱名称": item.get("fridge_name", ""),
                "记录时间": item["record_time"],
                "温度(℃)": item["temperature"],
                "温度下限(℃)": item.get("min_temperature", ""),
                "温度上限(℃)": item.get("max_temperature", ""),
                "温度偏差": item.get("temperature_deviation", ""),
                "记录人": item.get("recorder_name", ""),
                "状态": item["status"],
                "是否异常": "是" if item.get("is_abnormal") else "否",
                "是否有异常": "是" if item.get("has_exception") else "否",
                "复核状态": item.get("review_status", ""),
                "异常原因": "; ".join([r["reason"] for r in item.get("rule_results", [])])
            }
            temp_data.append(row)

        df = pd.DataFrame(temp_data)

        if file_format == "xlsx":
            output = BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, sheet_name='温度记录', index=False)
                self._write_summary_sheet(writer, result["items"], "温度")
            output.seek(0)
            return {
                "total_records": result["total"],
                "format": "xlsx",
                "data": output.getvalue(),
                "filename": f"温度记录_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
            }
        else:
            csv_data = df.to_csv(index=False, encoding='utf-8-sig')
            return {
                "total_records": result["total"],
                "format": "csv",
                "data": csv_data,
                "filename": f"温度记录_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"
            }

    def export_waste_report(self,
                            store_id: Optional[str] = None,
                            manager_id: Optional[str] = None,
                            status: Optional[str] = None,
                            start_time: Optional[datetime] = None,
                            end_time: Optional[datetime] = None,
                            has_exception: Optional[bool] = None,
                            exception_type: Optional[str] = None,
                            batch_id: Optional[str] = None,
                            file_format: str = "xlsx") -> Dict[str, Any]:

        from services.quality_service import QualityService
        quality_service = QualityService(self.db)

        result = quality_service.query_waste_records(
            store_id=store_id,
            manager_id=manager_id,
            status=status,
            start_time=start_time,
            end_time=end_time,
            has_exception=has_exception,
            exception_type=exception_type,
            batch_id=batch_id,
            offset=0,
            limit=10000
        )

        waste_data = []
        for item in result["items"]:
            row = {
                "记录ID": item["id"],
                "门店ID": item["store_id"],
                "门店名称": item.get("store", {}).get("name", ""),
                "门店负责人": item.get("store", {}).get("manager_name", ""),
                "批次ID": item.get("batch_id", ""),
                "菜品名称": item["dish_name"],
                "生产时间": item.get("production_time", ""),
                "废弃时间": item["waste_time"],
                "预计废弃时间": item.get("expected_waste_time", ""),
                "废弃重量(kg)": item.get("waste_weight", ""),
                "废弃原因": item.get("waste_reason", ""),
                "处理人": item.get("handler_name", ""),
                "状态": item["status"],
                "是否有异常": "是" if item.get("has_exception") else "否",
                "复核状态": item.get("review_status", ""),
                "异常原因": "; ".join([r["reason"] for r in item.get("rule_results", [])])
            }
            waste_data.append(row)

        df = pd.DataFrame(waste_data)

        if file_format == "xlsx":
            output = BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, sheet_name='废弃记录', index=False)
                self._write_summary_sheet(writer, result["items"], "废弃")
            output.seek(0)
            return {
                "total_records": result["total"],
                "format": "xlsx",
                "data": output.getvalue(),
                "filename": f"废弃记录_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
            }
        else:
            csv_data = df.to_csv(index=False, encoding='utf-8-sig')
            return {
                "total_records": result["total"],
                "format": "csv",
                "data": csv_data,
                "filename": f"废弃记录_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"
            }

    def _write_summary_sheet(self, writer, items: List[Dict], record_type: str):
        summary_data = []
        summary_data.append({"报告类型": f"{record_type}品控报告"})
        summary_data.append({"导出时间": datetime.now().strftime('%Y-%m-%d %H:%M:%S')})
        summary_data.append({"记录总数": len(items)})
        summary_data.append({})

        exception_count = sum(1 for i in items if i.get("has_exception"))
        blocked_count = sum(1 for i in items if i.get("is_blocked"))
        summary_data.append({"异常记录数": exception_count})
        summary_data.append({"被拦截记录数": blocked_count})
        summary_data.append({"正常记录数": len(items) - exception_count})

        summary_df = pd.DataFrame(summary_data)
        summary_df.to_excel(writer, sheet_name='报告摘要', index=False, header=False)

    def export_comprehensive_report(self,
                                     store_id: Optional[str] = None,
                                     start_time: Optional[datetime] = None,
                                     end_time: Optional[datetime] = None) -> Dict[str, Any]:

        from .quality_service import QualityService
        quality_service = QualityService(self.db)

        sample_result = quality_service.query_samples(
            store_id=store_id, start_time=start_time, end_time=end_time, offset=0, limit=10000
        )

        temp_result = quality_service.query_temperature_records(
            store_id=store_id, start_time=start_time, end_time=end_time, offset=0, limit=10000
        )

        waste_result = quality_service.query_waste_records(
            store_id=store_id, start_time=start_time, end_time=end_time, offset=0, limit=10000
        )

        exception_summary = quality_service.get_exception_summary(
            store_id=store_id, start_time=start_time, end_time=end_time
        )

        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            summary_data = [
                {"项目": "综合品控报告", "内容": ""},
                {"项目": "导出时间", "内容": datetime.now().strftime('%Y-%m-%d %H:%M:%S')},
                {"项目": "统计范围", "内容": f"{start_time or '全部'} ~ {end_time or '全部'}"},
                {"项目": "", "内容": ""},
                {"项目": "留样记录总数", "内容": sample_result["total"]},
                {"项目": "温度记录总数", "内容": temp_result["total"]},
                {"项目": "废弃记录总数", "内容": waste_result["total"]},
                {"项目": "", "内容": ""},
                {"项目": "异常记录总数", "内容": exception_summary["total_exceptions"]},
                {"项目": "被拦截记录总数", "内容": exception_summary["total_blocked"]}
            ]
            summary_df = pd.DataFrame(summary_data)
            summary_df.to_excel(writer, sheet_name='报告摘要', index=False, header=False)

            sample_data = []
            for item in sample_result["items"]:
                sample_data.append({
                    "留样ID": item["id"],
                    "门店名称": item.get("store", {}).get("name", ""),
                    "菜品名称": item["dish_name"],
                    "留样时间": item["sample_time"],
                    "状态": item["status"],
                    "是否过期": "是" if item.get("is_expired") else "否",
                    "是否有异常": "是" if item.get("has_exception") else "否",
                    "异常原因": "; ".join([r["reason"] for r in item.get("rule_results", [])])
                })
            if sample_data:
                pd.DataFrame(sample_data).to_excel(writer, sheet_name='留样明细', index=False)

            temp_data = []
            for item in temp_result["items"]:
                temp_data.append({
                    "记录ID": item["id"],
                    "门店名称": item.get("store", {}).get("name", ""),
                    "冰箱名称": item.get("fridge_name", ""),
                    "记录时间": item["record_time"],
                    "温度(℃)": item["temperature"],
                    "是否异常": "是" if item.get("is_abnormal") else "否",
                    "异常原因": "; ".join([r["reason"] for r in item.get("rule_results", [])])
                })
            if temp_data:
                pd.DataFrame(temp_data).to_excel(writer, sheet_name='温度明细', index=False)

            waste_data = []
            for item in waste_result["items"]:
                waste_data.append({
                    "记录ID": item["id"],
                    "门店名称": item.get("store", {}).get("name", ""),
                    "菜品名称": item["dish_name"],
                    "废弃时间": item["waste_time"],
                    "是否有异常": "是" if item.get("has_exception") else "否",
                    "异常原因": "; ".join([r["reason"] for r in item.get("rule_results", [])])
                })
            if waste_data:
                pd.DataFrame(waste_data).to_excel(writer, sheet_name='废弃明细', index=False)

            exception_data = []
            for ex_type, count in exception_summary.get("by_type", {}).items():
                exception_data.append({
                    "异常类型": ex_type,
                    "数量": count
                })
            if exception_data:
                pd.DataFrame(exception_data).to_excel(writer, sheet_name='异常统计', index=False)

        output.seek(0)
        return {
            "sample_count": sample_result["total"],
            "temperature_count": temp_result["total"],
            "waste_count": waste_result["total"],
            "exception_count": exception_summary["total_exceptions"],
            "format": "xlsx",
            "data": output.getvalue(),
            "filename": f"综合品控报告_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
        }
