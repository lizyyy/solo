"""
报告模块 - 导出 Markdown/CSV/JSON 格式报告
"""

import csv
import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional

from .models import OrderCase, ValidationResult, OrderStatus


class Reporter:
    def __init__(self, reports_dir: str):
        self.reports_dir = os.path.abspath(reports_dir)
        self._ensure_dir_exists()
    
    def _ensure_dir_exists(self):
        if not os.path.exists(self.reports_dir):
            os.makedirs(self.reports_dir, exist_ok=True)
    
    def generate_report(
        self, 
        cases: List[OrderCase], 
        validation_result: Optional[ValidationResult] = None,
        report_name: Optional[str] = None,
        formats: List[str] = None
    ) -> Dict[str, str]:
        if formats is None:
            formats = ["markdown", "csv", "json"]
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_name = report_name or f"validation_report_{timestamp}"
        
        generated_files = {}
        
        if "json" in formats:
            json_path = os.path.join(self.reports_dir, f"{base_name}.json")
            self._write_json_report(cases, validation_result, json_path)
            generated_files["json"] = json_path
        
        if "csv" in formats:
            csv_path = os.path.join(self.reports_dir, f"{base_name}.csv")
            self._write_csv_report(cases, validation_result, csv_path)
            generated_files["csv"] = csv_path
        
        if "markdown" in formats:
            md_path = os.path.join(self.reports_dir, f"{base_name}.md")
            self._write_markdown_report(cases, validation_result, md_path)
            generated_files["markdown"] = md_path
        
        return generated_files
    
    def _write_json_report(
        self, 
        cases: List[OrderCase], 
        validation_result: Optional[ValidationResult],
        output_path: str
    ):
        report_data = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "version": "1.0.0"
            },
            "summary": self._build_summary(cases, validation_result),
            "cases": [case.to_dict() for case in cases]
        }
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
    
    def _write_csv_report(
        self, 
        cases: List[OrderCase], 
        validation_result: Optional[ValidationResult],
        output_path: str
    ):
        fieldnames = [
            "序号", "病例编号", "患者编号", "患者姓名", 
            "牙位", "材料类型", "色号", "状态", 
            "关键问题数", "警告数", "备注"
        ]
        
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for idx, case in enumerate(cases, start=1):
                critical_count = len([i for i in case.validation_issues if i.severity == "critical"])
                warning_count = len([i for i in case.validation_issues if i.severity == "warning"])
                
                issues_summary = "; ".join([
                    i.message for i in case.validation_issues 
                    if i.severity in ["critical", "warning"]
                ][:3])
                
                writer.writerow({
                    "序号": idx,
                    "病例编号": case.case_id,
                    "患者编号": case.patient.patient_id,
                    "患者姓名": case.patient.patient_name,
                    "牙位": case.tooth_position.raw_position,
                    "材料类型": case.material.material_type.value if case.material.material_type else "",
                    "色号": case.material.color_shade,
                    "状态": case.status.value,
                    "关键问题数": critical_count,
                    "警告数": warning_count,
                    "备注": issues_summary
                })
    
    def _write_markdown_report(
        self, 
        cases: List[OrderCase], 
        validation_result: Optional[ValidationResult],
        output_path: str
    ):
        summary = self._build_summary(cases, validation_result)
        
        md_content = self._generate_markdown_header(summary)
        md_content += self._generate_markdown_summary(summary)
        md_content += self._generate_markdown_cases(cases)
        md_content += self._generate_markdown_issues_detail(cases)
        md_content += self._generate_markdown_footer()
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(md_content)
    
    def _build_summary(
        self, 
        cases: List[OrderCase], 
        validation_result: Optional[ValidationResult]
    ) -> Dict[str, Any]:
        total = len(cases)
        passed = len([c for c in cases if c.status == OrderStatus.PASSED])
        quarantined = len([c for c in cases if c.status == OrderStatus.QUARANTINED])
        
        critical_count = sum(
            len([i for i in c.validation_issues if i.severity == "critical"])
            for c in cases
        )
        warning_count = sum(
            len([i for i in c.validation_issues if i.severity == "warning"])
            for c in cases
        )
        info_count = sum(
            len([i for i in c.validation_issues if i.severity == "info"])
            for c in cases
        )
        
        issue_types: Dict[str, int] = {}
        for case in cases:
            for issue in case.validation_issues:
                rule_name = issue.rule_name
                if rule_name in issue_types:
                    issue_types[rule_name] += 1
                else:
                    issue_types[rule_name] = 1
        
        material_types: Dict[str, int] = {}
        for case in cases:
            mt = case.material.material_type.value if case.material.material_type else "unknown"
            if mt in material_types:
                material_types[mt] += 1
            else:
                material_types[mt] = 1
        
        return {
            "total_cases": total,
            "passed_cases": passed,
            "quarantined_cases": quarantined,
            "pass_rate": f"{(passed/total*100):.1f}%" if total > 0 else "0%",
            "issues_by_severity": {
                "critical": critical_count,
                "warning": warning_count,
                "info": info_count
            },
            "issues_by_rule": issue_types,
            "material_types": material_types,
            "generated_at": datetime.now().isoformat()
        }
    
    def _generate_markdown_header(self, summary: Dict[str, Any]) -> str:
        return f"""# 义齿打印交付核对报告

> 生成时间: {summary['generated_at']}

---

"""
    
    def _generate_markdown_summary(self, summary: Dict[str, Any]) -> str:
        content = """## 校验摘要

### 病例统计

| 指标 | 数值 |
|------|------|
"""
        content += f"| 总病例数 | {summary['total_cases']} |\n"
        content += f"| 通过病例 | {summary['passed_cases']} |\n"
        content += f"| 隔离病例 | {summary['quarantined_cases']} |\n"
        content += f"| 通过率 | {summary['pass_rate']} |\n"
        
        content += """
### 问题统计

| 严重程度 | 数量 |
|----------|------|
"""
        severity_labels = {"critical": "关键", "warning": "警告", "info": "信息"}
        for severity, count in summary['issues_by_severity'].items():
            label = severity_labels.get(severity, severity)
            content += f"| {label} | {count} |\n"
        
        if summary['issues_by_rule']:
            content += """
### 问题类型分布

| 规则名称 | 问题数 |
|----------|--------|
"""
            for rule_name, count in sorted(summary['issues_by_rule'].items(), key=lambda x: -x[1]):
                content += f"| {rule_name} | {count} |\n"
        
        if summary['material_types']:
            content += """
### 材料类型分布

| 材料类型 | 病例数 |
|----------|--------|
"""
            for mt, count in summary['material_types'].items():
                content += f"| {mt} | {count} |\n"
        
        content += "\n---\n\n"
        return content
    
    def _generate_markdown_cases(self, cases: List[OrderCase]) -> str:
        if not cases:
            return "## 病例详情\n\n无病例数据\n\n---\n\n"
        
        content = """## 病例详情

### 通过的病例

"""
        passed_cases = [c for c in cases if c.status == OrderStatus.PASSED]
        
        if passed_cases:
            content += """| 序号 | 病例编号 | 患者编号 | 患者姓名 | 牙位 | 材料 | 色号 |
|------|----------|----------|----------|------|------|------|
"""
            for idx, case in enumerate(passed_cases, start=1):
                content += f"| {idx} | {case.case_id} | {case.patient.patient_id} | {case.patient.patient_name} | {case.tooth_position.raw_position} | {case.material.material_type.value if case.material.material_type else ''} | {case.material.color_shade} |\n"
        else:
            content += "无通过的病例\n"
        
        content += "\n\n### 隔离的病例\n\n"
        
        quarantined_cases = [c for c in cases if c.status == OrderStatus.QUARANTINED]
        
        if quarantined_cases:
            content += """| 序号 | 病例编号 | 患者编号 | 患者姓名 | 牙位 | 关键问题数 | 隔离原因 |
|------|----------|----------|----------|------|------------|----------|
"""
            for idx, case in enumerate(quarantined_cases, start=1):
                critical_count = len([i for i in case.validation_issues if i.severity == "critical"])
                critical_issues = [i.message for i in case.validation_issues if i.severity == "critical"]
                reason = "; ".join(critical_issues[:2]) if critical_issues else "未知原因"
                
                content += f"| {idx} | {case.case_id} | {case.patient.patient_id} | {case.patient.patient_name} | {case.tooth_position.raw_position} | {critical_count} | {reason[:50]}{'...' if len(reason) > 50 else ''} |\n"
        else:
            content += "无隔离的病例\n"
        
        content += "\n---\n\n"
        return content
    
    def _generate_markdown_issues_detail(self, cases: List[OrderCase]) -> str:
        quarantined_cases = [c for c in cases if c.status == OrderStatus.QUARANTINED]
        
        if not quarantined_cases:
            return ""
        
        content = "## 问题详情\n\n"
        
        for case in quarantined_cases:
            content += f"### 病例 {case.case_id}\n\n"
            content += f"- **患者**: {case.patient.patient_name} ({case.patient.patient_id})\n"
            content += f"- **牙位**: {case.tooth_position.raw_position}\n"
            content += f"- **材料**: {case.material.material_type.value if case.material.material_type else ''} / {case.material.color_shade}\n\n"
            
            if case.validation_issues:
                content += "**问题列表**:\n\n"
                for issue in case.validation_issues:
                    severity_icon = "🔴" if issue.severity == "critical" else ("🟡" if issue.severity == "warning" else "🔵")
                    content += f"{severity_icon} **{issue.rule_name}**: {issue.message}\n"
                    
                    if issue.details:
                        content += f"   - 详情: {json.dumps(issue.details, ensure_ascii=False)}\n"
                    
                    content += "\n"
            
            content += "---\n\n"
        
        return content
    
    def _generate_markdown_footer(self) -> str:
        return """---

## 备注

- 🔴 关键问题: 必须修复才能交付
- 🟡 警告问题: 建议检查确认
- 🔵 信息提示: 仅作参考

报告由「义齿打印交付核对员」自动生成。
"""
    
    def get_report_summary(self) -> Dict[str, Any]:
        return {
            "reports_dir": self.reports_dir,
            "available_reports": self._list_reports()
        }
    
    def _list_reports(self) -> List[Dict[str, Any]]:
        if not os.path.exists(self.reports_dir):
            return []
        
        reports = []
        for filename in os.listdir(self.reports_dir):
            if filename.endswith(('.json', '.csv', '.md')):
                file_path = os.path.join(self.reports_dir, filename)
                stat = os.stat(file_path)
                reports.append({
                    "filename": filename,
                    "file_path": file_path,
                    "size_bytes": stat.st_size,
                    "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat()
                })
        
        return sorted(reports, key=lambda x: x['modified_at'], reverse=True)
