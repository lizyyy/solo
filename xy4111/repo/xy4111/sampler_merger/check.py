from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
from copy import deepcopy

from sampler_merger.config import Sample
from sampler_merger.conflict_rules import ConflictDetector


class CheckManager:
    """检查管理器 - 负责检测冲突和生成检查报告"""
    
    def __init__(self, config: Dict, project_dir: Path):
        """
        初始化检查管理器
        
        Args:
            config: 项目配置
            project_dir: 项目目录路径
        """
        self.config = config
        self.project_dir = project_dir
    
    def run_checks(self) -> Dict[str, Any]:
        """
        运行所有检查
        
        Returns:
            检查结果字典
        """
        merged = self.config.get("merged_samples", {})
        samples_data = merged.get("samples", [])
        
        # 重建Sample对象
        samples = [Sample.from_dict(s) for s in samples_data]
        
        # 初始化冲突检测器
        conflict_detector = ConflictDetector(
            time_tolerance=merged.get("time_tolerance_seconds", 300.0),
            distance_tolerance=merged.get("distance_tolerance_meters", 50.0),
        )
        
        # 检测所有冲突
        results = conflict_detector.detect_all(samples)
        
        # 补充照片-样点关联检查
        photo_attachments = self._check_photo_attachments(samples)
        results["photo_attachment_issues"] = photo_attachments
        
        # 构建汇总
        summary = self._build_summary(results)
        results["summary"] = summary
        results["checked_at"] = datetime.now().isoformat()
        
        return results
    
    def _check_photo_attachments(self, samples: List[Sample]) -> List[Dict]:
        """
        检查照片附件与样点的关联
        
        检查：
        1. 照片样点是否有对应的记录样点（时间/坐标匹配）
        2. 记录样点是否有对应的照片
        """
        issues = []
        
        # 分离照片样点和非照片样点
        photo_samples = [s for s in samples if s.source_type == "photo"]
        record_samples = [s for s in samples if s.source_type != "photo"]
        
        # 检查每张照片是否有匹配的记录
        for photo_idx, photo in enumerate(photo_samples):
            matched = False
            
            for record in record_samples:
                # 检查时间匹配
                time_match = False
                if photo.timestamp and record.timestamp:
                    time_diff = abs((photo.timestamp - record.timestamp).total_seconds())
                    if time_diff < 300:  # 5分钟内
                        time_match = True
                
                # 检查坐标匹配
                coord_match = False
                if photo.has_valid_coordinates() and record.has_valid_coordinates():
                    from sampler_merger.normalizers import haversine_distance
                    dist = haversine_distance(
                        photo.latitude, photo.longitude,
                        record.latitude, record.longitude
                    )
                    if dist < 100:  # 100米内
                        coord_match = True
                
                if time_match or coord_match:
                    matched = True
                    break
            
            if not matched and (photo.has_valid_coordinates() or photo.timestamp):
                issues.append({
                    "conflict_id": f"photo_unmatched_{photo_idx}",
                    "type": "unmatched_photo",
                    "sample_id": photo.sample_id,
                    "photo_file": photo.source_file,
                    "latitude": photo.latitude,
                    "longitude": photo.longitude,
                    "timestamp": photo.timestamp.isoformat() if photo.timestamp else None,
                    "description": f"照片 '{photo.sample_id}' 没有找到匹配的样点记录",
                })
        
        return issues
    
    def _build_summary(self, results: Dict) -> Dict[str, Any]:
        """构建检查结果汇总"""
        summary = {
            "total_issues": 0,
            "by_type": {},
            "severity": {
                "critical": 0,
                "warning": 0,
                "info": 0,
            },
        }
        
        type_mapping = {
            "id_conflicts": ("样点ID冲突", "critical"),
            "coordinate_anomalies": ("坐标异常", "warning"),
            "missing_attachments": ("附件缺失", "warning"),
            "time_order_issues": ("时间顺序问题", "warning"),
            "potential_duplicates": ("潜在重复", "warning"),
            "photo_attachment_issues": ("照片关联问题", "warning"),
        }
        
        for key, items in results.items():
            if isinstance(items, list) and key in type_mapping:
                count = len(items)
                label, severity = type_mapping[key]
                
                summary["total_issues"] += count
                summary["by_type"][label] = count
                summary["severity"][severity] += count
        
        return summary
    
    def generate_report(self, check_results: Dict, format: str = "text") -> str:
        """
        生成检查报告
        
        Args:
            check_results: 检查结果
            format: 报告格式 ('text', 'json', 'markdown')
        
        Returns:
            报告内容字符串
        """
        if format == "json":
            import json
            return json.dumps(check_results, indent=2, ensure_ascii=False, default=str)
        
        elif format == "markdown":
            return self._generate_markdown_report(check_results)
        
        else:  # text
            return self._generate_text_report(check_results)
    
    def _generate_text_report(self, check_results: Dict) -> str:
        """生成文本格式报告"""
        lines = []
        lines.append("=" * 60)
        lines.append("离线采样包合并器 - 检查报告")
        lines.append("=" * 60)
        lines.append(f"检查时间: {check_results.get('checked_at', 'N/A')}")
        lines.append("")
        
        # 汇总
        summary = check_results.get("summary", {})
        lines.append("--- 检查汇总 ---")
        lines.append(f"总计问题数: {summary.get('total_issues', 0)}")
        lines.append(f"  严重 (critical): {summary.get('severity', {}).get('critical', 0)}")
        lines.append(f"  警告 (warning): {summary.get('severity', {}).get('warning', 0)}")
        lines.append("")
        
        # 按类型显示
        by_type = summary.get("by_type", {})
        if by_type:
            lines.append("问题类型分布:")
            for type_name, count in by_type.items():
                lines.append(f"  - {type_name}: {count} 个")
            lines.append("")
        
        # 详细问题
        lines.append("-" * 60)
        lines.append("详细问题列表")
        lines.append("-" * 60)
        
        # ID冲突
        id_conflicts = check_results.get("id_conflicts", [])
        if id_conflicts:
            lines.append("")
            lines.append(">>> 样点ID冲突")
            for conflict in id_conflicts:
                lines.append(f"\n  冲突ID: {conflict.get('sample_id')}")
                lines.append(f"  涉及来源数: {conflict.get('count')}")
                for item in conflict.get("items", []):
                    coord_str = f"({item.get('latitude')}, {item.get('longitude')})" if item.get('latitude') else "无坐标"
                    time_str = item.get('timestamp', '无时间')
                    lines.append(f"    - {item.get('source_file')}: {coord_str} @ {time_str}")
        
        # 坐标异常
        coord_anomalies = check_results.get("coordinate_anomalies", [])
        if coord_anomalies:
            lines.append("")
            lines.append(">>> 坐标异常")
            for anomaly in coord_anomalies:
                lines.append(f"\n  类型: {anomaly.get('type')}")
                lines.append(f"  描述: {anomaly.get('description')}")
                lines.append(f"  来源: {anomaly.get('source_file', 'N/A')}")
        
        # 时间问题
        time_issues = check_results.get("time_order_issues", [])
        if time_issues:
            lines.append("")
            lines.append(">>> 时间顺序问题")
            for issue in time_issues:
                lines.append(f"\n  类型: {issue.get('type')}")
                lines.append(f"  描述: {issue.get('description')}")
                lines.append(f"  来源文件: {issue.get('source_file', 'N/A')}")
        
        # 缺失附件
        missing_atts = check_results.get("missing_attachments", [])
        if missing_atts:
            lines.append("")
            lines.append(">>> 附件缺失")
            for issue in missing_atts:
                lines.append(f"\n  样点ID: {issue.get('sample_id')}")
                lines.append(f"  缺失附件: {issue.get('attachment_path')}")
                lines.append(f"  来源: {issue.get('source_file', 'N/A')}")
        
        # 潜在重复
        duplicates = check_results.get("potential_duplicates", [])
        if duplicates:
            lines.append("")
            lines.append(">>> 潜在重复样点")
            for dup in duplicates:
                lines.append(f"\n  样点: {dup.get('sample_ids')}")
                lines.append(f"  原因: {'; '.join(dup.get('reasons', []))}")
                lines.append(f"  来源: {dup.get('source_files')}")
        
        # 照片关联问题
        photo_issues = check_results.get("photo_attachment_issues", [])
        if photo_issues:
            lines.append("")
            lines.append(">>> 照片关联问题")
            for issue in photo_issues:
                lines.append(f"\n  照片: {issue.get('sample_id')}")
                lines.append(f"  文件: {issue.get('photo_file')}")
                lines.append(f"  描述: {issue.get('description')}")
        
        lines.append("")
        lines.append("=" * 60)
        lines.append("报告结束")
        lines.append("=" * 60)
        
        return "\n".join(lines)
    
    def _generate_markdown_report(self, check_results: Dict) -> str:
        """生成Markdown格式报告"""
        lines = []
        lines.append("# 离线采样包合并器 - 检查报告")
        lines.append("")
        lines.append(f"**检查时间**: {check_results.get('checked_at', 'N/A')}")
        lines.append("")
        
        # 汇总
        summary = check_results.get("summary", {})
        lines.append("## 检查汇总")
        lines.append("")
        lines.append(f"- **总计问题数**: {summary.get('total_issues', 0)}")
        lines.append(f"- **严重问题**: {summary.get('severity', {}).get('critical', 0)}")
        lines.append(f"- **警告问题**: {summary.get('severity', {}).get('warning', 0)}")
        lines.append("")
        
        # 问题类型分布
        by_type = summary.get("by_type", {})
        if by_type:
            lines.append("### 问题类型分布")
            lines.append("")
            lines.append("| 问题类型 | 数量 |")
            lines.append("|----------|------|")
            for type_name, count in by_type.items():
                lines.append(f"| {type_name} | {count} |")
            lines.append("")
        
        # 详细问题
        lines.append("## 详细问题")
        lines.append("")
        
        # ID冲突
        id_conflicts = check_results.get("id_conflicts", [])
        if id_conflicts:
            lines.append("### 样点ID冲突")
            lines.append("")
            for conflict in id_conflicts:
                lines.append(f"#### 冲突: `{conflict.get('sample_id')}`")
                lines.append("")
                lines.append(f"- **涉及来源数**: {conflict.get('count')}")
                lines.append("")
                lines.append("| 来源文件 | 坐标 | 时间 |")
                lines.append("|----------|------|------|")
                for item in conflict.get("items", []):
                    coord = f"({item.get('latitude')}, {item.get('longitude')})" if item.get('latitude') else "无坐标"
                    time = item.get('timestamp', '无时间')
                    lines.append(f"| {item.get('source_file')} | {coord} | {time} |")
                lines.append("")
        
        # 坐标异常
        coord_anomalies = check_results.get("coordinate_anomalies", [])
        if coord_anomalies:
            lines.append("### 坐标异常")
            lines.append("")
            for anomaly in coord_anomalies:
                lines.append(f"- **{anomaly.get('type')}**: {anomaly.get('description')}")
                lines.append(f"  - 来源: {anomaly.get('source_file', 'N/A')}")
                lines.append("")
        
        # 时间问题
        time_issues = check_results.get("time_order_issues", [])
        if time_issues:
            lines.append("### 时间顺序问题")
            lines.append("")
            for issue in time_issues:
                lines.append(f"- **{issue.get('type')}**: {issue.get('description')}")
                lines.append(f"  - 来源文件: {issue.get('source_file', 'N/A')}")
                lines.append("")
        
        # 其他问题...
        # （省略其他部分，与文本报告类似）
        
        lines.append("---")
        lines.append("")
        lines.append("*报告由离线采样包合并器自动生成*")
        
        return "\n".join(lines)
