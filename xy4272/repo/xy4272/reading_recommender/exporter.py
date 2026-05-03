"""
导出模块：支持导出 Markdown/CSV/JSON 格式的报告
"""
import json
import csv
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

from .profile_recommender import Recommendation, ChildProfile
from .rules_engine import CheckResult, RiskLevel


class Exporter:
    """导出器"""
    
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def export_markdown(
        self,
        recommendations: Dict[str, List[Recommendation]],
        check_results: Optional[Dict[str, List[Tuple[Recommendation, CheckResult]]]] = None,
        profiles: Optional[Dict[str, ChildProfile]] = None,
        filename: str = None
    ) -> Path:
        """
        导出 Markdown 格式报告
        
        Args:
            recommendations: 推荐结果字典
            check_results: 检查结果字典（可选）
            profiles: 孩子画像字典（可选）
            filename: 输出文件名（可选）
            
        Returns:
            输出文件路径
        """
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"reading_recommendations_{timestamp}.md"
        
        filepath = self.output_dir / filename
        
        lines = []
        lines.append("# 阅读包推荐报告")
        lines.append("")
        lines.append(f"生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"推荐孩子数：{len(recommendations)}")
        lines.append("")
        
        for child_id, recs in recommendations.items():
            profile = profiles.get(child_id) if profiles else None
            
            lines.append(f"## 孩子：{child_id}")
            lines.append("")
            
            if profile:
                lines.append(f"- **姓名**：{profile.name or '未知'}")
                lines.append(f"- **年龄**：{profile.age or '未知'} 岁")
                lines.append(f"- **年龄段**：{profile.age_group or '未知'}")
                lines.append(f"- **借阅记录数**：{profile.borrow_count}")
                lines.append(f"- **活动参与数**：{profile.activity_count}")
                lines.append(f"- **冷启动状态**：{'是' if profile.is_cold_start else '否'}")
                
                if profile.top_interests:
                    interests = ", ".join([f"{t}({s:.2f})" for t, s in profile.top_interests[:5]])
                    lines.append(f"- **主要兴趣**：{interests}")
                
                lines.append("")
            
            lines.append("### 推荐图书")
            lines.append("")
            lines.append("| 排名 | 书名 | 作者 | 分类 | 年龄段 | 推荐分数 |")
            lines.append("|------|------|------|------|--------|----------|")
            
            for rec in recs:
                lines.append(f"| {rec.rank} | {rec.title} | {rec.author} | {rec.category} | {rec.age_group} | {rec.score:.3f} |")
            
            lines.append("")
            lines.append("### 推荐理由")
            lines.append("")
            
            for rec in recs:
                lines.append(f"**{rec.rank}. {rec.title}**")
                lines.append("")
                
                if rec.reasons:
                    for reason in rec.reasons:
                        lines.append(f"- {reason}")
                else:
                    lines.append("- 无特殊理由")
                
                lines.append("")
            
            if check_results and child_id in check_results:
                child_checks = check_results[child_id]
                lines.append("### 质量检查结果")
                lines.append("")
                
                for rec, check in child_checks:
                    status = "✅ 通过" if check.is_eligible else "❌ 有问题"
                    lines.append(f"**{rec.title}**: {status}")
                    lines.append("")
                    
                    if check.issues:
                        lines.append("**问题**：")
                        for issue in check.issues:
                            lines.append(f"- ⚠️ {issue}")
                        lines.append("")
                    
                    if check.warnings:
                        lines.append("**警告**：")
                        for warning in check.warnings:
                            lines.append(f"- ℹ️ {warning}")
                        lines.append("")
                    
                    lines.append("")
            
            lines.append("---")
            lines.append("")
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        
        return filepath
    
    def export_csv(
        self,
        recommendations: Dict[str, List[Recommendation]],
        check_results: Optional[Dict[str, List[Tuple[Recommendation, CheckResult]]]] = None,
        profiles: Optional[Dict[str, ChildProfile]] = None,
        filename: str = None
    ) -> Path:
        """
        导出 CSV 格式报告
        
        Args:
            recommendations: 推荐结果字典
            check_results: 检查结果字典（可选）
            profiles: 孩子画像字典（可选）
            filename: 输出文件名（可选）
            
        Returns:
            输出文件路径
        """
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"reading_recommendations_{timestamp}.csv"
        
        filepath = self.output_dir / filename
        
        rows = []
        headers = [
            "child_id", "child_name", "age", "age_group",
            "rank", "book_id", "title", "author", "category", "book_age_group",
            "score", "reasons", "themes",
            "is_eligible", "risk_level", "issues", "warnings"
        ]
        
        for child_id, recs in recommendations.items():
            profile = profiles.get(child_id) if profiles else None
            child_checks = check_results.get(child_id, []) if check_results else []
            
            check_map = {}
            for rec, check in child_checks:
                check_map[rec.book_id] = check
            
            for rec in recs:
                check = check_map.get(rec.book_id)
                
                row = {
                    "child_id": child_id,
                    "child_name": profile.name if profile else "",
                    "age": profile.age if profile else "",
                    "age_group": profile.age_group if profile else "",
                    "rank": rec.rank,
                    "book_id": rec.book_id,
                    "title": rec.title,
                    "author": rec.author,
                    "category": rec.category,
                    "book_age_group": rec.age_group,
                    "score": rec.score,
                    "reasons": "; ".join(rec.reasons) if rec.reasons else "",
                    "themes": ", ".join(rec.themes) if rec.themes else "",
                    "is_eligible": check.is_eligible if check else True,
                    "risk_level": check.risk_level.value if check else RiskLevel.LOW.value,
                    "issues": "; ".join(check.issues) if check and check.issues else "",
                    "warnings": "; ".join(check.warnings) if check and check.warnings else "",
                }
                rows.append(row)
        
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(rows)
        
        return filepath
    
    def export_json(
        self,
        recommendations: Dict[str, List[Recommendation]],
        check_results: Optional[Dict[str, List[Tuple[Recommendation, CheckResult]]]] = None,
        profiles: Optional[Dict[str, ChildProfile]] = None,
        filename: str = None
    ) -> Path:
        """
        导出 JSON 格式报告
        
        Args:
            recommendations: 推荐结果字典
            check_results: 检查结果字典（可选）
            profiles: 孩子画像字典（可选）
            filename: 输出文件名（可选）
            
        Returns:
            输出文件路径
        """
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"reading_recommendations_{timestamp}.json"
        
        filepath = self.output_dir / filename
        
        output = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "total_children": len(recommendations),
            },
            "children": []
        }
        
        for child_id, recs in recommendations.items():
            profile = profiles.get(child_id) if profiles else None
            child_checks = check_results.get(child_id, []) if check_results else []
            
            check_map = {}
            for rec, check in child_checks:
                check_map[rec.book_id] = check
            
            child_data = {
                "child_id": child_id,
                "profile": None,
                "recommendations": [],
                "check_summary": None
            }
            
            if profile:
                child_data["profile"] = {
                    "name": profile.name,
                    "age": profile.age,
                    "age_group": profile.age_group,
                    "borrow_count": profile.borrow_count,
                    "activity_count": profile.activity_count,
                    "feedback_count": profile.feedback_count,
                    "is_cold_start": profile.is_cold_start,
                    "top_interests": [{"theme": t, "score": round(s, 3)} for t, s in profile.top_interests]
                }
            
            for rec in recs:
                rec_data = {
                    "rank": rec.rank,
                    "book_id": rec.book_id,
                    "title": rec.title,
                    "author": rec.author,
                    "category": rec.category,
                    "age_group": rec.age_group,
                    "themes": rec.themes,
                    "score": rec.score,
                    "reasons": rec.reasons
                }
                
                check = check_map.get(rec.book_id)
                if check:
                    rec_data["check_result"] = {
                        "is_eligible": check.is_eligible,
                        "risk_level": check.risk_level.value,
                        "issues": check.issues,
                        "warnings": check.warnings
                    }
                
                child_data["recommendations"].append(rec_data)
            
            if check_results and child_id in check_results:
                child_checks = check_results[child_id]
                eligible_count = sum(1 for _, c in child_checks if c.is_eligible)
                high_risk_count = sum(1 for _, c in child_checks if c.risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL])
                
                child_data["check_summary"] = {
                    "total": len(child_checks),
                    "eligible": eligible_count,
                    "high_risk": high_risk_count
                }
            
            output["children"].append(child_data)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        
        return filepath
    
    def export_all_formats(
        self,
        recommendations: Dict[str, List[Recommendation]],
        check_results: Optional[Dict[str, List[Tuple[Recommendation, CheckResult]]]] = None,
        profiles: Optional[Dict[str, ChildProfile]] = None,
        base_filename: str = None
    ) -> Dict[str, Path]:
        """
        导出所有格式的报告
        
        Args:
            recommendations: 推荐结果字典
            check_results: 检查结果字典（可选）
            profiles: 孩子画像字典（可选）
            base_filename: 基础文件名（可选）
            
        Returns:
            字典，key 为格式名，value 为文件路径
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        if base_filename:
            base = f"{base_filename}_{timestamp}"
        else:
            base = f"reading_recommendations_{timestamp}"
        
        files = {}
        
        files["markdown"] = self.export_markdown(
            recommendations, check_results, profiles, f"{base}.md"
        )
        files["csv"] = self.export_csv(
            recommendations, check_results, profiles, f"{base}.csv"
        )
        files["json"] = self.export_json(
            recommendations, check_results, profiles, f"{base}.json"
        )
        
        return files
