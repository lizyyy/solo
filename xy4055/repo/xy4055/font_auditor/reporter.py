import csv
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

from pydantic import BaseModel

from .checker import Violation, Warning, ViolationType
from .config import Project
from .scanner import FontUsageResult
from .quarantine import Quarantine, QuarantineEntry


class Reporter:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self._scan_results: List[FontUsageResult] = []
        self._check_results: Optional[Dict[str, Any]] = None
        self._quarantine: Optional[Quarantine] = None
    
    def set_scan_results(self, results: List[FontUsageResult]) -> None:
        self._scan_results = results
    
    def set_check_results(self, results: Dict[str, Any]) -> None:
        self._check_results = results
    
    def set_quarantine(self, quarantine: Quarantine) -> None:
        self._quarantine = quarantine
    
    def generate_markdown(self, project: Optional[Project] = None) -> Path:
        output_path = self.output_dir / "font-audit-report.md"
        
        content = []
        
        content.append("# 字体授权巡检报告")
        content.append("")
        content.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        content.append("")
        
        if project:
            content.append("## 项目信息")
            content.append("")
            content.append(f"- **项目名称**: {project.project_name}")
            content.append(f"- **项目ID**: {project.project_id}")
            content.append(f"- **客户ID**: {project.client_id}")
            content.append(f"- **用途类型**: {', '.join(project.usage_type)}")
            content.append(f"- **区域**: {project.region}")
            content.append("")
        
        content.append("## 概览")
        content.append("")
        
        total_fonts = len(set(r.font_name for r in self._scan_results))
        total_files = len(set(r.file_path for r in self._scan_results))
        
        content.append(f"- **扫描字体数量**: {total_fonts}")
        content.append(f"- **扫描文件数量**: {total_files}")
        
        if self._check_results:
            compliant = len(self._check_results.get("compliant", []))
            violations = len(self._check_results.get("violations", []))
            warnings = len(self._check_results.get("warnings", []))
            
            content.append(f"- **合规字体**: {compliant}")
            content.append(f"- **违规字体**: {violations}")
            content.append(f"- **警告**: {warnings}")
        
        if self._quarantine:
            active = len([e for e in self._quarantine.entries if e.status == "active"])
            content.append(f"- **隔离区活跃项**: {active}")
        
        content.append("")
        
        if self._scan_results:
            content.append("## 扫描结果详情")
            content.append("")
            
            fonts_by_name: Dict[str, List[FontUsageResult]] = {}
            for result in self._scan_results:
                if result.font_name not in fonts_by_name:
                    fonts_by_name[result.font_name] = []
                fonts_by_name[result.font_name].append(result)
            
            for font_name, results in sorted(fonts_by_name.items()):
                content.append(f"### {font_name}")
                content.append("")
                
                files = set()
                for r in results:
                    file_info = f"- `{r.file_path}`"
                    if r.page:
                        file_info += f" (页面: {r.page})"
                    files.add(file_info)
                
                for file_info in sorted(files):
                    content.append(file_info)
                
                content.append("")
        
        if self._check_results and self._check_results.get("violations"):
            content.append("## 违规详情")
            content.append("")
            
            violations = self._check_results["violations"]
            if violations:
                for violation in violations:
                    violation_type = violation.get("violation_type", "unknown")
                    font_name = violation.get("font_name", "Unknown")
                    message = violation.get("message", "")
                    file_path = violation.get("file_path", "")
                    severity = violation.get("severity", "high")
                    
                    content.append(f"### [{severity.upper()}] {font_name}")
                    content.append("")
                    content.append(f"- **类型**: {violation_type}")
                    content.append(f"- **文件**: `{file_path}`")
                    if violation.get("page"):
                        content.append(f"- **页面**: {violation['page']}")
                    content.append(f"- **描述**: {message}")
                    
                    details = violation.get("details", {})
                    if details:
                        content.append("")
                        content.append("**详情**:")
                        for key, value in details.items():
                            content.append(f"- {key}: {value}")
                    
                    content.append("")
        
        if self._check_results and self._check_results.get("warnings"):
            content.append("## 警告详情")
            content.append("")
            
            warnings = self._check_results["warnings"]
            if warnings:
                for warning in warnings:
                    font_name = warning.get("font_name", "Unknown")
                    message = warning.get("message", "")
                    file_path = warning.get("file_path", "")
                    
                    content.append(f"### {font_name}")
                    content.append("")
                    content.append(f"- **文件**: `{file_path}`")
                    content.append(f"- **描述**: {message}")
                    content.append("")
        
        if self._quarantine and self._quarantine.entries:
            content.append("## 隔离区记录")
            content.append("")
            
            content.append("| 状态 | 字体 | 违规类型 | 文件 | 严重程度 |")
            content.append("|------|------|----------|------|----------|")
            
            for entry in self._quarantine.entries:
                status_emoji = "✅" if entry.status == "resolved" else "⚠️"
                content.append(
                    f"| {status_emoji} {entry.status} | {entry.font_name} | "
                    f"{entry.violation_type} | `{entry.file_path}` | {entry.severity} |"
                )
            
            content.append("")
        
        content.append("---")
        content.append("")
        content.append("*此报告由字体授权交付巡检员自动生成*")
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(content))
        
        return output_path
    
    def generate_csv(self) -> Path:
        output_path = self.output_dir / "font-inventory.csv"
        
        fieldnames = [
            "font_name",
            "file_path",
            "file_type",
            "page",
            "detected_from",
            "status",
            "violation_type",
            "notes",
        ]
        
        rows = []
        
        for result in self._scan_results:
            row = {
                "font_name": result.font_name,
                "file_path": result.file_path,
                "file_type": result.file_type,
                "page": result.page or "",
                "detected_from": result.detected_from,
                "status": "scanned",
                "violation_type": "",
                "notes": "",
            }
            rows.append(row)
        
        if self._check_results:
            violations = self._check_results.get("violations", [])
            for violation in violations:
                for row in rows:
                    if (row["font_name"] == violation.get("font_name") and
                        row["file_path"] == violation.get("file_path")):
                        row["status"] = "violation"
                        row["violation_type"] = violation.get("violation_type", "")
                        row["notes"] = violation.get("message", "")
                        break
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        
        return output_path
    
    def generate_json_audit(self) -> Path:
        output_path = self.output_dir / "font-audit-package.json"
        
        audit_package = {
            "version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "scan_results": [],
            "check_results": self._check_results,
            "quarantine": None,
            "summary": {},
        }
        
        if self._scan_results:
            audit_package["scan_results"] = [
                r.model_dump() for r in self._scan_results
            ]
        
        if self._quarantine:
            audit_package["quarantine"] = self._quarantine.model_dump()
        
        total_fonts = len(set(r.font_name for r in self._scan_results))
        total_files = len(set(r.file_path for r in self._scan_results))
        
        audit_package["summary"] = {
            "total_fonts_scanned": total_fonts,
            "total_files_scanned": total_files,
        }
        
        if self._check_results:
            audit_package["summary"].update({
                "compliant_count": len(self._check_results.get("compliant", [])),
                "violation_count": len(self._check_results.get("violations", [])),
                "warning_count": len(self._check_results.get("warnings", [])),
            })
        
        if self._quarantine:
            active_count = len([e for e in self._quarantine.entries if e.status == "active"])
            audit_package["summary"]["quarantine_active_count"] = active_count
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(audit_package, f, indent=2, ensure_ascii=False)
        
        return output_path
