from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import csv
import io
from pathlib import Path

from app.models.meeting import Meeting
from app.models.compare import CompareResult
from app.models.correction import CorrectionRecord
from app.repositories.meeting_repo import meeting_repo
from app.core.config import settings
from app.core.exceptions import BusinessException


class ExportService:
    def export_raw_data(self, db: Session, meeting_id: int) -> bytes:
        meeting = meeting_repo.get_by_id_or_404(db, meeting_id, "会议")

        compare_results = db.query(CompareResult).filter(
            CompareResult.meeting_id == meeting_id,
            CompareResult.is_deleted == False
        ).order_by(CompareResult.id).all()

        corrections = db.query(CorrectionRecord).filter(
            CorrectionRecord.meeting_id == meeting_id,
            CorrectionRecord.is_deleted == False
        ).order_by(CorrectionRecord.id).all()

        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["会议原始数据导出"])
        writer.writerow(["会议名称", meeting.title])
        writer.writerow(["会议编号", meeting.meeting_no])
        writer.writerow(["导出时间", datetime.now().strftime("%Y-%m-%d %H:%M:%S")])
        writer.writerow([])

        writer.writerow(["=== 会议内容 ==="])
        for line in meeting.content.split("\n"):
            writer.writerow([line])
        writer.writerow([])

        writer.writerow(["=== 质检结果 ==="])
        writer.writerow([
            "序号", "问题", "标准答案", "会议回答",
            "相似度", "是否匹配", "状态", "错误类型",
            "是否受版本影响", "影响版本", "创建时间"
        ])

        for idx, result in enumerate(compare_results, 1):
            writer.writerow([
                idx,
                result.question,
                result.standard_answer or "",
                result.meeting_answer or "",
                f"{result.similarity:.2%}",
                "是" if result.is_match else "否",
                self._translate_status(result.status),
                self._translate_error_type(result.error_type),
                "是" if result.is_affected_by_version else "否",
                result.affected_version or "",
                result.created_at.strftime("%Y-%m-%d %H:%M:%S")
            ])
        writer.writerow([])

        writer.writerow(["=== 修正记录 ==="])
        writer.writerow([
            "序号", "比对结果ID", "原始状态", "修正后状态",
            "原始回答", "修正后回答", "修正原因",
            "操作人", "创建时间"
        ])

        for idx, corr in enumerate(corrections, 1):
            writer.writerow([
                idx,
                corr.compare_result_id or "",
                self._translate_status(corr.original_status),
                self._translate_status(corr.corrected_status),
                corr.original_answer or "",
                corr.corrected_answer or "",
                corr.correction_reason or "",
                corr.operator or "",
                corr.created_at.strftime("%Y-%m-%d %H:%M:%S")
            ])

        return output.getvalue().encode("utf-8-sig")

    def export_weekly_report(self, db: Session, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None) -> bytes:
        if end_date is None:
            end_date = datetime.now()
        if start_date is None:
            start_date = end_date - timedelta(days=7)

        meetings = db.query(Meeting).filter(
            Meeting.is_deleted == False,
            Meeting.created_at >= start_date,
            Meeting.created_at <= end_date + timedelta(days=1)
        ).order_by(Meeting.created_at.desc()).all()

        if not meetings:
            raise BusinessException(
                message="No meetings found for the specified period",
                user_friendly_message="这个时间段没有会议数据哦～"
            )

        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["=== 质检周报 ==="])
        writer.writerow(["统计周期", f"{start_date.strftime('%Y-%m-%d')} 至 {end_date.strftime('%Y-%m-%d')}"])
        writer.writerow(["导出时间", datetime.now().strftime("%Y-%m-%d %H:%M:%S")])
        writer.writerow([])

        total_meetings = len(meetings)
        total_questions = sum(m.total_questions for m in meetings)
        total_correct = sum(m.correct_count for m in meetings)
        total_errors = sum(m.error_count for m in meetings)
        avg_accuracy = (total_correct / total_questions * 100) if total_questions > 0 else 0

        writer.writerow(["=== 整体统计 ==="])
        writer.writerow(["会议总数", total_meetings])
        writer.writerow(["问题总数", total_questions])
        writer.writerow(["正确数量", total_correct])
        writer.writerow(["错误数量", total_errors])
        writer.writerow(["平均准确率", f"{avg_accuracy:.1f}%"])
        writer.writerow([])

        writer.writerow(["=== 各会议详情 ==="])
        writer.writerow([
            "序号", "会议名称", "会议编号", "问题数",
            "正确数", "错误数", "准确率", "状态", "创建时间"
        ])

        for idx, meeting in enumerate(meetings, 1):
            writer.writerow([
                idx,
                meeting.title,
                meeting.meeting_no,
                meeting.total_questions,
                meeting.correct_count,
                meeting.error_count,
                meeting.accuracy,
                self._translate_status(meeting.status),
                meeting.created_at.strftime("%Y-%m-%d %H:%M:%S")
            ])
        writer.writerow([])

        all_compare_results = []
        for meeting in meetings:
            results = db.query(CompareResult).filter(
                CompareResult.meeting_id == meeting.id,
                CompareResult.is_deleted == False
            ).all()
            all_compare_results.extend(results)

        error_type_stats: Dict[str, int] = {}
        affected_by_version_count = 0

        for result in all_compare_results:
            if result.error_type:
                error_type_stats[result.error_type] = error_type_stats.get(result.error_type, 0) + 1
            if result.is_affected_by_version:
                affected_by_version_count += 1

        writer.writerow(["=== 错误类型分布 ==="])
        writer.writerow(["错误类型", "数量", "占比"])
        total_errors = sum(error_type_stats.values())
        for err_type, count in error_type_stats.items():
            ratio = (count / total_errors * 100) if total_errors > 0 else 0
            writer.writerow([
                self._translate_error_type(err_type),
                count,
                f"{ratio:.1f}%"
            ])
        writer.writerow([])

        writer.writerow(["=== 版本影响统计 ==="])
        writer.writerow(["受版本影响的问题数", affected_by_version_count])
        writer.writerow([])

        writer.writerow(["=== 待处理问题 ==="])
        writer.writerow(["会议名称", "问题", "状态", "相似度", "是否受版本影响"])
        need_review = [r for r in all_compare_results if r.status == "need_review" or r.is_affected_by_version]
        for result in need_review:
            meeting = next((m for m in meetings if m.id == result.meeting_id), None)
            writer.writerow([
                meeting.title if meeting else "",
                result.question,
                self._translate_status(result.status),
                f"{result.similarity:.2%}",
                "是" if result.is_affected_by_version else "否"
            ])

        return output.getvalue().encode("utf-8-sig")

    def get_weekly_report_data(self, db: Session, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None) -> Dict[str, Any]:
        if end_date is None:
            end_date = datetime.now()
        if start_date is None:
            start_date = end_date - timedelta(days=7)

        meetings = db.query(Meeting).filter(
            Meeting.is_deleted == False,
            Meeting.created_at >= start_date,
            Meeting.created_at <= end_date + timedelta(days=1)
        ).order_by(Meeting.created_at.desc()).all()

        total_meetings = len(meetings)
        total_questions = sum(m.total_questions for m in meetings)
        total_correct = sum(m.correct_count for m in meetings)
        total_errors = sum(m.error_count for m in meetings)
        avg_accuracy = (total_correct / total_questions * 100) if total_questions > 0 else 0

        all_compare_results = []
        for meeting in meetings:
            results = db.query(CompareResult).filter(
                CompareResult.meeting_id == meeting.id,
                CompareResult.is_deleted == False
            ).all()
            all_compare_results.extend(results)

        error_type_stats: Dict[str, int] = {}
        affected_by_version_count = 0
        need_review_count = 0

        for result in all_compare_results:
            if result.error_type:
                error_type_stats[result.error_type] = error_type_stats.get(result.error_type, 0) + 1
            if result.is_affected_by_version:
                affected_by_version_count += 1
            if result.status == "need_review":
                need_review_count += 1

        return {
            "period": {
                "start_date": start_date.strftime("%Y-%m-%d"),
                "end_date": end_date.strftime("%Y-%m-%d")
            },
            "summary": {
                "total_meetings": total_meetings,
                "total_questions": total_questions,
                "total_correct": total_correct,
                "total_errors": total_errors,
                "average_accuracy": f"{avg_accuracy:.1f}%",
                "need_review_count": need_review_count,
                "affected_by_version_count": affected_by_version_count
            },
            "error_type_distribution": {
                self._translate_error_type(k): v for k, v in error_type_stats.items()
            },
            "meetings": [
                {
                    "id": m.id,
                    "title": m.title,
                    "meeting_no": m.meeting_no,
                    "total_questions": m.total_questions,
                    "correct_count": m.correct_count,
                    "error_count": m.error_count,
                    "accuracy": m.accuracy,
                    "status": self._translate_status(m.status),
                    "created_at": m.created_at.strftime("%Y-%m-%d %H:%M:%S")
                }
                for m in meetings
            ]
        }

    def save_export_file(self, content: bytes, filename: str) -> str:
        export_dir = Path(settings.UPLOAD_DIR) / "exports"
        export_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        save_filename = f"{timestamp}_{filename}"
        save_path = export_dir / save_filename

        with open(save_path, "wb") as f:
            f.write(content)

        return str(save_path)

    def _translate_status(self, status: Optional[str]) -> str:
        status_map = {
            "pending": "待处理",
            "processing": "处理中",
            "completed": "已完成",
            "failed": "处理失败",
            "correct": "正确",
            "error": "错误",
            "need_review": "待复核"
        }
        return status_map.get(status or "", status or "")

    def _translate_error_type(self, error_type: Optional[str]) -> str:
        error_map = {
            "missing": "缺失",
            "wrong": "错误",
            "incomplete": "不完整",
            "correct": "正确"
        }
        return error_map.get(error_type or "", error_type or "")


export_service = ExportService()
