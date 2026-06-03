import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
import pandas as pd

from .models import ResurveyProject, MeasurementRecord, ProcessingStatus
from .self_check import SelfChecker


class UnifiedDataSource:
    def __init__(self, project: ResurveyProject):
        self.project = project

    def get_all_records(self) -> List[Dict[str, Any]]:
        return self.project.get_unified_view()

    def get_record_detail(self, record_id: str) -> Optional[Dict[str, Any]]:
        record = self.project.get_record(record_id)
        if not record:
            return None
        data = record.to_dict()
        if record.obstacle_remark:
            data["obstacle_remark_evidence"] = record.obstacle_remark.to_evidence_summary()
        data["floor_sketches_evidence"] = [s.to_evidence_summary() for s in record.floor_sketches]
        return data

    def get_records_by_status(self, status: ProcessingStatus) -> List[Dict[str, Any]]:
        result = []
        for record in self.project.records.values():
            if record.obstacle_remark and record.obstacle_remark.processing_status == status:
                result.append(record.to_dict())
        return result

    def get_records_needing_review(self) -> List[Dict[str, Any]]:
        checker = SelfChecker(self.project)
        return checker.get_records_needing_customer_review()

    def get_evidence_summary(self, record_id: str) -> Optional[Dict[str, Any]]:
        record = self.project.get_record(record_id)
        if not record:
            return None
        return {
            "record_id": record_id,
            "小区名称": record.community_name,
            "楼栋A": record.building_a,
            "楼栋B": record.building_b,
            "测量间距": record.measured_distance,
            "路线长度": record.route_length,
            "是否补录": record.is_supplementary,
            "长度是否已重算": record.length_recalculated,
            "障碍物备注证据": record.obstacle_remark.to_evidence_summary() if record.obstacle_remark else None,
            "楼层剖面草图证据": [s.to_evidence_summary() for s in record.floor_sketches],
            "导出截图": record.export_screenshots,
            "数据来源": "统一数据源",
            "生成时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }


class DataExporter:
    def __init__(self, project: ResurveyProject):
        self.project = project
        self.data_source = UnifiedDataSource(project)

    def export_to_excel(self, file_path: str) -> Dict[str, Any]:
        all_records = self.data_source.get_all_records()
        if not all_records:
            return {"success": False, "error": "无数据可导出"}

        rows = []
        for record in all_records:
            remark = record.get("obstacle_remark", {})
            sketches = record.get("floor_sketches", [])

            row = {
                "记录ID": record.get("record_id"),
                "小区名称": record.get("community_name"),
                "楼栋A": record.get("building_a"),
                "楼栋B": record.get("building_b"),
                "测量间距(米)": record.get("measured_distance"),
                "路线长度(米)": record.get("route_length"),
                "是否补录": "是" if record.get("is_supplementary") else "否",
                "长度是否重算": "是" if record.get("length_recalculated") else "否",
                "原始行号": remark.get("原始行号") if remark else "",
                "原始备注内容": remark.get("原始内容") if remark else "",
                "处理状态": remark.get("当前处理状态") if remark else "",
                "需要客户复核": "是" if (remark and remark.get("是否需要客户复核")) else "否",
                "人工改动记录": " | ".join(remark.get("人工改动记录", [])) if remark else "",
                "补录备注": remark.get("补录备注") if remark else "",
                "楼层草图数量": len(sketches),
                "草图已补看数量": sum(1 for s in sketches if s.get("是否已补看")),
                "导出截图数量": len(record.get("export_screenshots", [])),
                "创建时间": record.get("created_at"),
                "更新时间": record.get("updated_at"),
            }
            rows.append(row)

        df = pd.DataFrame(rows)

        with pd.ExcelWriter(file_path, engine="openpyxl") as writer:
            df.to_excel(writer, sheet_name="测量记录明细", index=False)

            review_records = self.data_source.get_records_needing_review()
            if review_records:
                review_rows = []
                for r in review_records:
                    ev = r.get("evidence", {})
                    review_rows.append({
                        "记录ID": r.get("record_id"),
                        "楼栋": r.get("buildings"),
                        "状态": r.get("status"),
                        "原始行号": ev.get("原始行号"),
                        "原始内容": ev.get("原始内容"),
                        "人工改动": " | ".join(ev.get("人工改动记录", [])),
                    })
                pd.DataFrame(review_rows).to_excel(writer, sheet_name="待客户复核", index=False)

            self_check = SelfChecker(self.project).get_summary()
            summary_rows = [
                {"项目": "项目名称", "值": self_check["project_name"]},
                {"项目": "总记录数", "值": self_check["total_records"]},
                {"项目": "补录记录数", "值": self_check["supplementary_records"]},
                {"项目": "待客户复核数", "值": self_check["needs_customer_review"]},
                {"项目": "未重算长度数", "值": self_check["length_not_recalculated"]},
                {"项目": "自检通过率", "值": f"{self_check['checks_passed']}/{self_check['checks_total']}"},
            ]
            for check in self_check["checks"]:
                summary_rows.append({
                    "项目": f"自检-{check['check_name']}",
                    "值": "通过" if check["passed"] else f"不通过: {check['message']}",
                })
            pd.DataFrame(summary_rows).to_excel(writer, sheet_name="汇总与自检", index=False)

        for record in self.project.records.values():
            record.export_screenshots.append(file_path)
            if record.obstacle_remark:
                record.obstacle_remark.processing_status = ProcessingStatus.EXPORTED
                record.obstacle_remark.add_manual_change(
                    f"导出明细文件: {os.path.basename(file_path)}", "系统"
                )

        return {
            "success": True,
            "file_path": file_path,
            "record_count": len(rows),
            "sheets": ["测量记录明细", "待客户复核", "汇总与自检"],
        }

    def export_to_json(self, file_path: str) -> Dict[str, Any]:
        export_data = {
            "export_info": {
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "project_name": self.project.project_name,
                "data_source": "统一数据源",
            },
            "records": self.data_source.get_all_records(),
            "self_check": SelfChecker(self.project).get_summary(),
            "evidence_summary": [
                self.data_source.get_evidence_summary(rid)
                for rid in self.project.records.keys()
            ],
        }

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2, default=str)

        return {
            "success": True,
            "file_path": file_path,
            "record_count": len(export_data["records"]),
        }

    def export_page_view(self) -> Dict[str, Any]:
        return {
            "project_name": self.project.project_name,
            "summary": SelfChecker(self.project).get_summary(),
            "records": self.data_source.get_all_records(),
            "needing_review": self.data_source.get_records_needing_review(),
            "data_source": "统一数据源",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }

    def verify_consistency(self) -> Dict[str, Any]:
        excel_view = self.data_source.get_all_records()
        page_view = self.export_page_view()["records"]
        json_records = self.data_source.get_all_records()

        inconsistencies = []

        for i, (excel_rec, page_rec, json_rec) in enumerate(
            zip(excel_view, page_view, json_records)
        ):
            rid = excel_rec.get("record_id")
            if excel_rec.get("route_length") != page_rec.get("route_length"):
                inconsistencies.append({
                    "record_id": rid,
                    "field": "route_length",
                    "excel": excel_rec.get("route_length"),
                    "page": page_rec.get("route_length"),
                })
            if excel_rec.get("is_supplementary") != page_rec.get("is_supplementary"):
                inconsistencies.append({
                    "record_id": rid,
                    "field": "is_supplementary",
                    "excel": excel_rec.get("is_supplementary"),
                    "page": page_rec.get("is_supplementary"),
                })
            excel_remark = excel_rec.get("obstacle_remark", {})
            page_remark = page_rec.get("obstacle_remark", {})
            if excel_remark.get("当前处理状态") != page_remark.get("当前处理状态"):
                inconsistencies.append({
                    "record_id": rid,
                    "field": "processing_status",
                    "excel": excel_remark.get("当前处理状态"),
                    "page": page_remark.get("当前处理状态"),
                })

        return {
            "consistent": len(inconsistencies) == 0,
            "inconsistencies": inconsistencies,
            "checked_records": len(excel_view),
            "message": "所有视图数据一致" if len(inconsistencies) == 0
                      else f"发现 {len(inconsistencies)} 处不一致",
        }
