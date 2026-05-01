"""
报告导出模块
负责导出 Markdown 周报、簇明细 CSV、疑似新问题 JSON
"""

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, TextIO
from dataclasses import dataclass

from .config import Config
from .csv_parser import ParsedTicket, load_all_tickets
from .clustering import ClusteringResult, Cluster, TicketClusterer
from .detector import DetectionReport, DetectionType


@dataclass
class ExportResult:
    format: str
    path: Path
    record_count: int
    created_at: datetime


class ReportExporter:
    def __init__(self, config: Config):
        self.config = config
    
    def export_markdown_weekly(
        self,
        clusters: ClusteringResult,
        detection_report: Optional[DetectionReport] = None,
        tickets_map: Optional[Dict[str, ParsedTicket]] = None,
        output_path: Optional[Path] = None
    ) -> ExportResult:
        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d")
            output_path = self.config.get_output_path() / f"weekly_report_{timestamp}.md"
        
        output_path.parent.mkdir(exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            self._write_markdown_header(f)
            self._write_markdown_overview(f, clusters, detection_report)
            self._write_markdown_clusters(f, clusters, tickets_map)
            
            if detection_report:
                self._write_markdown_detections(f, detection_report, tickets_map)
            
            self._write_markdown_footer(f)
        
        return ExportResult(
            format="markdown",
            path=output_path,
            record_count=clusters.total_tickets,
            created_at=datetime.now()
        )
    
    def _write_markdown_header(self, f: TextIO):
        f.write("# 客服工单质检周报\n\n")
        f.write(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write("---\n\n")
    
    def _write_markdown_overview(
        self,
        f: TextIO,
        clusters: ClusteringResult,
        detection_report: Optional[DetectionReport]
    ):
        f.write("## 概览\n\n")
        
        f.write("### 聚类统计\n\n")
        f.write(f"- **总工单数量**: {clusters.total_tickets}\n")
        f.write(f"- **聚类数量**: {clusters.n_clusters}\n")
        if clusters.silhouette_score is not None:
            f.write(f"- **轮廓系数**: {clusters.silhouette_score:.4f}\n")
        f.write(f"- **聚类算法**: {clusters.algorithm}\n\n")
        
        if detection_report:
            f.write("### 检测结果\n\n")
            f.write(f"- **属于旧簇**: {detection_report.old_cluster_count}\n")
            f.write(f"- **疑似新问题**: {detection_report.new_issue_count}\n")
            f.write(f"- **重复用户投诉**: {detection_report.duplicate_user_count}\n")
            f.write(f"- **结论矛盾**: {detection_report.conflicting_count}\n\n")
        
        f.write("---\n\n")
    
    def _write_markdown_clusters(
        self,
        f: TextIO,
        clusters: ClusteringResult,
        tickets_map: Optional[Dict[str, ParsedTicket]]
    ):
        f.write("## 问题簇明细\n\n")
        
        for i, cluster in enumerate(clusters.clusters):
            f.write(f"### 簇 #{cluster.cluster_id}\n\n")
            
            f.write(f"- **关键词**: {', '.join(cluster.keywords) if cluster.keywords else '无'}\n")
            f.write(f"- **工单数量**: {cluster.size}\n")
            f.write(f"- **置信度**: {cluster.confidence:.2%}\n")
            if cluster.tags:
                f.write(f"- **标签**: {', '.join(cluster.tags)}\n")
            f.write("\n")
            
            if cluster.representative_ticket_id and tickets_map:
                rep_ticket = tickets_map.get(cluster.representative_ticket_id)
                if rep_ticket:
                    f.write("**代表工单**:\n\n")
                    description = rep_ticket.sanitized_data.get("用户描述", "")
                    conclusion = rep_ticket.sanitized_data.get("处理结论", "")
                    
                    if len(description) > 200:
                        description = description[:200] + "..."
                    
                    f.write(f"> 描述: {description}\n\n")
                    if conclusion:
                        if len(conclusion) > 100:
                            conclusion = conclusion[:100] + "..."
                        f.write(f"> 结论: {conclusion}\n\n")
            
            if cluster.size > 1 and tickets_map:
                f.write("**其他工单示例**:\n\n")
                count = 0
                for ticket_id in cluster.ticket_ids:
                    if ticket_id == cluster.representative_ticket_id:
                        continue
                    
                    ticket = tickets_map.get(ticket_id)
                    if ticket:
                        description = ticket.sanitized_data.get("用户描述", "")
                        if len(description) > 50:
                            description = description[:50] + "..."
                        f.write(f"- `{ticket_id}`: {description}\n")
                        count += 1
                        if count >= 3:
                            break
                f.write("\n")
            
            f.write("---\n\n")
    
    def _write_markdown_detections(
        self,
        f: TextIO,
        detection_report: DetectionReport,
        tickets_map: Optional[Dict[str, ParsedTicket]]
    ):
        f.write("## 检测结果\n\n")
        
        new_issues = [r for r in detection_report.results if r.detection_type == DetectionType.NEW_ISSUE]
        if new_issues:
            f.write("### 疑似新问题\n\n")
            for result in new_issues[:10]:
                f.write(f"#### 工单 `{result.ticket_id}`\n\n")
                f.write(f"- **置信度**: {result.confidence:.2%}\n")
                if result.details.get("description_preview"):
                    f.write(f"- **描述预览**: {result.details['description_preview']}\n")
                f.write("\n")
            if len(new_issues) > 10:
                f.write(f"... 还有 {len(new_issues) - 10} 个疑似新问题\n\n")
        
        duplicates = [r for r in detection_report.results if r.detection_type == DetectionType.DUPLICATE_USER]
        if duplicates:
            f.write("### 重复用户投诉\n\n")
            for result in duplicates[:10]:
                f.write(f"#### 工单 `{result.ticket_id}`\n\n")
                f.write(f"- **置信度**: {result.confidence:.2%}\n")
                matching = result.details.get("matching_tickets", [])
                if matching:
                    f.write(f"- **匹配工单数量**: {result.details.get('total_matches', 0)}\n")
                    f.write(f"- **匹配示例**: {', '.join([m['ticket_id'] for m in matching[:3]])}\n")
                f.write("\n")
        
        conflicts = [r for r in detection_report.results if r.detection_type == DetectionType.CONFLICTING_CONCLUSION]
        if conflicts:
            f.write("### 处理结论矛盾\n\n")
            for result in conflicts[:10]:
                f.write(f"#### 工单 `{result.ticket_id}`\n\n")
                f.write(f"- **置信度**: {result.confidence:.2%}\n")
                f.write(f"- **当前结论**: {result.details.get('current_conclusion', '未知')}\n")
                conflicting = result.details.get("conflicting_tickets", [])
                if conflicting:
                    f.write(f"- **矛盾工单数量**: {result.details.get('total_conflicts', 0)}\n")
                    for c in conflicting[:2]:
                        f.write(f"  - `{c['ticket_id']}`: {c['conclusion']}\n")
                f.write("\n")
    
    def _write_markdown_footer(self, f: TextIO):
        f.write("\n---\n\n")
        f.write("> 本报告由「投诉工单相似簇助手」自动生成\n")
    
    def export_clusters_csv(
        self,
        clusters: ClusteringResult,
        tickets_map: Dict[str, ParsedTicket],
        output_path: Optional[Path] = None
    ) -> ExportResult:
        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = self.config.get_output_path() / f"clusters_{timestamp}.csv"
        
        output_path.parent.mkdir(exist_ok=True)
        
        rows = []
        for cluster in clusters.clusters:
            for ticket_id in cluster.ticket_ids:
                ticket = tickets_map.get(ticket_id)
                if ticket:
                    row = {
                        "cluster_id": cluster.cluster_id,
                        "cluster_keywords": ",".join(cluster.keywords),
                        "cluster_size": cluster.size,
                        "cluster_confidence": f"{cluster.confidence:.4f}",
                        "ticket_id": ticket_id,
                        "is_representative": "是" if ticket_id == cluster.representative_ticket_id else "否"
                    }
                    
                    for key, value in ticket.sanitized_data.items():
                        row[f"field_{key}"] = value if value is not None else ""
                    
                    rows.append(row)
        
        if rows:
            fieldnames = list(rows[0].keys())
            with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)
        
        return ExportResult(
            format="csv",
            path=output_path,
            record_count=len(rows),
            created_at=datetime.now()
        )
    
    def export_new_issues_json(
        self,
        detection_report: DetectionReport,
        tickets_map: Dict[str, ParsedTicket],
        output_path: Optional[Path] = None
    ) -> ExportResult:
        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = self.config.get_output_path() / f"new_issues_{timestamp}.json"
        
        output_path.parent.mkdir(exist_ok=True)
        
        new_issues = [r for r in detection_report.results if r.detection_type == DetectionType.NEW_ISSUE]
        
        output_data = {
            "import_id": detection_report.import_id,
            "generated_at": detection_report.generated_at.isoformat(),
            "total_new_issues": len(new_issues),
            "issues": []
        }
        
        for result in new_issues:
            ticket = tickets_map.get(result.ticket_id)
            issue_data = {
                "ticket_id": result.ticket_id,
                "confidence": result.confidence,
                "max_similarity_to_existing": result.details.get("max_similarity_to_existing"),
                "ticket_data": ticket.sanitized_data if ticket else None,
                "detected_at": result.detected_at.isoformat()
            }
            output_data["issues"].append(issue_data)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        
        return ExportResult(
            format="json",
            path=output_path,
            record_count=len(new_issues),
            created_at=datetime.now()
        )
    
    def export_detection_report_json(
        self,
        detection_report: DetectionReport,
        output_path: Optional[Path] = None
    ) -> ExportResult:
        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = self.config.get_output_path() / f"detection_report_{timestamp}.json"
        
        output_path.parent.mkdir(exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(detection_report.to_dict(), f, ensure_ascii=False, indent=2)
        
        return ExportResult(
            format="json",
            path=output_path,
            record_count=len(detection_report.results),
            created_at=datetime.now()
        )


def run_export_all(
    config: Config,
    clusters: ClusteringResult,
    detection_report: Optional[DetectionReport] = None
) -> List[ExportResult]:
    exporter = ReportExporter(config)
    
    all_tickets, _ = load_all_tickets(config)
    tickets_map = {t.ticket_id: t for t in all_tickets}
    
    results = []
    
    md_result = exporter.export_markdown_weekly(clusters, detection_report, tickets_map)
    results.append(md_result)
    
    csv_result = exporter.export_clusters_csv(clusters, tickets_map)
    results.append(csv_result)
    
    if detection_report:
        new_issues_result = exporter.export_new_issues_json(detection_report, tickets_map)
        results.append(new_issues_result)
        
        detection_json_result = exporter.export_detection_report_json(detection_report)
        results.append(detection_json_result)
    
    return results
