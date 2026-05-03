"""
导出模块
负责生成巡检数据处理报告：
- Markdown格式报告（便于阅读和分享）
- CSV格式报告（便于进一步分析）
"""

from typing import Dict, List, Any, Optional, Union
from pathlib import Path
from datetime import datetime
import csv
import json

from .parser import InspectionPackage
from .validator import ValidationResult, ValidationIssue, ValidationSeverity
from .merger import MergeResult, MergedDefect
from .scorer import ScoringResult, RiskScore, RiskLevel


class ReportExporter:
    """
    报告导出器
    负责生成各种格式的处理报告
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        
        # 风险等级颜色和图标映射
        self.risk_styles = {
            "critical": {"icon": "🔴", "color": "red", "label": "紧急"},
            "high": {"icon": "🟠", "color": "orange", "label": "高风险"},
            "medium": {"icon": "🟡", "color": "yellow", "label": "中等风险"},
            "low": {"icon": "🟢", "color": "green", "label": "低风险"},
            "info": {"icon": "🔵", "color": "blue", "label": "信息"},
        }
        
        # 严重程度样式
        self.severity_styles = {
            "critical": {"icon": "⛔", "label": "严重错误"},
            "warning": {"icon": "⚠️", "label": "警告"},
            "info": {"icon": "ℹ️", "label": "信息"},
        }
    
    def export_full_report(
        self,
        output_path: Union[str, Path],
        packages: List[InspectionPackage],
        validation_results: Dict[str, ValidationResult],
        merge_result: MergeResult,
        scoring_result: ScoringResult,
        formats: List[str] = None
    ) -> Dict[str, str]:
        """
        导出完整报告
        支持多种格式：markdown, csv, json
        """
        output_path = Path(output_path)
        formats = formats or ["markdown", "csv"]
        
        # 准备报告数据
        report_data = self._prepare_report_data(
            packages, validation_results, merge_result, scoring_result
        )
        
        exported_files = {}
        
        for fmt in formats:
            if fmt == "markdown":
                md_path = output_path.with_suffix(".md")
                self._export_markdown(md_path, report_data)
                exported_files["markdown"] = str(md_path)
            
            elif fmt == "csv":
                csv_path = output_path.with_suffix(".csv")
                self._export_csv(csv_path, report_data)
                exported_files["csv"] = str(csv_path)
            
            elif fmt == "json":
                json_path = output_path.with_suffix(".json")
                self._export_json(json_path, report_data)
                exported_files["json"] = str(json_path)
        
        return exported_files
    
    def _prepare_report_data(
        self,
        packages: List[InspectionPackage],
        validation_results: Dict[str, ValidationResult],
        merge_result: MergeResult,
        scoring_result: ScoringResult
    ) -> Dict[str, Any]:
        """
        准备报告数据
        """
        # 汇总统计
        valid_packages = [p for p in packages if not validation_results.get(p.package_name, ValidationResult("")).is_critical]
        invalid_packages = [p for p in packages if validation_results.get(p.package_name, ValidationResult("")).is_critical]
        
        # 按风险等级分组缺陷
        defects_by_risk = {
            "critical": [],
            "high": [],
            "medium": [],
            "low": [],
            "info": [],
        }
        
        for defect in scoring_result.scored_defects:
            risk_level = defect.risk_level.value
            if risk_level in defects_by_risk:
                defects_by_risk[risk_level].append(defect)
        
        # 校验问题汇总
        all_issues = []
        for pkg_name, val_result in validation_results.items():
            for issue in val_result.issues:
                all_issues.append({
                    "package_name": pkg_name,
                    "issue": issue
                })
        
        return {
            "generated_at": datetime.now().isoformat(),
            "packages": {
                "total": len(packages),
                "valid": len(valid_packages),
                "invalid": len(invalid_packages),
                "list": [p.to_dict() for p in packages]
            },
            "validation": {
                "results": {k: v.to_dict() for k, v in validation_results.items()},
                "all_issues": all_issues
            },
            "merge": merge_result.to_dict(),
            "scoring": scoring_result.to_dict(),
            "defects_by_risk": defects_by_risk,
            "defects_sorted": sorted(
                scoring_result.scored_defects,
                key=lambda d: d.total_score,
                reverse=True
            )
        }
    
    def _export_markdown(self, filepath: Path, data: Dict[str, Any]):
        """
        导出Markdown格式报告
        """
        lines = []
        
        # 标题
        lines.append("# 巡检数据处理报告")
        lines.append("")
        lines.append(f"**生成时间**: {data['generated_at']}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        # 摘要
        lines.append("## 执行摘要")
        lines.append("")
        
        # 包统计
        pkg_data = data["packages"]
        lines.append("### 巡检包统计")
        lines.append("")
        lines.append(f"- **总巡检包数**: {pkg_data['total']}")
        lines.append(f"- **有效包**: {pkg_data['valid']}")
        lines.append(f"- **无效包（严重错误）**: {pkg_data['invalid']}")
        lines.append("")
        
        # 缺陷统计
        merge_data = data["merge"]
        scoring_data = data["scoring"]
        lines.append("### 缺陷统计")
        lines.append("")
        lines.append(f"- **原始缺陷数**: {merge_data['total_defects_before']}")
        lines.append(f"- **去重后缺陷数**: {merge_data['total_defects_after']}")
        lines.append(f"- **去重率**: {merge_data['reduction_rate']:.1f}%")
        lines.append("")
        
        # 风险等级分布
        lines.append("### 风险等级分布")
        lines.append("")
        
        for level, style in self.risk_styles.items():
            count = scoring_data["by_risk_level"].get(level, 0)
            icon = style["icon"]
            label = style["label"]
            lines.append(f"- {icon} **{label}**: {count} 个")
        
        lines.append("")
        lines.append("---")
        lines.append("")
        
        # 校验结果
        lines.append("## 数据校验结果")
        lines.append("")
        
        validation_data = data["validation"]
        all_issues = validation_data["all_issues"]
        
        if all_issues:
            # 按严重程度分组
            critical_issues = [i for i in all_issues if i["issue"].severity == ValidationSeverity.CRITICAL]
            warning_issues = [i for i in all_issues if i["issue"].severity == ValidationSeverity.WARNING]
            info_issues = [i for i in all_issues if i["issue"].severity == ValidationSeverity.INFO]
            
            lines.append("### 问题汇总")
            lines.append("")
            lines.append(f"- ⛔ **严重错误**: {len(critical_issues)} 个")
            lines.append(f"- ⚠️ **警告**: {len(warning_issues)} 个")
            lines.append(f"- ℹ️ **信息**: {len(info_issues)} 个")
            lines.append("")
            
            # 详细问题列表
            lines.append("### 详细问题列表")
            lines.append("")
            
            for issue_data in all_issues:
                pkg_name = issue_data["package_name"]
                issue = issue_data["issue"]
                style = self.severity_styles.get(issue.severity.value, self.severity_styles["info"])
                
                lines.append(f"#### {style['icon']} {style['label']} - {pkg_name}")
                lines.append("")
                lines.append(f"**位置**: {issue.location}")
                lines.append(f"**消息**: {issue.message}")
                
                if issue.mileage is not None:
                    lines.append(f"**里程桩号**: {issue.mileage:.2f}m")
                
                if issue.timestamp is not None:
                    try:
                        ts_str = datetime.fromtimestamp(issue.timestamp).strftime("%Y-%m-%d %H:%M:%S")
                        lines.append(f"**时间戳**: {ts_str}")
                    except (ValueError, OSError):
                        lines.append(f"**时间戳**: {issue.timestamp}")
                
                lines.append("")
        
        else:
            lines.append("✅ 所有巡检包数据校验通过，未发现问题。")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        
        # 缺陷详情 - 按风险等级
        lines.append("## 缺陷详情（按风险等级排序）")
        lines.append("")
        
        defects_by_risk = data["defects_by_risk"]
        
        for level, style in self.risk_styles.items():
            defects = defects_by_risk.get(level, [])
            if not defects:
                continue
            
            icon = style["icon"]
            label = style["label"]
            lines.append(f"### {icon} {label} 缺陷 ({len(defects)} 个)")
            lines.append("")
            
            # 按分数降序排序
            sorted_defects = sorted(defects, key=lambda d: d.total_score, reverse=True)
            
            for idx, defect in enumerate(sorted_defects, 1):
                lines.append(f"#### {idx}. {defect.merged_id}")
                lines.append("")
                
                # 基本信息
                lines.append(f"- **缺陷类型**: {defect.defect_type}")
                lines.append(f"- **风险分数**: {defect.total_score}/100")
                lines.append(f"- **主里程桩号**: {defect.primary_mileage:.2f}m")
                lines.append(f"- **涉及巡检包**: {defect.unique_packages} 个")
                lines.append(f"- **证据来源数**: {defect.source_count} 个")
                
                if defect.description:
                    lines.append(f"- **描述**: {defect.description}")
                
                lines.append("")
                
                # 分数明细
                if defect.score_breakdown:
                    lines.append("**评分明细**:")
                    lines.append("")
                    lines.append("| 评分项 | 分数 | 权重 |")
                    lines.append("|--------|------|------|")
                    
                    # 反向映射权重
                    weight_labels = {
                        "severity": "严重程度",
                        "defect_type": "缺陷类型",
                        "evidence_count": "证据数量",
                        "time_freshness": "时间新鲜度"
                    }
                    
                    for key, value in defect.score_breakdown.items():
                        label = weight_labels.get(key, key)
                        # 计算原始分数（假设权重已知）
                        weights = {"severity": 0.4, "defect_type": 0.3, "evidence_count": 0.2, "time_freshness": 0.1}
                        weight = weights.get(key, 1.0)
                        raw_score = value / weight if weight > 0 else 0
                        lines.append(f"| {label} | {raw_score:.0f}/100 | {weight*100:.0f}% |")
                    
                    lines.append("")
                
                # 证据来源
                if defect.evidence_sources:
                    lines.append("**证据来源**:")
                    lines.append("")
                    lines.append("| 巡检包 | 类型 | 里程 | 时间 |")
                    lines.append("|--------|------|------|------|")
                    
                    for source in defect.evidence_sources:
                        mileage_str = f"{source.mileage:.2f}m" if source.mileage else "N/A"
                        time_str = "N/A"
                        if source.timestamp:
                            try:
                                time_str = datetime.fromtimestamp(source.timestamp).strftime("%Y-%m-%d %H:%M")
                            except (ValueError, OSError):
                                time_str = str(source.timestamp)
                        
                        source_type_label = {
                            "robot": "机器人",
                            "human": "人工",
                            "auto": "自动"
                        }.get(source.source_type, source.source_type)
                        
                        lines.append(f"| {source.package_name} | {source_type_label} | {mileage_str} | {time_str} |")
                    
                    lines.append("")
                
                lines.append("---")
                lines.append("")
        
        # 附录
        lines.append("## 附录")
        lines.append("")
        
        lines.append("### 术语说明")
        lines.append("")
        lines.append("- **里程桩号**: 管廊内的距离标记，用于定位缺陷位置")
        lines.append("- **巡检包**: 单台机器人一次巡检产生的所有数据文件")
        lines.append("- **去重率**: 合并重复缺陷后减少的比例")
        lines.append("")
        
        lines.append("### 风险等级说明")
        lines.append("")
        lines.append("| 等级 | 图标 | 分数范围 | 处理建议 |")
        lines.append("|------|------|----------|----------|")
        lines.append("| 紧急 | 🔴 | >= 85 | 需要立即处理 |")
        lines.append("| 高风险 | 🟠 | 70-84 | 近期需要处理 |")
        lines.append("| 中等风险 | 🟡 | 40-69 | 计划内处理 |")
        lines.append("| 低风险 | 🟢 | 20-39 | 监控观察 |")
        lines.append("| 信息 | 🔵 | < 20 | 无需处理 |")
        lines.append("")
        
        # 写入文件
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
    
    def _export_csv(self, filepath: Path, data: Dict[str, Any]):
        """
        导出CSV格式报告
        """
        defects_sorted = data["defects_sorted"]
        
        # 准备CSV行
        rows = []
        
        # 表头
        header = [
            "缺陷ID",
            "风险等级",
            "风险分数",
            "缺陷类型",
            "主里程桩号",
            "里程范围-最小",
            "里程范围-最大",
            "涉及巡检包数",
            "证据来源数",
            "描述",
            "首次发现时间",
            "最近发现时间",
            "严重程度评分",
            "缺陷类型评分",
            "证据数量评分",
            "时间新鲜度评分",
            "证据来源详情"
        ]
        rows.append(header)
        
        # 数据行
        for defect in defects_sorted:
            # 格式化时间
            first_seen_str = ""
            if defect.first_seen:
                try:
                    first_seen_str = datetime.fromtimestamp(defect.first_seen).strftime("%Y-%m-%d %H:%M:%S")
                except (ValueError, OSError):
                    first_seen_str = str(defect.first_seen)
            
            last_seen_str = ""
            if defect.last_seen:
                try:
                    last_seen_str = datetime.fromtimestamp(defect.last_seen).strftime("%Y-%m-%d %H:%M:%S")
                except (ValueError, OSError):
                    last_seen_str = str(defect.last_seen)
            
            # 评分明细
            score_breakdown = defect.score_breakdown or {}
            weights = {"severity": 0.4, "defect_type": 0.3, "evidence_count": 0.2, "time_freshness": 0.1}
            
            def get_raw_score(key):
                weighted = score_breakdown.get(key, 0)
                weight = weights.get(key, 1.0)
                return weighted / weight if weight > 0 else 0
            
            # 证据来源详情
            source_details = []
            for source in defect.evidence_sources[:3]:  # 最多显示3个
                src_str = f"{source.package_name}"
                if source.mileage:
                    src_str += f"({source.mileage:.0f}m)"
                source_details.append(src_str)
            
            if len(defect.evidence_sources) > 3:
                source_details.append(f"...等{len(defect.evidence_sources)}个")
            
            source_detail_str = "; ".join(source_details)
            
            row = [
                defect.merged_id,
                self.risk_styles.get(defect.risk_level.value, {}).get("label", defect.risk_level.value),
                defect.total_score,
                defect.defect_type,
                f"{defect.primary_mileage:.2f}",
                f"{getattr(defect, 'min_mileage', defect.primary_mileage):.2f}",
                f"{getattr(defect, 'max_mileage', defect.primary_mileage):.2f}",
                defect.unique_packages,
                defect.source_count,
                defect.description or "",
                first_seen_str,
                last_seen_str,
                f"{get_raw_score('severity'):.0f}",
                f"{get_raw_score('defect_type'):.0f}",
                f"{get_raw_score('evidence_count'):.0f}",
                f"{get_raw_score('time_freshness'):.0f}",
                source_detail_str
            ]
            rows.append(row)
        
        # 写入CSV文件
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerows(rows)
    
    def _export_json(self, filepath: Path, data: Dict[str, Any]):
        """
        导出JSON格式报告
        """
        # 转换为可序列化的格式
        serializable_data = self._make_serializable(data)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(serializable_data, f, ensure_ascii=False, indent=2, default=str)
    
    def _make_serializable(self, obj: Any) -> Any:
        """
        转换对象为JSON可序列化格式
        """
        if hasattr(obj, 'to_dict'):
            return self._make_serializable(obj.to_dict())
        elif isinstance(obj, dict):
            return {k: self._make_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._make_serializable(item) for item in obj]
        elif isinstance(obj, (int, float, str, bool, type(None))):
            return obj
        else:
            return str(obj)
    
    def export_validation_report(
        self,
        output_path: Union[str, Path],
        validation_results: Dict[str, ValidationResult],
        format: str = "markdown"
    ) -> str:
        """
        仅导出校验报告
        """
        output_path = Path(output_path)
        
        if format == "markdown":
            lines = []
            lines.append("# 数据校验报告")
            lines.append("")
            lines.append(f"**生成时间**: {datetime.now().isoformat()}")
            lines.append("")
            lines.append("---")
            lines.append("")
            
            # 统计
            total = len(validation_results)
            valid = sum(1 for r in validation_results.values() if not r.is_critical)
            invalid = total - valid
            
            lines.append("## 校验摘要")
            lines.append("")
            lines.append(f"- **总包数**: {total}")
            lines.append(f"- **有效包**: {valid}")
            lines.append(f"- **无效包（严重错误）**: {invalid}")
            lines.append("")
            
            # 每个包的详细情况
            lines.append("## 各包详情")
            lines.append("")
            
            for pkg_name, result in validation_results.items():
                status_icon = "✅" if not result.is_critical else "❌"
                status_text = "校验通过" if not result.is_critical else "存在严重错误"
                
                lines.append(f"### {status_icon} {pkg_name} - {status_text}")
                lines.append("")
                
                if result.issues:
                    lines.append("**发现的问题**:")
                    lines.append("")
                    
                    for issue in result.issues:
                        style = self.severity_styles.get(issue.severity.value, self.severity_styles["info"])
                        lines.append(f"- {style['icon']} **{style['label']}** [{issue.location}]: {issue.message}")
                    
                    lines.append("")
                else:
                    lines.append("未发现任何问题。")
                    lines.append("")
            
            md_path = output_path.with_suffix(".md")
            with open(md_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lines))
            
            return str(md_path)
        
        return str(output_path)
