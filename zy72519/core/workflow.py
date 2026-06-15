from datetime import datetime
from pathlib import Path
from typing import Dict, List
import logging

from .importer import DataImporter, ImportType
from .conflict_detector import ConflictDetector
from .conflict_resolver import ConflictResolver
from .self_check import SelfChecker
from models import (
    WorkOrder,
    DesensitizationRemark,
    ConflictSample,
    ConflictStatus,
    HistoryRecord,
    OperationType,
    WorkOrderStatus,
)
from utils import generate_id, save_json, save_csv

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class WorkflowEngine:
    def __init__(self, data_dir: str = "data", output_dir: str = "output"):
        self.data_dir = Path(data_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.importer = DataImporter(data_dir)
        self.detector = ConflictDetector()
        self.resolver = ConflictResolver()
        self.checker = SelfChecker()

        self.step_results: Dict[str, dict] = {}

    def step1_import_work_orders(
        self,
        normal_file: str = None,
        wrong_caliber_file: str = None,
        supplementary_file: str = None,
        operator: str = "system",
    ) -> dict:
        logger.info("=" * 60)
        logger.info("步骤 1: 导入线上反馈工单")
        logger.info("=" * 60)

        results = {
            "normal": {"count": 0, "warnings": []},
            "wrong_caliber": {"count": 0, "warnings": []},
            "supplementary": {"count": 0, "warnings": []},
            "total": 0,
        }

        if normal_file:
            imported, warnings = self.importer.import_work_orders(
                normal_file, ImportType.NORMAL, operator
            )
            results["normal"]["count"] = len(imported)
            results["normal"]["warnings"] = warnings

        if wrong_caliber_file:
            imported, warnings = self.importer.import_work_orders(
                wrong_caliber_file, ImportType.WRONG_CALIBER, operator
            )
            results["wrong_caliber"]["count"] = len(imported)
            results["wrong_caliber"]["warnings"] = warnings

        if supplementary_file:
            imported, warnings = self.importer.import_work_orders(
                supplementary_file, ImportType.SUPPLEMENTARY, operator
            )
            results["supplementary"]["count"] = len(imported)
            results["supplementary"]["warnings"] = warnings

        results["total"] = len(self.importer.work_orders)
        self.step_results["step1"] = results

        logger.info(f"步骤 1 完成: 共导入 {results['total']} 个工单")
        return results

    def step2_review_remarks(
        self,
        remarks_file: str,
        operator: str = "周姐",
    ) -> dict:
        logger.info("=" * 60)
        logger.info("步骤 2: 标注负责人周姐补看脱敏规则备注")
        logger.info("=" * 60)

        remarks = self.importer.import_remarks(remarks_file, operator)

        for remark in remarks:
            work_order = self.importer.work_orders.get(remark.work_order_id)
            if work_order:
                wo_old = work_order.to_dict()
                work_order.reviewer = operator
                work_order.review_time = datetime.now()
                if remark.is_important:
                    if work_order.status == WorkOrderStatus.PENDING:
                        work_order.status = WorkOrderStatus.NEED_REVIEW
                    if not work_order.review_notes:
                        work_order.review_notes = f"周姐已审阅，重要备注: {remark.remark_content[:50]}..."
                    else:
                        work_order.review_notes += f" | 周姐审阅备注: {remark.remark_content[:50]}..."

                from models import HistoryRecord, OperationType
                self.importer.history.append(HistoryRecord(
                    id=generate_id("HIS"),
                    operation_type=OperationType.REVIEW_REMARK,
                    operator=operator,
                    operate_time=datetime.now(),
                    target_id=work_order.id,
                    target_type="work_order",
                    before_state=wo_old,
                    after_state=work_order.to_dict(),
                    notes=f"审阅备注 {remark.id}",
                ))

        results = {
            "remarks_count": len(remarks),
            "important_remarks": sum(1 for r in remarks if r.is_important),
            "affected_work_orders": len(set(r.work_order_id for r in remarks)),
        }
        self.step_results["step2"] = results

        logger.info(f"步骤 2 完成: 审阅 {len(remarks)} 条备注，其中 {results['important_remarks']} 条重要")
        return results

    def step3_update_conflicts(self) -> dict:
        logger.info("=" * 60)
        logger.info("步骤 3: 冲突样本表更新")
        logger.info("=" * 60)

        detected = self.detector.detect_all(
            self.importer.work_orders,
            self.importer.remarks,
        )

        pending_confirm = [c for c in detected if c.status == ConflictStatus.PENDING_CONFIRM]
        need_product_review = [c for c in detected if c.status == ConflictStatus.NEED_PRODUCT_REVIEW]

        results = {
            "total_detected": len(detected),
            "pending_confirmation": len(pending_confirm),
            "need_product_review": len(need_product_review),
            "conflicts": [c.to_dict() for c in detected],
        }
        self.step_results["step3"] = results

        logger.info(f"步骤 3 完成: 检测到 {len(detected)} 个冲突，{len(pending_confirm)} 个待确认，{len(need_product_review)} 个待产品复核")
        return results

    def run_three_step_workflow(
        self,
        normal_file: str,
        remarks_file: str,
        wrong_caliber_file: str = None,
        supplementary_file: str = None,
    ) -> dict:
        logger.info("")
        logger.info("开始执行三步核心流程")
        logger.info("-" * 60)

        step1 = self.step1_import_work_orders(normal_file, wrong_caliber_file, supplementary_file)
        step2 = self.step2_review_remarks(remarks_file)
        step3 = self.step3_update_conflicts()

        self._save_conflict_samples()
        self._save_summary()

        return {
            "step1_import": step1,
            "step2_review_remarks": step2,
            "step3_update_conflicts": step3,
        }

    def list_pending_conflicts(self) -> List[dict]:
        pending = self.resolver.list_conflicts_for_confirmation(self.detector.conflicts)
        result = []
        for c in pending:
            wo = self.importer.work_orders.get(c.work_order_id)
            result.append(self.resolver.format_conflict_evidence(c, wo))
        return result

    def confirm_conflict(self, conflict_id: str, operator: str = "周姐", notes: str = "") -> dict:
        conflict = self.detector.conflicts.get(conflict_id)
        if not conflict:
            raise ValueError(f"Conflict {conflict_id} not found")

        updated = self.resolver.confirm_conflict(conflict, self.importer.work_orders, operator, notes)
        self._save_conflict_samples()
        return updated.to_dict()

    def reject_conflict(self, conflict_id: str, operator: str = "周姐", notes: str = "") -> dict:
        conflict = self.detector.conflicts.get(conflict_id)
        if not conflict:
            raise ValueError(f"Conflict {conflict_id} not found")

        updated = self.resolver.reject_conflict(conflict, self.importer.work_orders, operator, notes)
        self._save_conflict_samples()
        return updated.to_dict()

    def run_self_check(self) -> dict:
        logger.info("")
        logger.info("运行自检模块")
        logger.info("-" * 60)

        results = self.checker.run_all_checks(
            self.importer.work_orders,
            self.importer.remarks,
            self.detector.conflicts,
        )
        report = self.checker.generate_report(str(self.output_dir.parent / "reports"))
        return report

    def export_all(self):
        logger.info("导出所有数据...")
        self.importer.save_state(str(self.output_dir))
        self._save_conflict_samples()
        self._save_history()
        logger.info("导出完成")

    def _save_conflict_samples(self):
        samples = [c.to_dict() for c in self.detector.conflicts.values()]
        save_json(samples, str(self.output_dir / "conflict_samples.json"))

        csv_rows = []
        for c in self.detector.conflicts.values():
            wo = self.importer.work_orders.get(c.work_order_id)

            broken_links_detail = ""
            interception_reason = ""
            for ev in c.evidence:
                details = ev.details or {}
                if "broken_links" in details and details["broken_links"]:
                    bl_list = []
                    for bl in details["broken_links"]:
                        url = bl.get("url", "")
                        sc = bl.get("status_code", "")
                        reason = bl.get("reason", "")
                        bl_list.append(f"{url} (状态码:{sc}, 原因:{reason})")
                    broken_links_detail = " | ".join(bl_list)
                    interception_reason = ev.description

            is_confirmed = "否"
            if c.status.value in ("confirmed", "resolved", "rejected"):
                is_confirmed = "是"

            csv_rows.append({
                "冲突ID": c.id,
                "工单ID": c.work_order_id,
                "工单标题": wo.title if wo else "",
                "冲突类型": c.conflict_type.value,
                "状态": c.status.value,
                "检测时间": c.detect_time.isoformat(),
                "处理人": c.handler or "",
                "处理时间": c.handle_time.isoformat() if c.handle_time else "",
                "处理备注": c.handle_notes,
                "解决方案": c.resolution or "",
                "失效链接": broken_links_detail,
                "拦截原因说明": interception_reason,
                "当前责任方": c.handler or "",
                "是否完成确认": is_confirmed,
            })
        save_csv(csv_rows, str(self.output_dir / "conflict_samples.csv"))

    def _save_history(self):
        all_history = self.importer.history + self.detector.history + self.resolver.history
        save_json([h.to_dict() for h in all_history], str(self.output_dir / "all_history.json"))

    def _save_summary(self):
        summary = {
            "workflow_time": datetime.now().isoformat(),
            "step_results": self.step_results,
            "work_order_summary": {
                "total": len(self.importer.work_orders),
                "by_status": {},
            },
            "conflict_summary": {
                "total": len(self.detector.conflicts),
                "by_status": {},
                "by_type": {},
            },
        }

        for wo in self.importer.work_orders.values():
            status = wo.status.value
            summary["work_order_summary"]["by_status"][status] = (
                summary["work_order_summary"]["by_status"].get(status, 0) + 1
            )

        for c in self.detector.conflicts.values():
            status = c.status.value
            ctype = c.conflict_type.value
            summary["conflict_summary"]["by_status"][status] = (
                summary["conflict_summary"]["by_status"].get(status, 0) + 1
            )
            summary["conflict_summary"]["by_type"][ctype] = (
                summary["conflict_summary"]["by_type"].get(ctype, 0) + 1
            )

        save_json(summary, str(self.output_dir / "workflow_summary.json"))
