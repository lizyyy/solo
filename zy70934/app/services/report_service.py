from sqlalchemy.orm import Session
from typing import List, Dict, Any, Tuple
import pandas as pd
from io import BytesIO
from datetime import datetime

from app.models.models import (
    ReconciliationResult, ReconciliationDetail, ReviewRecord,
    ConstructionNode, PhotoRecord, RectificationOrder, Project
)
from app.schemas.schemas import FinalStatus, PhotoStatus
from app.services.review_service import RecalculateService


class ReportService:
    def __init__(self, db: Session):
        self.db = db

    def generate_excel_report(self, result_id: int, include_details: bool = True) -> BytesIO:
        result = self.db.query(ReconciliationResult).filter(
            ReconciliationResult.id == result_id
        ).first()
        
        if not result:
            raise ValueError(f"找不到对账结果ID: {result_id}")
        
        project = self.db.query(Project).filter(Project.id == result.project_id).first()
        recalc_service = RecalculateService(self.db)
        summary = recalc_service.get_summary(result_id)
        details = self.db.query(ReconciliationDetail).filter(
            ReconciliationDetail.reconciliation_result_id == result_id
        ).all()
        
        output = BytesIO()
        
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            self._write_summary_sheet(writer, project, result, summary)
            self._write_summary_stats_sheet(writer, summary)
            
            if include_details:
                self._write_details_sheet(writer, details)
                self._write_reviews_sheet(writer, result_id)
                self._write_audit_trail_sheet(writer, details)
        
        output.seek(0)
        return output

    def generate_csv_report(self, result_id: int, include_details: bool = True) -> BytesIO:
        details = self.db.query(ReconciliationDetail).filter(
            ReconciliationDetail.reconciliation_result_id == result_id
        ).all()
        
        rows = []
        for detail in details:
            rows.append({
                "节点名称": detail.node_name,
                "节点类型": detail.node_type or "",
                "节点金额(元)": detail.node_amount,
                "计划日期": detail.planned_date.strftime("%Y-%m-%d") if detail.planned_date else "",
                "实际日期": detail.actual_date.strftime("%Y-%m-%d") if detail.actual_date else "",
                "要求照片数": detail.required_photos,
                "实际照片数": detail.actual_photos,
                "照片状态": self._translate_photo_status(detail.photo_status),
                "是否逾期": "是" if detail.is_overdue else "否",
                "逾期天数": detail.overdue_days,
                "是否整改": "是" if detail.has_rectification else "否",
                "整改次数": detail.rectification_count,
                "返工次数": detail.rework_count,
                "扣款金额(元)": detail.fine_amount,
                "是否返工复验": "是" if detail.is_rework else "否",
                "最终状态": self._translate_final_status(detail.final_status),
                "差异说明": detail.difference_explanation or ""
            })
        
        df = pd.DataFrame(rows)
        output = BytesIO()
        df.to_csv(output, index=False, encoding='utf-8-sig')
        output.seek(0)
        return output

    def _write_summary_sheet(self, writer, project, result, summary):
        data = [
            ["项目名称", project.project_name if project else "未知"],
            ["工程地址", project.project_address if project else ""],
            ["业主姓名", project.customer_name if project else ""],
            ["对账批次号", result.batch_no],
            ["对账时间", result.created_at.strftime("%Y-%m-%d %H:%M:%S")],
            ["对账状态", self._translate_result_status(result.status)],
            ["", ""],
            ["=== 汇总统计 ===", ""],
            ["总节点数", summary.total_nodes],
            ["已完成节点数", summary.completed_nodes],
            ["完成率(%)", f"{summary.completed_rate}%"],
            ["缺照片节点数", summary.missing_photo_nodes],
            ["逾期节点数", summary.overdue_nodes],
            ["返工总次数", summary.rework_count],
            ["总扣款金额(元)", f"{summary.total_fine_amount:.2f}"],
            ["应付金额(元)", f"{summary.payable_amount:.2f}"],
            ["", ""],
            ["=== 状态分布 ===", ""],
            ["放行(approved)", summary.approved_count],
            ["退回(rejected)", summary.rejected_count],
            ["需补材料(need_material)", summary.need_material_count],
            ["待处理(pending)", summary.pending_count],
        ]
        
        df = pd.DataFrame(data, columns=["项目", "值"])
        df.to_excel(writer, sheet_name="对账汇总", index=False)

    def _write_summary_stats_sheet(self, writer, summary):
        data = [
            ["指标", "数值", "说明"],
            ["总节点数", summary.total_nodes, "本次对账涉及的所有节点"],
            ["已放行", summary.approved_count, "复核通过，可正常付款"],
            ["已退回", summary.rejected_count, "不符合要求，需整改"],
            ["需补材料", summary.need_material_count, "缺少必要证明材料"],
            ["待处理", summary.pending_count, "尚未完成复核"],
            ["完成率", f"{summary.completed_rate}%", "已放行节点占比"],
            ["缺照片数", summary.missing_photo_nodes, "照片不足或缺失的节点"],
            ["逾期数", summary.overdue_nodes, "未按计划完成的节点"],
            ["返工次数", summary.rework_count, "累计返工复验次数"],
            ["扣款金额(元)", f"{summary.total_fine_amount:.2f}", "逾期、返工等扣款合计"],
            ["应付金额(元)", f"{summary.payable_amount:.2f}", "扣除罚款后的应付金额"],
        ]
        
        df = pd.DataFrame(data[1:], columns=data[0])
        df.to_excel(writer, sheet_name="统计说明", index=False)

    def _write_details_sheet(self, writer, details):
        rows = []
        for idx, detail in enumerate(details, 1):
            rows.append({
                "序号": idx,
                "节点名称": detail.node_name,
                "节点类型": detail.node_type or "",
                "节点金额(元)": detail.node_amount,
                "计划日期": detail.planned_date.strftime("%Y-%m-%d") if detail.planned_date else "",
                "实际日期": detail.actual_date.strftime("%Y-%m-%d") if detail.actual_date else "",
                "要求照片数": detail.required_photos,
                "实际照片数": detail.actual_photos,
                "照片状态": self._translate_photo_status(detail.photo_status),
                "是否逾期": "是" if detail.is_overdue else "否",
                "逾期天数": detail.overdue_days,
                "是否整改": "是" if detail.has_rectification else "否",
                "整改次数": detail.rectification_count,
                "返工次数": detail.rework_count,
                "扣款金额(元)": detail.fine_amount,
                "是否返工复验": "是" if detail.is_rework else "否",
                "最终状态": self._translate_final_status(detail.final_status),
                "差异说明": detail.difference_explanation or ""
            })
        
        df = pd.DataFrame(rows)
        df.to_excel(writer, sheet_name="对账明细", index=False)

    def _write_reviews_sheet(self, writer, result_id):
        reviews = self.db.query(ReviewRecord).filter(
            ReviewRecord.reconciliation_result_id == result_id
        ).order_by(ReviewRecord.review_time).all()
        
        rows = []
        for idx, review in enumerate(reviews, 1):
            detail = self.db.query(ReconciliationDetail).filter(
                ReconciliationDetail.id == review.reconciliation_detail_id
            ).first()
            
            rows.append({
                "序号": idx,
                "对账明细ID": review.reconciliation_detail_id or "",
                "节点名称": detail.node_name if detail else "",
                "复核人": review.reviewer or "",
                "复核动作": self._translate_review_action(review.review_action),
                "复核意见": review.review_comment or "",
                "调整扣款(元)": review.adjusted_fine_amount if review.adjusted_fine_amount else "",
                "差异来源": review.difference_source or "",
                "复核时间": review.review_time.strftime("%Y-%m-%d %H:%M:%S") if review.review_time else ""
            })
        
        df = pd.DataFrame(rows)
        df.to_excel(writer, sheet_name="复核记录", index=False)

    def _write_audit_trail_sheet(self, writer, details):
        rows = []
        for detail in details:
            reviews = self.db.query(ReviewRecord).filter(
                ReviewRecord.reconciliation_detail_id == detail.id
            ).order_by(ReviewRecord.review_time).all()
            
            review_history = " → ".join([
                f"{r.reviewer or '系统'}[{r.review_time.strftime('%m-%d %H:%M')}] "
                f"{self._translate_review_action(r.review_action)}: "
                f"{r.review_comment or r.difference_source or ''}"
                for r in reviews
            ]) if reviews else "无复核记录"
            
            rows.append({
                "节点名称": detail.node_name,
                "节点类型": detail.node_type or "",
                "自动检查结果": self._summarize_auto_check(detail),
                "复核轨迹": review_history,
                "最终状态": self._translate_final_status(detail.final_status),
                "可解释性说明": self._generate_explainable_note(detail, reviews)
            })
        
        df = pd.DataFrame(rows)
        df.to_excel(writer, sheet_name="审计轨迹", index=False)

    def _summarize_auto_check(self, detail: ReconciliationDetail) -> str:
        parts = []
        if detail.photo_status == PhotoStatus.MISSING:
            parts.append("缺照片")
        elif detail.photo_status == PhotoStatus.PARTIAL:
            parts.append("照片不全")
        if detail.is_overdue:
            parts.append(f"逾期{detail.overdue_days}天")
        if detail.is_rework:
            parts.append(f"返工{detail.rework_count}次")
        if detail.has_rectification and not detail.is_rework:
            parts.append(f"整改{detail.rectification_count}次")
        return "、".join(parts) if parts else "正常"

    def _generate_explainable_note(self, detail: ReconciliationDetail, reviews: List[ReviewRecord]) -> str:
        status = detail.final_status
        explanation = detail.difference_explanation or ""
        
        if status == FinalStatus.APPROVED:
            return f"已放行：{explanation or '数据完整，符合验收标准'}"
        elif status == FinalStatus.REJECTED:
            return f"已退回：{explanation or '存在问题需整改'}"
        elif status == FinalStatus.NEED_MATERIAL:
            return f"需补材料：{explanation or '缺少必要证明材料'}"
        else:
            return f"待处理：{explanation or '尚未完成复核'}"

    def _translate_photo_status(self, status: str) -> str:
        translations = {
            "complete": "完整",
            "missing": "缺失",
            "partial": "不全",
            "unknown": "未设置"
        }
        return translations.get(status, status)

    def _translate_final_status(self, status: str) -> str:
        translations = {
            "approved": "已放行",
            "rejected": "已退回",
            "need_material": "需补材料",
            "pending": "待处理"
        }
        return translations.get(status, status)

    def _translate_result_status(self, status: str) -> str:
        translations = {
            "draft": "草稿",
            "auto_completed": "自动对账完成",
            "reviewed": "已复核",
            "final": "已确认"
        }
        return translations.get(status, status)

    def _translate_review_action(self, action: str) -> str:
        translations = {
            "approve": "放行",
            "reject": "退回",
            "request_material": "要求补材料",
            "adjust_fine": "调整扣款",
            "update_explanation": "更新说明"
        }
        return translations.get(action, action)

    def get_detail_audit_trail(self, detail_id: int) -> Dict[str, Any]:
        detail = self.db.query(ReconciliationDetail).filter(
            ReconciliationDetail.id == detail_id
        ).first()
        
        if not detail:
            raise ValueError(f"找不到对账明细ID: {detail_id}")
        
        node = self.db.query(ConstructionNode).filter(
            ConstructionNode.id == detail.node_id
        ).first()
        
        photos = self.db.query(PhotoRecord).filter(
            PhotoRecord.node_id == detail.node_id
        ).all()
        
        rectifications = self.db.query(RectificationOrder).filter(
            RectificationOrder.node_id == detail.node_id
        ).all()
        
        reviews = self.db.query(ReviewRecord).filter(
            ReviewRecord.reconciliation_detail_id == detail_id
        ).order_by(ReviewRecord.review_time).all()
        
        return {
            "detail": {
                "id": detail.id,
                "node_name": detail.node_name,
                "node_type": detail.node_type,
                "node_amount": detail.node_amount,
                "final_status": detail.final_status,
                "difference_explanation": detail.difference_explanation,
                "auto_check_result": detail.auto_check_result
            },
            "node_info": {
                "node_code": node.node_code if node else None,
                "planned_date": node.planned_date.isoformat() if node and node.planned_date else None,
                "actual_date": node.actual_date.isoformat() if node and node.actual_date else None,
                "required_photos": node.required_photos if node else 0,
                "csv_source": node.csv_source if node else None
            } if node else None,
            "photos": [
                {
                    "photo_name": p.photo_name,
                    "photo_url": p.photo_url,
                    "upload_time": p.upload_time.isoformat() if p.upload_time else None,
                    "photo_type": p.photo_type,
                    "uploader": p.uploader
                } for p in photos
            ],
            "rectifications": [
                {
                    "order_no": r.order_no,
                    "issue_description": r.issue_description,
                    "is_rework": r.is_rework,
                    "rework_count": r.rework_count,
                    "fine_amount": r.fine_amount,
                    "status": r.rectification_status,
                    "required_completion_date": r.required_completion_date.isoformat() if r.required_completion_date else None,
                    "actual_completion_date": r.actual_completion_date.isoformat() if r.actual_completion_date else None
                } for r in rectifications
            ],
            "review_history": [
                {
                    "reviewer": r.reviewer,
                    "review_action": r.review_action,
                    "review_comment": r.review_comment,
                    "adjusted_fine_amount": r.adjusted_fine_amount,
                    "difference_source": r.difference_source,
                    "review_time": r.review_time.isoformat() if r.review_time else None
                } for r in reviews
            ],
            "explanation": self._generate_explainable_note(detail, reviews)
        }
