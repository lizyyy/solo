"""导出模块 - 装订目录、Markdown风险报告、JSON审计包"""
import json
import os
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime


class Exporter:
    """导出器类"""
    
    def __init__(self, output_dir: str):
        """初始化导出器
        
        Args:
            output_dir: 输出目录
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def export(
        self,
        scan_data: Dict[str, Any],
        validation_data: Optional[Dict[str, Any]] = None,
        redaction_data: Optional[List[Dict[str, Any]]] = None,
        review_data: Optional[Dict[str, Any]] = None,
        formats: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """执行导出
        
        Args:
            scan_data: 扫描结果数据
            validation_data: 校验结果数据
            redaction_data: 脱敏审计数据
            review_data: 复核记录数据
            formats: 要导出的格式列表
        
        Returns:
            导出结果
        """
        result = {
            "timestamp": datetime.now().isoformat(),
            "exported_files": {},
            "errors": [],
        }
        
        if formats is None:
            formats = ["catalog", "report", "audit"]
        
        combined_data = {
            "scan": scan_data,
            "validation": validation_data,
            "redaction": redaction_data or [],
            "review": review_data,
        }
        
        if "catalog" in formats:
            try:
                catalog_path = self._export_catalog(combined_data)
                result["exported_files"]["catalog"] = str(catalog_path)
            except Exception as e:
                result["errors"].append(f"装订目录导出失败: {str(e)}")
        
        if "report" in formats:
            try:
                report_path = self._export_markdown_report(combined_data)
                result["exported_files"]["report"] = str(report_path)
            except Exception as e:
                result["errors"].append(f"风险报告导出失败: {str(e)}")
        
        if "audit" in formats:
            try:
                audit_path = self._export_audit_package(combined_data)
                result["exported_files"]["audit"] = str(audit_path)
            except Exception as e:
                result["errors"].append(f"审计包导出失败: {str(e)}")
        
        return result
    
    def _export_catalog(self, data: Dict[str, Any]) -> Path:
        """导出装订目录
        
        Args:
            data: 组合数据
        
        Returns:
            导出文件路径
        """
        scan_data = data.get("scan", {})
        files = scan_data.get("files", [])
        
        lines = []
        
        # 标题
        lines.append("# 卷宗装订目录")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # 统计信息
        total_files = scan_data.get("total_files", 0)
        total_size = scan_data.get("total_size_human", "0 B")
        
        lines.append("## 统计信息")
        lines.append(f"- 文件总数: {total_files}")
        lines.append(f"- 总大小: {total_size}")
        lines.append("")
        
        # 文件分类统计
        summary = scan_data.get("summary", {})
        by_type = summary.get("by_type", {})
        
        if by_type:
            lines.append("## 文件类型统计")
            for file_type, count in sorted(by_type.items()):
                type_name = self._get_type_name(file_type)
                lines.append(f"- {type_name}: {count} 个")
            lines.append("")
        
        # 文件列表
        lines.append("## 文件清单")
        lines.append("")
        lines.append("| 序号 | 文件名 | 类型 | 大小 | 修改时间 | 哈希(前16位) |")
        lines.append("|------|--------|------|------|----------|--------------|")
        
        for idx, file_info in enumerate(files, 1):
            name = file_info.get("name", "")
            file_type = file_info.get("file_type", "other")
            size = file_info.get("size_human", "")
            modified = file_info.get("modified_time", "")
            sha256 = file_info.get("hash_sha256", "")[:16] if file_info.get("hash_sha256") else ""
            
            lines.append(f"| {idx} | {name} | {self._get_type_name(file_type)} | {size} | {modified[:19] if modified else ''} | {sha256} |")
        
        lines.append("")
        
        # 备注
        lines.append("## 备注")
        lines.append("- 此目录由卷宗脱敏装订员自动生成")
        lines.append(f"- 扫描目录: {scan_data.get('base_directory', '')}")
        lines.append("- 请核对文件完整性后归档")
        
        content = "\n".join(lines)
        
        output_path = self.output_dir / "binding_catalog.md"
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)
        
        return output_path
    
    def _get_type_name(self, file_type: str) -> str:
        """获取文件类型的中文名称
        
        Args:
            file_type: 文件类型标识
        
        Returns:
            中文名称
        """
        type_names = {
            "pdf": "PDF文档",
            "image": "图片",
            "document": "文档",
            "csv": "CSV表格",
            "text": "文本",
            "other": "其他",
        }
        return type_names.get(file_type, file_type)
    
    def _export_markdown_report(self, data: Dict[str, Any]) -> Path:
        """导出Markdown风险报告
        
        Args:
            data: 组合数据
        
        Returns:
            导出文件路径
        """
        lines = []
        
        # 标题
        lines.append("# 卷宗风险评估报告")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # 执行摘要
        lines.append("## 执行摘要")
        
        validation = data.get("validation")
        redaction = data.get("redaction", [])
        review = data.get("review")
        
        total_issues = 0
        errors = 0
        warnings = 0
        
        if validation:
            summary = validation.get("summary", {})
            errors = summary.get("errors", 0)
            warnings = summary.get("warnings", 0)
            total_issues = errors + warnings
        
        total_redacted = sum(item.get("found_items", 0) for item in redaction)
        
        lines.append(f"- 发现问题总数: {total_issues}")
        lines.append(f"  - 严重错误: {errors}")
        lines.append(f"  - 警告: {warnings}")
        lines.append(f"- 脱敏处理项目: {len(redaction)} 个文件")
        lines.append(f"- 脱敏处理敏感信息: {total_redacted} 处")
        lines.append("")
        
        # 风险等级
        lines.append("### 风险等级评估")
        
        risk_level = "低"
        risk_color = "green"
        
        if errors > 0:
            risk_level = "高"
            risk_color = "red"
        elif warnings > 5:
            risk_level = "中"
            risk_color = "yellow"
        elif warnings > 0:
            risk_level = "低"
            risk_color = "green"
        
        lines.append(f"**当前风险等级: {risk_level}**")
        lines.append("")
        
        # 详细问题列表
        if validation and validation.get("issues"):
            lines.append("## 详细问题列表")
            lines.append("")
            
            issues = validation.get("issues", [])
            
            # 按严重程度分组
            error_issues = [i for i in issues if i.get("severity") == "error"]
            warning_issues = [i for i in issues if i.get("severity") == "warning"]
            info_issues = [i for i in issues if i.get("severity") == "info"]
            
            if error_issues:
                lines.append("### 🔴 严重错误")
                lines.append("")
                for idx, issue in enumerate(error_issues, 1):
                    lines.append(f"#### 问题 {idx}: {issue.get('message', '')}")
                    lines.append(f"- 类型: {issue.get('type', '')}")
                    
                    details = issue.get("details", {})
                    if details:
                        lines.append("  详细信息:")
                        for key, value in details.items():
                            lines.append(f"  - {key}: {value}")
                    lines.append("")
            
            if warning_issues:
                lines.append("### 🟡 警告")
                lines.append("")
                for idx, issue in enumerate(warning_issues, 1):
                    lines.append(f"#### 问题 {idx}: {issue.get('message', '')}")
                    lines.append(f"- 类型: {issue.get('type', '')}")
                    
                    details = issue.get("details", {})
                    if details:
                        lines.append("  详细信息:")
                        for key, value in details.items():
                            lines.append(f"  - {key}: {value}")
                    lines.append("")
            
            if info_issues:
                lines.append("### 🔵 信息")
                lines.append("")
                for idx, issue in enumerate(info_issues, 1):
                    lines.append(f"- {issue.get('message', '')}")
                lines.append("")
        
        # 脱敏记录
        if redaction:
            lines.append("## 脱敏处理记录")
            lines.append("")
            
            lines.append(f"共处理 {len(redaction)} 个文件，发现 {total_redacted} 处敏感信息")
            lines.append("")
            
            for item in redaction:
                source = item.get("source_file", "")
                found = item.get("found_items", 0)
                timestamp = item.get("timestamp", "")
                
                lines.append(f"### {Path(source).name}")
                lines.append(f"- 源文件: {source}")
                lines.append(f"- 发现敏感信息: {found} 处")
                lines.append(f"- 处理时间: {timestamp}")
                
                details = item.get("details", [])
                if details:
                    lines.append("- 发现的敏感信息类型:")
                    type_counts = {}
                    for d in details:
                        t = d.get("type", "unknown")
                        type_counts[t] = type_counts.get(t, 0) + 1
                    for t, c in type_counts.items():
                        lines.append(f"  - {t}: {c} 处")
                lines.append("")
        
        # 复核记录
        if review and isinstance(review, list) and len(review) > 0:
            lines.append("## 人工复核记录")
            lines.append("")
            
            lines.append(f"共有 {len(review)} 条复核记录")
            lines.append("")
            
            for idx, item in enumerate(review[:10], 1):  # 只显示最近10条
                item_id = item.get("item_id", "")
                status = item.get("status", "")
                reviewer = item.get("reviewer", "")
                timestamp = item.get("timestamp", "")
                notes = item.get("notes", "")
                
                status_icon = {"approved": "✅", "rejected": "❌", "pending": "⏳"}.get(status, "❓")
                
                lines.append(f"### {status_icon} 复核记录 {idx}")
                lines.append(f"- 项目ID: {item_id}")
                lines.append(f"- 状态: {status}")
                if reviewer:
                    lines.append(f"- 复核人: {reviewer}")
                lines.append(f"- 时间: {timestamp}")
                if notes:
                    lines.append(f"- 备注: {notes}")
                lines.append("")
        
        # 建议
        lines.append("## 建议")
        lines.append("")
        
        if errors > 0:
            lines.append("### 紧急处理建议")
            lines.append("- [ ] 首先解决所有严重错误")
            lines.append("- [ ] 检查缺失的页码和重复文件")
            lines.append("- [ ] 确认目录与实际文件一致")
            lines.append("")
        
        if warnings > 0:
            lines.append("### 常规检查建议")
            lines.append("- [ ] 评估所有警告项的影响")
            lines.append("- [ ] 检查可能缺失的签名页")
            lines.append("- [ ] 确认保留词不会被误脱敏")
            lines.append("")
        
        lines.append("### 归档建议")
        lines.append("- [ ] 导出并保存完整的审计包")
        lines.append("- [ ] 生成装订目录并打印归档")
        lines.append("- [ ] 备份原始文件到安全位置")
        lines.append("")
        
        content = "\n".join(lines)
        
        output_path = self.output_dir / "risk_report.md"
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)
        
        return output_path
    
    def _export_audit_package(self, data: Dict[str, Any]) -> Path:
        """导出JSON审计包
        
        Args:
            data: 组合数据
        
        Returns:
            导出文件路径
        """
        audit_package = {
            "version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "scan_info": {
                "timestamp": data.get("scan", {}).get("scan_time", ""),
                "base_directory": data.get("scan", {}).get("base_directory", ""),
                "total_files": data.get("scan", {}).get("total_files", 0),
                "total_size": data.get("scan", {}).get("total_size", 0),
            },
            "files": [],
            "validation_summary": {},
            "validation_issues": [],
            "redaction_log": [],
            "review_log": [],
        }
        
        # 文件信息（精简）
        scan_files = data.get("scan", {}).get("files", [])
        for file_info in scan_files:
            audit_package["files"].append({
                "path": file_info.get("path", ""),
                "name": file_info.get("name", ""),
                "extension": file_info.get("extension", ""),
                "file_type": file_info.get("file_type", ""),
                "size": file_info.get("size", 0),
                "hash_sha256": file_info.get("hash_sha256", ""),
                "hash_md5": file_info.get("hash_md5", ""),
                "modified_time": file_info.get("modified_time", ""),
            })
        
        # 校验信息
        validation = data.get("validation")
        if validation:
            audit_package["validation_summary"] = {
                "checks_performed": validation.get("checks_performed", []),
                "total_files": validation.get("total_files", 0),
                "summary": validation.get("summary", {}),
            }
            audit_package["validation_issues"] = validation.get("issues", [])
        
        # 脱敏日志
        redaction = data.get("redaction", [])
        audit_package["redaction_log"] = redaction
        
        # 复核日志
        review = data.get("review")
        if review:
            if isinstance(review, list):
                audit_package["review_log"] = review
            else:
                audit_package["review_log"] = [review]
        
        # 添加统计摘要
        audit_package["statistics"] = {
            "total_files": len(audit_package["files"]),
            "total_validation_issues": len(audit_package["validation_issues"]),
            "total_redactions": sum(item.get("found_items", 0) for item in audit_package["redaction_log"]),
            "total_reviews": len(audit_package["review_log"]),
        }
        
        output_path = self.output_dir / "audit_package.json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(audit_package, f, ensure_ascii=False, indent=2, default=str)
        
        return output_path
    
    def export_csv_catalog(self, scan_data: Dict[str, Any]) -> Path:
        """导出CSV格式的装订目录
        
        Args:
            scan_data: 扫描结果数据
        
        Returns:
            导出文件路径
        """
        import csv
        
        files = scan_data.get("files", [])
        
        output_path = self.output_dir / "binding_catalog.csv"
        
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            
            # 表头
            writer.writerow([
                "序号", "文件名", "路径", "类型", "大小", "大小(字节)",
                "修改时间", "SHA256哈希", "MD5哈希"
            ])
            
            # 数据行
            for idx, file_info in enumerate(files, 1):
                writer.writerow([
                    idx,
                    file_info.get("name", ""),
                    file_info.get("path", ""),
                    self._get_type_name(file_info.get("file_type", "other")),
                    file_info.get("size_human", ""),
                    file_info.get("size", 0),
                    file_info.get("modified_time", ""),
                    file_info.get("hash_sha256", ""),
                    file_info.get("hash_md5", ""),
                ])
        
        return output_path
