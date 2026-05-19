import json
import csv
import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from collections import Counter

from ua_parse import LogEntry
from cluster import Cluster, IPTracker
from path_analyzer import PathAnalyzer
from rule_matcher import RuleMatcher


class Reporter:
    def __init__(self, output_dir: str = "reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_full_report(
        self,
        entries: List[LogEntry],
        rule_matcher: RuleMatcher,
        clusters: List[Cluster],
        ip_tracker: IPTracker,
        path_analyzer: PathAnalyzer,
        input_file: str,
        report_id: Optional[str] = None
    ) -> Dict[str, Any]:
        if report_id is None:
            report_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        valid_entries = [e for e in entries if e.is_valid]
        invalid_entries = [e for e in entries if not e.is_valid]
        
        ua_counts = Counter(e.user_agent for e in valid_entries if e.user_agent)
        unique_uas = len(ua_counts)
        
        category_stats = self._get_category_stats(valid_entries)
        
        report = {
            "report_id": report_id,
            "generated_at": datetime.now().isoformat(),
            "input_file": os.path.basename(input_file),
            "summary": {
                "total_lines": len(entries),
                "valid_entries": len(valid_entries),
                "invalid_entries": len(invalid_entries),
                "unique_user_agents": unique_uas,
                "unique_ips": len(ip_tracker.ip_stats),
                "unique_paths": len(path_analyzer.path_stats)
            },
            "category_distribution": category_stats,
            "classification_rules_used": len(rule_matcher.rules),
            "clustering": {
                "total_clusters": len(clusters),
                "clusters": [self._cluster_to_dict(c) for c in clusters]
            },
            "suspicious_ips": ip_tracker.get_suspicious_ips(min_count=50, risk_ratio=0.3),
            "top_user_agents": [
                {"ua": ua, "count": count, "sample_preview": ua[:100]}
                for ua, count in ua_counts.most_common(50)
            ],
            "top_paths": path_analyzer.get_top_paths(30),
            "path_signatures": path_analyzer.get_top_signatures(20),
            "invalid_lines": [
                {"line_number": e.line_number, "raw_line": e.raw_line, "reason": e.category_reason}
                for e in sorted(invalid_entries, key=lambda x: x.line_number)
            ],
            "unknown_samples_summary": self._unknown_samples_summary(valid_entries)
        }
        
        report_file = self.output_dir / f"report_{report_id}.json"
        with open(report_file, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2, sort_keys=True)
        
        self._generate_csv_summary(entries, report_id)
        self._generate_unknown_samples_csv(valid_entries, report_id)
        
        return report
    
    def _get_category_stats(self, entries: List[LogEntry]) -> Dict[str, Any]:
        counts: Dict[str, int] = Counter()
        ua_by_category: Dict[str, set] = {
            "client": set(), "crawler": set(), "risk": set(), "unknown": set()
        }
        ip_by_category: Dict[str, set] = {k: set() for k in ua_by_category.keys()}
        
        for e in entries:
            cat = e.category
            counts[cat] += 1
            if e.user_agent:
                ua_by_category[cat].add(e.user_agent)
            if e.ip:
                ip_by_category[cat].add(e.ip)
        
        total = sum(counts.values()) or 1
        
        return {
            cat: {
                "count": counts[cat],
                "percentage": round(counts[cat] / total * 100, 2),
                "unique_uas": len(ua_by_category[cat]),
                "unique_ips": len(ip_by_category[cat])
            }
            for cat in ["client", "crawler", "risk", "unknown"]
        }
    
    def _cluster_to_dict(self, cluster: Cluster) -> Dict[str, Any]:
        return {
            "cluster_id": cluster.cluster_id,
            "category": cluster.category,
            "total_requests": cluster.total_requests,
            "unique_ips": cluster.ip_count,
            "unique_paths": cluster.path_count,
            "representative_ua": cluster.representative,
            "common_patterns": cluster.common_patterns,
            "sample_count": len(cluster.samples),
            "sample_lines": [e.line_number for e in sorted(cluster.samples, key=lambda x: x.line_number)[:10]]
        }
    
    def _unknown_samples_summary(self, entries: List[LogEntry]) -> Dict[str, Any]:
        unknown = [e for e in entries if e.category == "unknown"]
        if not unknown:
            return {}
        
        ua_counts = Counter(e.user_agent for e in unknown if e.user_agent)
        ip_counts = Counter(e.ip for e in unknown if e.ip)
        path_counts = Counter(e.path_signature for e in unknown if e.path_signature)
        
        return {
            "total_unknown": len(unknown),
            "top_unknown_uas": [
                {"ua": ua, "count": count}
                for ua, count in ua_counts.most_common(20)
            ],
            "top_unknown_ips": [
                {"ip": ip, "count": count}
                for ip, count in ip_counts.most_common(20)
            ],
            "top_unknown_paths": [
                {"path": path, "count": count}
                for path, count in path_counts.most_common(20)
            ]
        }
    
    def _generate_csv_summary(self, entries: List[LogEntry], report_id: str):
        csv_file = self.output_dir / f"summary_{report_id}.csv"
        
        with open(csv_file, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "line_number", "ip", "category", "category_reason",
                "cluster_id", "ua_family", "os_family", "device_family",
                "is_bot", "is_mobile", "path", "status", "user_agent_preview"
            ])
            
            for entry in sorted(entries, key=lambda x: x.line_number):
                ua_family = entry.parsed_ua.family if entry.parsed_ua else ""
                os_family = entry.parsed_ua.os_family if entry.parsed_ua else ""
                device_family = entry.parsed_ua.device_family if entry.parsed_ua else ""
                is_bot = entry.parsed_ua.is_bot if entry.parsed_ua else False
                is_mobile = entry.parsed_ua.is_mobile if entry.parsed_ua else False
                
                writer.writerow([
                    entry.line_number,
                    entry.ip,
                    entry.category,
                    entry.category_reason,
                    entry.cluster_id,
                    ua_family,
                    os_family,
                    device_family,
                    is_bot,
                    is_mobile,
                    entry.path[:200] if entry.path else "",
                    entry.status,
                    entry.user_agent[:150] if entry.user_agent else ""
                ])
    
    def _generate_unknown_samples_csv(self, entries: List[LogEntry], report_id: str):
        unknown = [e for e in entries if e.category == "unknown" and e.is_valid]
        if not unknown:
            return
        
        csv_file = self.output_dir / f"unknown_samples_{report_id}.csv"
        
        with open(csv_file, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "line_number", "ip", "user_agent", "ua_hash",
                "path_signature", "path", "status", "cluster_id"
            ])
            
            for entry in sorted(unknown, key=lambda x: x.line_number):
                ua_hash = entry.parsed_ua.hash if entry.parsed_ua else ""
                
                writer.writerow([
                    entry.line_number,
                    entry.ip,
                    entry.user_agent,
                    ua_hash,
                    entry.path_signature,
                    entry.path,
                    entry.status,
                    entry.cluster_id
                ])
    
    def print_console_summary(self, report: Dict[str, Any]):
        from rich.console import Console
        from rich.table import Table
        
        console = Console()
        
        console.print(f"\n[bold green]=== UA分类分析报告: {report['report_id']} ===[/bold green]\n")
        
        table = Table(title="分类统计")
        table.add_column("类别")
        table.add_column("请求数", justify="right")
        table.add_column("占比", justify="right")
        table.add_column("唯一UA", justify="right")
        table.add_column("唯一IP", justify="right")
        
        category_names = {
            "client": ("客户端", "blue"),
            "crawler": ("爬虫", "yellow"),
            "risk": ("风险", "red"),
            "unknown": ("未知", "magenta")
        }
        
        for cat, stats in report["category_distribution"].items():
            name, color = category_names.get(cat, (cat, "white"))
            table.add_row(
                f"[{color}]{name}[/{color}]",
                str(stats["count"]),
                f"{stats['percentage']}%",
                str(stats["unique_uas"]),
                str(stats["unique_ips"])
            )
        
        console.print(table)
        
        console.print(f"\n[bold]聚类结果:[/bold] {report['clustering']['total_clusters']} 个聚类")
        for cluster in report['clustering']['clusters'][:5]:
            console.print(
                f"  {cluster['cluster_id']}: {cluster['total_requests']} 请求, "
                f"{cluster['unique_ips']} IP, {cluster['unique_paths']} 路径特征"
            )
            console.print(f"    代表UA: {cluster['representative_ua'][:80]}...")
        
        if report['suspicious_ips']:
            console.print(f"\n[bold red]可疑IP:[/bold] {len(report['suspicious_ips'])} 个")
            for ip in report['suspicious_ips'][:5]:
                console.print(
                    f"  {ip['ip']}: {ip['total_requests']} 请求, "
                    f"风险率 {ip['risk_ratio']*100:.1f}%"
                )
        
        console.print(f"\n[bold]报告文件:[/bold]")
        console.print(f"  JSON: {self.output_dir}/report_{report['report_id']}.json")
        console.print(f"  CSV:  {self.output_dir}/summary_{report['report_id']}.csv")
        console.print()