import pandas as pd
import json
from typing import List
from io import BytesIO
from datetime import datetime
from sqlalchemy.orm import Session

from app.models import ArticleReference, HealthReport, ReferenceStatus, FailureReason


class ReportExporter:
    @staticmethod
    def export_references_to_excel(references: List[ArticleReference]) -> BytesIO:
        data = []
        for ref in references:
            source_title = ref.source_article.title if ref.source_article else "未知"
            target_title = ref.target_article.title if ref.target_article else "未知"
            
            data.append({
                "引用ID": ref.id,
                "源文章标题": source_title,
                "源文章ID": ref.source_article_id,
                "目标文章标题": target_title,
                "目标文章ID": ref.target_article_id,
                "目标URL": ref.target_url,
                "链接文本": ref.link_text,
                "引用次数": ref.reference_count,
                "状态": ref.status.value if ref.status else "",
                "失效原因": ref.failure_reason.value if ref.failure_reason else "",
                "失效详情": ref.failure_detail,
                "处理时间": ref.processed_at.strftime("%Y-%m-%d %H:%M:%S") if ref.processed_at else "",
                "创建时间": ref.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            })
        
        df = pd.DataFrame(data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name="引用列表", index=False)
        output.seek(0)
        return output

    @staticmethod
    def export_health_report_to_json(report: HealthReport) -> str:
        report_data = {
            "report_id": report.id,
            "report_type": report.report_type,
            "generated_at": report.generated_at.strftime("%Y-%m-%d %H:%M:%S"),
            "generated_by": report.generated_by,
            "statistics": {
                "total_articles": report.total_articles,
                "total_references": report.total_references,
                "invalid_references": report.invalid_references,
                "deprecated_product_references": report.deprecated_product_references,
                "broken_links": report.broken_links,
                "needs_review_count": report.needs_review_count,
            },
            "health_score": ReportExporter._calculate_health_score(report)
        }
        return json.dumps(report_data, ensure_ascii=False, indent=2)

    @staticmethod
    def _calculate_health_score(report: HealthReport) -> float:
        if report.total_references == 0:
            return 100.0
        valid_count = report.total_references - report.invalid_references
        return round((valid_count / report.total_references) * 100, 2)

    @staticmethod
    def export_statistics_to_excel(db: Session) -> BytesIO:
        references = db.query(ArticleReference).all()
        
        status_stats = {}
        for status in ReferenceStatus:
            count = db.query(ArticleReference).filter(
                ArticleReference.status == status
            ).count()
            status_stats[status.value] = count
        
        reason_stats = {}
        for reason in FailureReason:
            count = db.query(ArticleReference).filter(
                ArticleReference.failure_reason == reason
            ).count()
            reason_stats[reason.value] = count
        
        status_df = pd.DataFrame(list(status_stats.items()), columns=["状态", "数量"])
        reason_df = pd.DataFrame(list(reason_stats.items()), columns=["失效原因", "数量"])
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            status_df.to_excel(writer, sheet_name="状态统计", index=False)
            reason_df.to_excel(writer, sheet_name="失效原因统计", index=False)
        output.seek(0)
        return output
