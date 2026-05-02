import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


class Reporter:
    def __init__(self, output_dir: Optional[Path] = None):
        if output_dir is None:
            output_dir = Path.cwd() / "reports"
        self.output_dir = output_dir.resolve()
        self.generated_at = datetime.now().isoformat()
    
    def export_markdown(self, data: Dict[str, Any]) -> Path:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = self.output_dir / f"release_verification_{timestamp}.md"
        
        lines = []
        
        lines.append(f"# {data.get('title', '发布证据包验收报告')}")
        lines.append("")
        lines.append(f"> 生成时间: {self.generated_at}")
        if data.get("target_path"):
            lines.append(f"> 目标目录: {data['target_path']}")
        lines.append("")
        
        summary = data.get("summary", {})
        lines.append("## 概览")
        lines.append("")
        lines.append("| 指标 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| 文件总数 | {summary.get('total_files', 0)} |")
        lines.append(f"| 问题总数 | {summary.get('total_issues', 0)} |")
        
        passed = summary.get("passed")
        if passed is not None:
            status = "通过" if passed else "失败"
            lines.append(f"| 验证状态 | **{status}** |")
        lines.append("")
        
        files = data.get("files", [])
        if files:
            lines.append("## 文件清单")
            lines.append("")
            lines.append("| 文件名 | 类型 | 大小 (字节) | SHA256 | 版本 |")
            lines.append("|--------|------|-------------|--------|------|")
            
            for file_info in files[:50]:
                filename = file_info.get('filename', '')
                file_type = file_info.get('file_type', '')
                size = file_info.get('size', 0)
                sha256 = file_info.get('sha256', '')[:16] + "..." if file_info.get('sha256') else ""
                version = file_info.get('version') or "-"
                lines.append(f"| {filename} | {file_type} | {size} | {sha256} | {version} |")
            
            if len(files) > 50:
                lines.append("")
                lines.append(f"> 仅显示前 50 个文件，共 {len(files)} 个")
            lines.append("")
        
        issues = data.get("issues", [])
        if issues:
            lines.append("## 问题列表")
            lines.append("")
            lines.append("| 严重程度 | 规则 | 消息 | 文件 |")
            lines.append("|----------|------|------|------|")
            
            for issue in issues:
                severity = issue.get('severity', 'unknown')
                rule_name = issue.get('rule_name', '')
                message = issue.get('message', '')[:80]
                file_path = issue.get('file') or "-"
                lines.append(f"| {severity} | {rule_name} | {message} | {file_path} |")
            lines.append("")
        
        verification = data.get("verification", {})
        if verification:
            lines.append("## 验证详情")
            lines.append("")
            
            results = verification.get("results", [])
            for result in results:
                rule_name = result.get('rule_name', '')
                passed = result.get('passed', False)
                status = "通过" if passed else "失败"
                symbol = "✓" if passed else "✗"
                violation_count = result.get('violation_count', 0)
                warnings_count = result.get('warnings_count', 0)
                
                lines.append(f"### {symbol} {rule_name}")
                lines.append("")
                lines.append(f"- 状态: **{status}**")
                lines.append(f"- 违规数: {violation_count}")
                lines.append(f"- 警告数: {warnings_count}")
                lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*此报告由 Release Validator 自动生成*")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        
        return output_path
    
    def export_csv(self, data: Dict[str, Any]) -> Path:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = self.output_dir / f"release_verification_{timestamp}.csv"
        
        issues = data.get("issues", [])
        
        with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            
            writer.writerow([
                "严重程度", "规则ID", "规则名称", "消息", "文件", "行号",
                "期望值", "实际值", "生成时间"
            ])
            
            for issue in issues:
                writer.writerow([
                    issue.get('severity', ''),
                    issue.get('rule_id', ''),
                    issue.get('rule_name', ''),
                    issue.get('message', ''),
                    issue.get('file') or '',
                    issue.get('line') or '',
                    issue.get('expected') or '',
                    issue.get('actual') or '',
                    self.generated_at,
                ])
        
        return output_path
    
    def export_json(self, data: Dict[str, Any]) -> Path:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = self.output_dir / f"release_verification_{timestamp}.json"
        
        full_data = {
            "generated_at": self.generated_at,
            "tool": "release-validator",
            "tool_version": "0.1.0",
            **data,
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(full_data, f, indent=2, ensure_ascii=False, default=str)
        
        return output_path
    
    def generate_all(
        self,
        data: Dict[str, Any],
        formats: Optional[List[str]] = None,
    ) -> Dict[str, Path]:
        if formats is None:
            formats = ["markdown", "csv", "json"]
        
        outputs = {}
        
        if "markdown" in formats:
            outputs["markdown"] = self.export_markdown(data)
        if "csv" in formats:
            outputs["csv"] = self.export_csv(data)
        if "json" in formats:
            outputs["json"] = self.export_json(data)
        
        return outputs
