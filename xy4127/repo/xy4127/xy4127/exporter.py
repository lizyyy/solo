import os
import json
import csv
from typing import Dict, List, Optional, Any
from datetime import datetime
from pathlib import Path

from .models import Package, Issue, Review, Photo, Remark, ClaimForm
from .rule_engine import RuleEngine


class Exporter:
    """报告导出器 - 导出申诉包、问题清单和审计记录"""
    
    def __init__(self, packages: Dict[str, Package], reviews: Dict[str, Review]):
        self.packages = packages
        self.reviews = reviews
        self.engine = RuleEngine()
    
    def export_markdown(self, output_dir: str) -> str:
        """导出Markdown申诉包"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_name = f"申诉包_{timestamp}.md"
        file_path = os.path.join(output_dir, file_name)
        
        content = self._generate_markdown_content()
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return file_path
    
    def _generate_markdown_content(self) -> str:
        """生成Markdown内容"""
        lines = []
        
        lines.append("# 异常包裹申诉包")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"包裹总数: {len(self.packages)}")
        lines.append("")
        
        all_issues = self.engine.check_all(self.packages)
        
        if all_issues:
            lines.append("## ⚠️ 校验问题汇总")
            lines.append("")
            
            severity_count = {}
            type_count = {}
            
            for issue in all_issues:
                severity_count[issue.severity] = severity_count.get(issue.severity, 0) + 1
                type_count[issue.issue_type] = type_count.get(issue.issue_type, 0) + 1
            
            lines.append("### 按严重程度统计")
            for severity, count in severity_count.items():
                lines.append(f"- {severity}: {count} 个")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        
        for tracking_no, pkg in self.packages.items():
            lines.append(f"## 运单号: {tracking_no}")
            lines.append("")
            
            review = self.reviews.get(tracking_no.upper())
            if review:
                lines.append(f"**复核状态**: {review.status}")
                if review.comment:
                    lines.append(f"**处理意见**: {review.comment}")
                lines.append("")
            
            if pkg.remarks:
                lines.append("### 📝 客服备注")
                lines.append("")
                for remark in pkg.remarks:
                    lines.append(f"- **客户**: {remark.customer_name or '未知'}")
                    lines.append(f"  - **电话**: {remark.contact_phone or '未知'}")
                    lines.append(f"  - **问题类型**: {remark.issue_type or '未知'}")
                    lines.append(f"  - **描述**: {remark.issue_description or '无'}")
                    lines.append(f"  - **赔付金额**: ¥{remark.claim_amount:.2f}")
                    if remark.remark_date:
                        lines.append(f"  - **日期**: {remark.remark_date.strftime('%Y-%m-%d %H:%M:%S')}")
                    lines.append("")
            
            if pkg.photos:
                lines.append("### 📷 照片证据")
                lines.append("")
                lines.append(f"共 {len(pkg.photos)} 张照片:")
                lines.append("")
                for i, photo in enumerate(pkg.photos, 1):
                    ts_info = ""
                    if photo.timestamp:
                        ts_info = f" ({photo.timestamp.strftime('%Y-%m-%d %H:%M:%S')})"
                    elif photo.file_modified:
                        ts_info = f" (修改时间: {photo.file_modified.strftime('%Y-%m-%d %H:%M:%S')})"
                    
                    lines.append(f"{i}. **{photo.file_name}**{ts_info}")
                    lines.append(f"   - 路径: `{photo.file_path}`")
                    lines.append(f"   - 大小: {photo.file_size} 字节")
                    if photo.width and photo.height:
                        lines.append(f"   - 尺寸: {photo.width}x{photo.height}")
                    lines.append("")
            
            if pkg.claim_form:
                lines.append("### 💰 赔付申请")
                lines.append("")
                lines.append(f"- **申请金额**: ¥{pkg.claim_form.claim_amount:.2f}")
                lines.append(f"- **申请人**: {pkg.claim_form.applicant or '未知'}")
                lines.append(f"- **状态**: {pkg.claim_form.status or '待处理'}")
                if pkg.claim_form.application_date:
                    lines.append(f"- **申请日期**: {pkg.claim_form.application_date.strftime('%Y-%m-%d')}")
                lines.append("")
            
            pkg_issues = [i for i in all_issues if i.tracking_no == tracking_no]
            if pkg_issues:
                lines.append("### ❌ 发现的问题")
                lines.append("")
                for issue in pkg_issues:
                    severity_icon = "🔴" if issue.severity == "critical" else ("🟠" if issue.severity == "high" else "🟡")
                    lines.append(f"{severity_icon} **[{issue.severity}] {issue.issue_type}**")
                    lines.append(f"   {issue.description}")
                    lines.append("")
            
            lines.append("---")
            lines.append("")
        
        return "\n".join(lines)
    
    def export_issues_csv(self, output_dir: str) -> str:
        """导出CSV问题清单"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_name = f"问题清单_{timestamp}.csv"
        file_path = os.path.join(output_dir, file_name)
        
        all_issues = self.engine.check_all(self.packages)
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                "运单号",
                "问题类型",
                "严重程度",
                "描述",
                "复核状态",
                "处理意见",
                "详情"
            ])
            
            for issue in all_issues:
                review = self.reviews.get(issue.tracking_no.upper())
                writer.writerow([
                    issue.tracking_no,
                    issue.issue_type,
                    issue.severity,
                    issue.description,
                    review.status if review else "",
                    review.comment if review else "",
                    json.dumps(issue.details, ensure_ascii=False)
                ])
        
        return file_path
    
    def export_audit_json(self, output_dir: str) -> str:
        """导出JSON审计记录"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_name = f"审计记录_{timestamp}.json"
        file_path = os.path.join(output_dir, file_name)
        
        all_issues = self.engine.check_all(self.packages)
        
        audit_data = {
            "audit_version": "1.0",
            "audit_time": datetime.now().isoformat(),
            "summary": {
                "total_packages": len(self.packages),
                "total_issues": len(all_issues),
                "total_reviews": len(self.reviews),
            },
            "packages": [],
            "issues": [],
            "reviews": [],
        }
        
        for tracking_no, pkg in self.packages.items():
            pkg_dict = pkg.to_dict()
            review = self.reviews.get(tracking_no.upper())
            if review:
                pkg_dict["review"] = review.to_dict()
            audit_data["packages"].append(pkg_dict)
        
        for issue in all_issues:
            audit_data["issues"].append(issue.to_dict())
        
        for tracking_no, review in self.reviews.items():
            audit_data["reviews"].append(review.to_dict())
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(audit_data, f, ensure_ascii=False, indent=2)
        
        return file_path
