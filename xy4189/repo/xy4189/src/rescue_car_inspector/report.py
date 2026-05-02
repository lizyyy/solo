"""报告生成模块

用于生成 Markdown、CSV、JSON 格式的巡检报告。
"""

import csv
import json
from datetime import datetime, date
from pathlib import Path
from typing import Dict, List, Any, Optional

from .rules import CheckResult, CheckCategory, Severity
from .storage import ReviewStorage


class ReportGenerator:
    """报告生成器类"""
    
    SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"]
    SEVERITY_LABELS = {
        "critical": "严重",
        "high": "高",
        "medium": "中",
        "low": "低",
        "info": "信息",
    }
    SEVERITY_EMOJI = {
        "critical": "🔴",
        "high": "🟠",
        "medium": "🟡",
        "low": "🟢",
        "info": "ℹ️",
    }
    
    def __init__(
        self,
        title: str = "抢救车巡检报告",
        organization: str = "急诊科",
    ):
        """初始化报告生成器
        
        Args:
            title: 报告标题
            organization: 组织名称
        """
        self.title = title
        self.organization = organization
        self._review_storage: Optional[ReviewStorage] = None
    
    def set_review_storage(self, storage: ReviewStorage) -> None:
        """设置复核存储
        
        Args:
            storage: 复核存储实例
        """
        self._review_storage = storage
    
    def _get_review_info(self, result_id: str) -> Dict[str, Any]:
        """获取复核信息
        
        Args:
            result_id: 检查结果ID
        
        Returns:
            复核信息字典
        """
        if not self._review_storage:
            return {"status": "pending", "comment": None}
        
        review = self._review_storage.get_review(result_id)
        if review:
            return {
                "status": review.get("status", "pending"),
                "comment": review.get("comment"),
                "reviewer": review.get("reviewer"),
                "reviewed_time": review.get("reviewed_time"),
            }
        
        return {"status": "pending", "comment": None}
    
    def _calculate_statistics(
        self,
        all_results: Dict[str, List[CheckResult]],
    ) -> Dict[str, Any]:
        """计算统计信息
        
        Args:
            all_results: 所有检查结果
        
        Returns:
            统计信息字典
        """
        total_count = 0
        severity_counts: Dict[str, int] = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "info": 0,
        }
        category_counts: Dict[str, int] = {}
        
        for category, results in all_results.items():
            category_counts[category] = len(results)
            total_count += len(results)
            
            for result in results:
                severity = result.severity.value
                if severity in severity_counts:
                    severity_counts[severity] += 1
        
        return {
            "total_count": total_count,
            "by_severity": severity_counts,
            "by_category": category_counts,
            "generated_at": datetime.now().isoformat(),
        }
    
    def generate_markdown(
        self,
        all_results: Dict[str, List[CheckResult]],
    ) -> str:
        """生成 Markdown 格式报告
        
        Args:
            all_results: 所有检查结果
        
        Returns:
            Markdown 格式字符串
        """
        stats = self._calculate_statistics(all_results)
        
        lines = []
        
        lines.append(f"# {self.title}")
        lines.append("")
        lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"> 生成单位: {self.organization}")
        lines.append("")
        
        lines.append("## 概览")
        lines.append("")
        lines.append("### 问题统计")
        lines.append("")
        
        total = stats["total_count"]
        lines.append(f"- **总计问题数**: {total}")
        lines.append("")
        
        lines.append("| 严重程度 | 数量 | 占比 |")
        lines.append("|----------|------|------|")
        
        for sev in self.SEVERITY_ORDER:
            count = stats["by_severity"].get(sev, 0)
            percentage = (count / total * 100) if total > 0 else 0
            lines.append(f"| {self.SEVERITY_EMOJI.get(sev, '')} {self.SEVERITY_LABELS.get(sev, sev)} | {count} | {percentage:.1f}% |")
        
        lines.append("")
        lines.append("### 按类别统计")
        lines.append("")
        
        lines.append("| 检查类别 | 问题数 |")
        lines.append("|----------|--------|")
        
        for category, count in stats["by_category"].items():
            lines.append(f"| {category} | {count} |")
        
        lines.append("")
        
        lines.append("## 详细问题列表")
        lines.append("")
        
        for category, results in all_results.items():
            if not results:
                continue
            
            lines.append(f"### {category}")
            lines.append("")
            
            sorted_results = sorted(
                results,
                key=lambda x: self.SEVERITY_ORDER.index(x.severity.value)
            )
            
            for i, result in enumerate(sorted_results, 1):
                sev = result.severity.value
                review_info = self._get_review_info(result.rid)
                status_label = review_info.get("status", "pending")
                status_display = {
                    "pending": "⏳ 待处理",
                    "confirmed": "✅ 已确认",
                    "resolved": "✔️ 已解决",
                    "dismissed": "❌ 已忽略",
                }.get(status_label, status_label)
                
                lines.append(f"#### {i}. {self.SEVERITY_EMOJI.get(sev, '')} {result.description}")
                lines.append("")
                lines.append(f"- **ID**: {result.rid}")
                lines.append(f"- **严重程度**: {self.SEVERITY_LABELS.get(sev, sev)}")
                lines.append(f"- **复核状态**: {status_display}")
                lines.append("")
                
                if result.details:
                    lines.append("**详细信息**:")
                    lines.append("")
                    lines.append("```json")
                    lines.append(json.dumps(result.details, ensure_ascii=False, indent=2, default=str))
                    lines.append("```")
                    lines.append("")
                
                if result.affected_items:
                    lines.append(f"**涉及项目**: {', '.join(result.affected_items)}")
                    lines.append("")
                
                if result.suggestion:
                    lines.append(f"💡 **建议**: {result.suggestion}")
                    lines.append("")
                
                if review_info.get("comment"):
                    lines.append(f"📝 **处理意见**: {review_info['comment']}")
                    lines.append("")
                
                lines.append("---")
                lines.append("")
        
        lines.append("## 附录")
        lines.append("")
        lines.append("### 严重程度说明")
        lines.append("")
        lines.append("- 🔴 **严重 (critical)**: 需要立即处理的紧急问题")
        lines.append("- 🟠 **高 (high)**: 需要尽快处理的重要问题")
        lines.append("- 🟡 **中 (medium)**: 需要关注的一般问题")
        lines.append("- 🟢 **低 (low)**: 建议改进的次要问题")
        lines.append("- ℹ️ **信息 (info)**: 仅供参考的信息提示")
        lines.append("")
        
        lines.append("### 复核状态说明")
        lines.append("")
        lines.append("- ⏳ **待处理 (pending)**: 尚未进行复核")
        lines.append("- ✅ **已确认 (confirmed)**: 问题已确认存在")
        lines.append("- ✔️ **已解决 (resolved)**: 问题已解决")
        lines.append("- ❌ **已忽略 (dismissed)**: 问题被忽略或误报")
        lines.append("")
        
        return "\n".join(lines)
    
    def generate_csv(
        self,
        all_results: Dict[str, List[CheckResult]],
        output_path: Path,
    ) -> None:
        """生成 CSV 格式报告
        
        Args:
            all_results: 所有检查结果
            output_path: 输出文件路径
        """
        rows = []
        
        headers = [
            "ID",
            "检查类别",
            "严重程度",
            "描述",
            "详细信息",
            "涉及项目",
            "建议",
            "复核状态",
            "处理意见",
            "检查时间",
        ]
        
        for category, results in all_results.items():
            for result in results:
                review_info = self._get_review_info(result.rid)
                
                rows.append({
                    "ID": result.rid,
                    "检查类别": category,
                    "严重程度": self.SEVERITY_LABELS.get(result.severity.value, result.severity.value),
                    "描述": result.description,
                    "详细信息": json.dumps(result.details, ensure_ascii=False, default=str),
                    "涉及项目": ", ".join(result.affected_items),
                    "建议": result.suggestion or "",
                    "复核状态": review_info.get("status", "pending"),
                    "处理意见": review_info.get("comment") or "",
                    "检查时间": result.check_time.isoformat() if result.check_time else "",
                })
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(rows)
    
    def generate_json(
        self,
        all_results: Dict[str, List[CheckResult]],
        output_path: Path,
    ) -> None:
        """生成 JSON 格式报告
        
        Args:
            all_results: 所有检查结果
            output_path: 输出文件路径
        """
        stats = self._calculate_statistics(all_results)
        
        report_data: Dict[str, Any] = {
            "title": self.title,
            "organization": self.organization,
            "generated_at": datetime.now().isoformat(),
            "statistics": stats,
            "results": {},
        }
        
        for category, results in all_results.items():
            report_data["results"][category] = []
            
            for result in results:
                review_info = self._get_review_info(result.rid)
                
                result_dict = result.to_dict()
                result_dict["review"] = review_info
                report_data["results"][category].append(result_dict)
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2, default=str)
