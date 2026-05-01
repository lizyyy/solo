import csv
import json
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from collections import defaultdict

from classroom_cluster.models import (
    QuestionItem, QuestionCluster, Chapter, ReviewStatus, TimeRange
)
from classroom_cluster.review import ReviewSession, ReviewActionType


def format_seconds(seconds: Optional[float]) -> str:
    if seconds is None:
        return "--:--:--"
    
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


class ReportGenerator:
    def __init__(
        self,
        clusters: List[QuestionCluster],
        questions: Optional[List[QuestionItem]] = None,
        chapters: Optional[List[Chapter]] = None,
        review_session: Optional[ReviewSession] = None,
    ):
        self.clusters = clusters
        self.questions = questions or []
        self.question_map = {q.id: q for q in self.questions}
        self.chapters = chapters or []
        self.chapter_map = {c.id: c for c in self.chapters}
        self.review_session = review_session
    
    def generate_markdown_report(self, project_name: str = "培训项目") -> str:
        lines = []
        
        lines.append(f"# {project_name} - 课堂疑问复盘报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        stats = self._calculate_statistics()
        lines.append("## 📊 概览统计")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总问题数 | {stats['total_questions']} |")
        lines.append(f"| 聚类数 | {stats['total_clusters']} |")
        lines.append(f"| 已确认聚类 | {stats['confirmed_clusters']} |")
        lines.append(f"| 已解决聚类 | {stats['resolved_clusters']} |")
        lines.append(f"| 待处理聚类 | {stats['pending_clusters']} |")
        lines.append("")
        
        if self.chapters:
            lines.append("## 📚 按章节分布")
            lines.append("")
            
            chapter_stats = self._calculate_chapter_statistics()
            for chapter_title, chapter_data in sorted(chapter_stats.items(), key=lambda x: x[1]['order']):
                lines.append(f"### {chapter_title}")
                lines.append("")
                lines.append(f"- 问题数量: {chapter_data['question_count']}")
                lines.append(f"- 聚类数量: {chapter_data['cluster_count']}")
                if chapter_data['time_range']:
                    lines.append(f"- 时间范围: {chapter_data['time_range']}")
                lines.append("")
        
        lines.append("## 🎯 问题聚类详情")
        lines.append("")
        
        active_clusters = [
            c for c in self.clusters
            if c.review_status not in [ReviewStatus.DISCARDED, ReviewStatus.MERGED]
        ]
        
        for i, cluster in enumerate(active_clusters, 1):
            status_icon = self._get_status_icon(cluster.review_status)
            lines.append(f"### {status_icon} 聚类 #{i}: {cluster.representative_question[:50]}{'...' if len(cluster.representative_question) > 50 else ''}")
            lines.append("")
            
            lines.append(f"- **置信度**: {cluster.confidence:.1%}")
            lines.append(f"- **状态**: {self._get_status_text(cluster.review_status)}")
            
            if cluster.chapter_title:
                lines.append(f"- **所属章节**: {cluster.chapter_title}")
            
            if cluster.avg_time_start is not None:
                lines.append(f"- **平均时间点**: {format_seconds(cluster.avg_time_start)}")
            
            lines.append(f"- **问题数量**: {len(cluster.questions)}")
            lines.append("")
            
            lines.append("#### 代表性问题")
            lines.append("")
            lines.append(f"> {cluster.representative_question}")
            lines.append("")
            
            if len(cluster.questions) > 1:
                lines.append("#### 所有相关问题")
                lines.append("")
                
                for j, qid in enumerate(cluster.questions, 1):
                    question = self.question_map.get(qid)
                    if question:
                        time_str = format_seconds(
                            question.time_range.start_seconds if question.time_range else None
                        )
                        speaker = question.speaker or "未知用户"
                        lines.append(f"{j}. `[{time_str}]` **{speaker}**: {question.content}")
                    else:
                        lines.append(f"{j}. [问题ID: {qid}]")
                
                lines.append("")
            
            if cluster.review_notes:
                lines.append("#### 复核备注")
                lines.append("")
                lines.append(cluster.review_notes)
                lines.append("")
        
        unclustered = self._get_unclustered_questions()
        if unclustered:
            lines.append("## 📌 未聚类问题")
            lines.append("")
            for i, q in enumerate(unclustered, 1):
                time_str = format_seconds(
                    q.time_range.start_seconds if q.time_range else None
                )
                lines.append(f"{i}. `[{time_str}]` {q.content}")
            lines.append("")
        
        if self.review_session and self.review_session.actions:
            lines.append("## 📝 复核操作记录")
            lines.append("")
            
            for action in self.review_session.actions:
                action_name = self._get_action_name(action.action_type)
                time_str = action.timestamp.strftime('%Y-%m-%d %H:%M:%S')
                lines.append(f"- `[{time_str}]` **{action_name}**: 聚类 {action.cluster_id}")
                if action.target_cluster_ids:
                    lines.append(f"  - 涉及聚类: {', '.join(action.target_cluster_ids)}")
                if action.notes:
                    lines.append(f"  - 备注: {action.notes}")
            
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*本报告由课堂疑问聚类助手自动生成*")
        
        return "\n".join(lines)
    
    def generate_csv_question_list(self) -> str:
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        headers = [
            "问题ID", "聚类ID", "内容", "发言者", "时间点", "来源类型",
            "问题类型", "章节ID", "章节标题", "置信度", "聚类状态"
        ]
        writer.writerow(headers)
        
        for cluster in self.clusters:
            for qid in cluster.questions:
                question = self.question_map.get(qid)
                if question:
                    row = [
                        question.id,
                        cluster.id,
                        question.content,
                        question.speaker,
                        format_seconds(
                            question.time_range.start_seconds if question.time_range else None
                        ),
                        question.source_type.value,
                        question.question_type.value,
                        question.chapter_id or "",
                        question.chapter_title or "",
                        f"{cluster.confidence:.4f}",
                        cluster.review_status.value,
                    ]
                    writer.writerow(row)
        
        unclustered = self._get_unclustered_questions()
        for question in unclustered:
            row = [
                question.id,
                "",
                question.content,
                question.speaker,
                format_seconds(
                    question.time_range.start_seconds if question.time_range else None
                ),
                question.source_type.value,
                question.question_type.value,
                question.chapter_id or "",
                question.chapter_title or "",
                "",
                "unclustered",
            ]
            writer.writerow(row)
        
        return output.getvalue()
    
    def generate_json_audit_record(self, project_name: str = "培训项目") -> str:
        record = {
            "project_name": project_name,
            "generated_at": datetime.now().isoformat(),
            "version": "0.1.0",
            "summary": self._calculate_statistics(),
            "clusters": [],
            "questions": [],
            "review_actions": [],
        }
        
        for cluster in self.clusters:
            cluster_data = cluster.to_dict()
            cluster_data["question_details"] = []
            
            for qid in cluster.questions:
                question = self.question_map.get(qid)
                if question:
                    cluster_data["question_details"].append(question.to_dict())
            
            record["clusters"].append(cluster_data)
        
        for question in self.questions:
            record["questions"].append(question.to_dict())
        
        if self.review_session:
            record["review_session"] = self.review_session.to_dict()
        
        return json.dumps(record, ensure_ascii=False, indent=2)
    
    def _calculate_statistics(self) -> Dict[str, Any]:
        total_questions = len(self.questions)
        total_clusters = len(self.clusters)
        
        status_counts: Dict[str, int] = defaultdict(int)
        for cluster in self.clusters:
            status_counts[cluster.review_status.value] += 1
        
        clustered_questions = sum(
            len(c.questions) for c in self.clusters
            if c.review_status not in [ReviewStatus.DISCARDED, ReviewStatus.MERGED]
        )
        
        return {
            "total_questions": total_questions,
            "total_clusters": total_clusters,
            "clustered_questions": clustered_questions,
            "unclustered_questions": total_questions - clustered_questions,
            "confirmed_clusters": status_counts.get("confirmed", 0),
            "resolved_clusters": status_counts.get("resolved", 0),
            "pending_clusters": status_counts.get("pending", 0),
            "discarded_clusters": status_counts.get("discarded", 0),
            "merged_clusters": status_counts.get("merged", 0),
        }
    
    def _calculate_chapter_statistics(self) -> Dict[str, Dict[str, Any]]:
        chapter_stats: Dict[str, Dict[str, Any]] = {}
        
        for cluster in self.clusters:
            if not cluster.chapter_title:
                continue
            
            if cluster.chapter_title not in chapter_stats:
                chapter = self.chapter_map.get(cluster.chapter_id) if cluster.chapter_id else None
                time_range = None
                if chapter and chapter.time_range:
                    start = format_seconds(chapter.time_range.start_seconds)
                    end = format_seconds(chapter.time_range.end_seconds)
                    time_range = f"{start} - {end}"
                
                chapter_stats[cluster.chapter_title] = {
                    "order": chapter.order if chapter else 0,
                    "question_count": 0,
                    "cluster_count": 0,
                    "time_range": time_range,
                }
            
            chapter_stats[cluster.chapter_title]["question_count"] += len(cluster.questions)
            chapter_stats[cluster.chapter_title]["cluster_count"] += 1
        
        return chapter_stats
    
    def _get_unclustered_questions(self) -> List[QuestionItem]:
        clustered_ids = set()
        for cluster in self.clusters:
            if cluster.review_status not in [ReviewStatus.DISCARDED, ReviewStatus.MERGED]:
                clustered_ids.update(cluster.questions)
        
        return [q for q in self.questions if q.id not in clustered_ids]
    
    def _get_status_icon(self, status: ReviewStatus) -> str:
        icons = {
            ReviewStatus.PENDING: "⏳",
            ReviewStatus.CONFIRMED: "✅",
            ReviewStatus.MERGED: "🔗",
            ReviewStatus.SPLIT: "✂️",
            ReviewStatus.RESOLVED: "🎯",
            ReviewStatus.DISCARDED: "❌",
        }
        return icons.get(status, "❓")
    
    def _get_status_text(self, status: ReviewStatus) -> str:
        texts = {
            ReviewStatus.PENDING: "待处理",
            ReviewStatus.CONFIRMED: "已确认",
            ReviewStatus.MERGED: "已合并",
            ReviewStatus.SPLIT: "已拆分",
            ReviewStatus.RESOLVED: "已解决",
            ReviewStatus.DISCARDED: "已废弃",
        }
        return texts.get(status, "未知")
    
    def _get_action_name(self, action_type: ReviewActionType) -> str:
        names = {
            ReviewActionType.CONFIRM: "确认聚类",
            ReviewActionType.MERGE: "合并聚类",
            ReviewActionType.SPLIT: "拆分聚类",
            ReviewActionType.RESOLVE: "标记已解决",
            ReviewActionType.DISCARD: "标记已废弃",
            ReviewActionType.ADD_NOTE: "添加备注",
        }
        return names.get(action_type, "未知操作")
