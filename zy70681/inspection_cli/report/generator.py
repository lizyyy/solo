import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import asdict

import pandas as pd

from ..models.base import (
    InspectionSession,
    ParsingError
)
from ..rules.engine import RuleResult, RuleEngine
from ..photo.manager import PhotoManager
from ..utils.helpers import stable_hash


class ReportGenerator:
    def __init__(self, output_dir: Optional[str] = None):
        self.output_dir = Path(output_dir) if output_dir else Path.cwd() / "reports"
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _calculate_content_hash(self, session: InspectionSession) -> str:
        """计算会话内容的稳定哈希，确保相同内容产生相同哈希"""
        content_parts = [
            session.session_id,
            *sorted(session.stores.keys()),
            *sorted(session.items.keys()),
            *sorted(session.tasks.keys()),
            *sorted(session.rechecks.keys()),
            *sorted(session.deductions.keys()),
            *sorted(session.photos.keys()),
            str(len(session.parsing_errors))
        ]
        return stable_hash("|".join(content_parts))[:12]

    def generate_full_report(
        self,
        session: InspectionSession,
        rule_result: RuleResult,
        photo_manager: PhotoManager,
        format: str = "excel",
        stable_filename: bool = False
    ) -> str:
        content_hash = self._calculate_content_hash(session)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        if stable_filename:
            filename = f"inspection_report_{content_hash}.{format.lower()}"
        else:
            filename = f"inspection_report_{timestamp}_{content_hash}.{format.lower()}"

        if format.lower() == "json":
            return self._generate_json_report(session, rule_result, photo_manager, filename)
        else:
            return self._generate_excel_report(session, rule_result, photo_manager, filename)

    def _generate_excel_report(
        self,
        session: InspectionSession,
        rule_result: RuleResult,
        photo_manager: PhotoManager,
        filename: str
    ) -> str:
        file_path = self.output_dir / filename

        with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
            self._write_summary_sheet(writer, rule_result)
            self._write_store_scores_sheet(writer, rule_result)
            self._write_tasks_sheet(writer, session, rule_result)
            self._write_rechecks_sheet(writer, session)
            self._write_deductions_sheet(writer, session)
            self._write_photos_sheet(writer, session, photo_manager)
            self._write_warnings_sheet(writer, rule_result)
            self._write_errors_sheet(writer, session)

        return str(file_path)

    def _write_summary_sheet(self, writer: pd.ExcelWriter, rule_result: RuleResult) -> None:
        summary = rule_result.summary
        data = []
        for key in sorted(summary.keys()):
            value = summary[key]
            if isinstance(value, dict):
                for sub_key in sorted(value.keys()):
                    data.append({
                        "项目": f"{key} - {sub_key}",
                        "值": value[sub_key]
                    })
            else:
                data.append({
                    "项目": key,
                    "值": value
                })

        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name="汇总", index=False)

    def _write_store_scores_sheet(self, writer: pd.ExcelWriter, rule_result: RuleResult) -> None:
        data = []
        for store_id in sorted(rule_result.store_scores.keys()):
            score = rule_result.store_scores[store_id]
            data.append({
                "门店编号": store_id,
                "门店名称": score.store_name,
                "原始总分": score.total_score,
                "满分": score.max_score,
                "得分率(%)": round(score.percentage, 2),
                "扣分": score.deduction_points,
                "最终得分": round(score.final_score, 2),
                "合格项数": score.pass_count,
                "不合格项数": score.fail_count
            })

        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name="门店评分", index=False)

    def _write_tasks_sheet(
        self,
        writer: pd.ExcelWriter,
        session: InspectionSession,
        rule_result: RuleResult
    ) -> None:
        data = []
        for task_id in sorted(rule_result.task_statuses.keys()):
            status = rule_result.task_statuses[task_id]
            task = session.tasks.get(task_id)
            if not task:
                continue

            store = session.stores.get(task.store_id)
            store_name = store.store_name if store else task.store_id

            data.append({
                "任务编号": task_id,
                "门店": store_name,
                "整改要求": task.description,
                "负责人": task.assigned_to,
                "截止时间": task.deadline.strftime("%Y-%m-%d") if task.deadline else "",
                "当前状态": status.current_status.value,
                "复查次数": status.recheck_count,
                "最后复查结果": status.last_recheck_result.value if status.last_recheck_result else "",
                "有照片证据": "是" if status.has_photo_evidence else "否",
                "是否逾期": "是" if status.is_overdue else "否",
                "来源位置": str(task.source_location) if task.source_location else ""
            })

        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name="整改任务", index=False)

    def _write_rechecks_sheet(self, writer: pd.ExcelWriter, session: InspectionSession) -> None:
        data = []
        for recheck_id in sorted(session.rechecks.keys()):
            recheck = session.rechecks[recheck_id]
            store = session.stores.get(recheck.store_id)
            store_name = store.store_name if store else recheck.store_id

            data.append({
                "复查编号": recheck.recheck_id,
                "关联任务": recheck.task_id,
                "门店": store_name,
                "复查人": recheck.rechecker,
                "复查时间": recheck.rechecked_at.strftime("%Y-%m-%d %H:%M") if recheck.rechecked_at else "",
                "复查结果": recheck.result.value,
                "原因说明": recheck.reason,
                "照片数": len(recheck.photos),
                "来源位置": str(recheck.source_location) if recheck.source_location else ""
            })

        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name="复查记录", index=False)

    def _write_deductions_sheet(self, writer: pd.ExcelWriter, session: InspectionSession) -> None:
        data = []
        for ded_id in sorted(session.deductions.keys()):
            ded = session.deductions[ded_id]
            store = session.stores.get(ded.store_id)
            store_name = store.store_name if store else ded.store_id

            data.append({
                "扣分编号": ded.deduction_id,
                "关联巡检项": ded.item_id,
                "门店": store_name,
                "扣分原因": ded.reason,
                "扣分数": ded.points,
                "扣分时间": ded.deducted_at.strftime("%Y-%m-%d %H:%M") if ded.deducted_at else "",
                "扣分人": ded.deducted_by,
                "来源位置": str(ded.source_location) if ded.source_location else ""
            })

        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name="扣分记录", index=False)

    def _write_photos_sheet(
        self,
        writer: pd.ExcelWriter,
        session: InspectionSession,
        photo_manager: PhotoManager
    ) -> None:
        photo_results = photo_manager.validate_all_photos(session)
        photo_usage = photo_manager.get_photo_usage(session)

        data = []
        for photo_id in sorted(photo_results.keys()):
            result = photo_results[photo_id]
            photo = session.photos.get(photo_id)
            if not photo:
                continue

            usage = ", ".join(sorted(photo_usage.get(photo_id, [])))

            data.append({
                "照片编号": photo_id,
                "文件路径": result.file_path,
                "照片类型": photo.photo_type,
                "描述": photo.description,
                "拍摄人": photo.taken_by or "",
                "拍摄时间": photo.taken_at.strftime("%Y-%m-%d %H:%M") if photo.taken_at else "",
                "文件存在": "是" if result.exists else "否",
                "有效图片": "是" if result.is_valid_image else "否",
                "文件大小(字节)": result.file_size or 0,
                "文件哈希": result.file_hash or "",
                "尺寸": f"{result.dimensions[0]}x{result.dimensions[1]}" if result.dimensions else "",
                "使用位置": usage,
                "错误信息": "; ".join(sorted(result.errors)),
                "来源位置": str(photo.source_location) if photo.source_location else ""
            })

        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name="照片管理", index=False)

    def _write_warnings_sheet(self, writer: pd.ExcelWriter, rule_result: RuleResult) -> None:
        data = [{"序号": i + 1, "警告内容": w} for i, w in enumerate(rule_result.warnings)]
        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name="警告信息", index=False)

    def _write_errors_sheet(self, writer: pd.ExcelWriter, session: InspectionSession) -> None:
        data = []
        for i, error in enumerate(session.parsing_errors):
            data.append({
                "序号": i + 1,
                "错误类型": error.error_type,
                "错误信息": error.message,
                "来源位置": str(error.source_location),
                "原始数据": str(error.raw_data)
            })

        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name="解析错误", index=False)

    def _generate_json_report(
        self,
        session: InspectionSession,
        rule_result: RuleResult,
        photo_manager: PhotoManager,
        filename: str
    ) -> str:
        file_path = self.output_dir / filename

        summary = dict(sorted(rule_result.summary.items()))
        store_scores = {
            store_id: {
                "store_name": score.store_name,
                "total_score": score.total_score,
                "max_score": score.max_score,
                "percentage": score.percentage,
                "deduction_points": score.deduction_points,
                "final_score": score.final_score,
                "pass_count": score.pass_count,
                "fail_count": score.fail_count
            }
            for store_id in sorted(rule_result.store_scores.keys())
        }
        tasks = {
            task_id: {
                "current_status": status.current_status.value,
                "recheck_count": status.recheck_count,
                "last_recheck_result": status.last_recheck_result.value if status.last_recheck_result else None,
                "has_photo_evidence": status.has_photo_evidence,
                "is_overdue": status.is_overdue
            }
            for task_id in sorted(rule_result.task_statuses.keys())
        }

        report_data = {
            "session_id": session.session_id,
            "content_hash": self._calculate_content_hash(session),
            "summary": summary,
            "store_scores": store_scores,
            "tasks": tasks,
            "warnings": sorted(rule_result.warnings),
            "parsing_errors": [
                {
                    "error_type": e.error_type,
                    "message": e.message,
                    "source_location": str(e.source_location),
                    "raw_data": str(e.raw_data)
                }
                for e in session.parsing_errors
            ]
        }

        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2, sort_keys=True)

        return str(file_path)

    def generate_store_detail_report(
        self,
        session: InspectionSession,
        engine: RuleEngine,
        store_id: str
    ) -> str:
        summary = engine.get_store_summary(session, store_id)
        if not summary:
            return ""

        store = summary["store"]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"store_{store_id}_{timestamp}.xlsx"
        file_path = self.output_dir / filename

        with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
            info_data = [{
                "门店编号": store.store_id,
                "门店名称": store.store_name,
                "区域": store.region,
                "店长": store.manager or "",
                "地址": store.address or "",
                "巡检项总数": summary["item_count"],
                "合格项数": summary["passed_count"],
                "整改任务数": summary["task_count"],
                "复查次数": summary["recheck_count"],
                "总扣分": summary["total_deduction_points"]
            }]
            pd.DataFrame(info_data).T.to_excel(writer, sheet_name="门店信息", header=False)

            if summary["items"]:
                items_data = []
                for item in summary["items"]:
                    items_data.append({
                        "巡检项编号": item.item_id,
                        "分类": item.category,
                        "检查项": item.item_name,
                        "得分": item.score,
                        "满分": item.max_score,
                        "是否通过": "是" if item.is_pass else "否",
                        "巡检人": item.inspector,
                        "巡检时间": item.inspected_at.strftime("%Y-%m-%d %H:%M") if item.inspected_at else "",
                        "备注": item.remarks
                    })
                pd.DataFrame(items_data).to_excel(writer, sheet_name="巡检项", index=False)

            if summary["tasks"]:
                tasks_data = []
                for task in summary["tasks"]:
                    tasks_data.append({
                        "任务编号": task.task_id,
                        "关联巡检项": task.item_id,
                        "整改要求": task.description,
                        "负责人": task.assigned_to,
                        "截止时间": task.deadline.strftime("%Y-%m-%d") if task.deadline else "",
                        "状态": task.status.value,
                        "创建时间": task.created_at.strftime("%Y-%m-%d %H:%M") if task.created_at else ""
                    })
                pd.DataFrame(tasks_data).to_excel(writer, sheet_name="整改任务", index=False)

            if summary["rechecks"]:
                rechecks_data = []
                for recheck in summary["rechecks"]:
                    rechecks_data.append({
                        "复查编号": recheck.recheck_id,
                        "关联任务": recheck.task_id,
                        "复查人": recheck.rechecker,
                        "复查时间": recheck.rechecked_at.strftime("%Y-%m-%d %H:%M") if recheck.rechecked_at else "",
                        "结果": recheck.result.value,
                        "原因": recheck.reason
                    })
                pd.DataFrame(rechecks_data).to_excel(writer, sheet_name="复查记录", index=False)

            if summary["deductions"]:
                ded_data = []
                for ded in summary["deductions"]:
                    ded_data.append({
                        "扣分编号": ded.deduction_id,
                        "关联巡检项": ded.item_id,
                        "原因": ded.reason,
                        "分数": ded.points,
                        "时间": ded.deducted_at.strftime("%Y-%m-%d %H:%M") if ded.deducted_at else "",
                        "扣分人": ded.deducted_by
                    })
                pd.DataFrame(ded_data).to_excel(writer, sheet_name="扣分记录", index=False)

        return str(file_path)

    def generate_item_trace_report(
        self,
        session: InspectionSession,
        engine: RuleEngine,
        item_id: str
    ) -> str:
        trace = engine.get_item_traceability(session, item_id)
        if not trace:
            return ""

        item = trace["item"]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"item_{item_id}_{timestamp}.xlsx"
        file_path = self.output_dir / filename

        with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
            info_data = [{
                "巡检项编号": item.item_id,
                "门店编号": item.store_id,
                "分类": item.category,
                "检查项": item.item_name,
                "得分": item.score,
                "满分": item.max_score,
                "是否通过": "是" if item.is_pass else "否",
                "巡检人": item.inspector,
                "巡检时间": item.inspected_at.strftime("%Y-%m-%d %H:%M") if item.inspected_at else ""
            }]
            pd.DataFrame(info_data).T.to_excel(writer, sheet_name="巡检项信息", header=False)

            if trace["tasks"]:
                tasks_data = []
                for task in trace["tasks"]:
                    tasks_data.append({
                        "任务编号": task.task_id,
                        "整改要求": task.description,
                        "负责人": task.assigned_to,
                        "截止时间": task.deadline.strftime("%Y-%m-%d") if task.deadline else "",
                        "状态": task.status.value
                    })
                pd.DataFrame(tasks_data).to_excel(writer, sheet_name="整改任务", index=False)

            if trace["rechecks"]:
                rechecks_data = []
                for recheck in trace["rechecks"]:
                    rechecks_data.append({
                        "复查编号": recheck.recheck_id,
                        "关联任务": recheck.task_id,
                        "复查人": recheck.rechecker,
                        "复查时间": recheck.rechecked_at.strftime("%Y-%m-%d %H:%M") if recheck.rechecked_at else "",
                        "结果": recheck.result.value,
                        "原因": recheck.reason
                    })
                pd.DataFrame(rechecks_data).to_excel(writer, sheet_name="复查记录", index=False)

            if trace["deductions"]:
                ded_data = []
                for ded in trace["deductions"]:
                    ded_data.append({
                        "扣分编号": ded.deduction_id,
                        "原因": ded.reason,
                        "分数": ded.points,
                        "时间": ded.deducted_at.strftime("%Y-%m-%d %H:%M") if ded.deducted_at else "",
                        "扣分人": ded.deducted_by
                    })
                pd.DataFrame(ded_data).to_excel(writer, sheet_name="扣分记录", index=False)

            if trace["photos"]:
                photos_data = []
                for photo in trace["photos"]:
                    photos_data.append({
                        "照片编号": photo.photo_id,
                        "文件路径": photo.file_path,
                        "类型": photo.photo_type,
                        "描述": photo.description
                    })
                pd.DataFrame(photos_data).to_excel(writer, sheet_name="照片证据", index=False)

        return str(file_path)
