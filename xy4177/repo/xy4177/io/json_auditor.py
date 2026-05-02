# -*- coding: utf-8 -*-
"""
JSON审计包导出器
"""

import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from core.models import (
    AuditPackage, SKUData, LabelTemplate, ValidationResult, ValidationError
)


class JSONAuditor:
    """JSON审计包导出器"""
    
    def __init__(self):
        pass
    
    def _calculate_hash(self, content: str) -> str:
        """计算内容的SHA256哈希"""
        return hashlib.sha256(content.encode('utf-8')).hexdigest()
    
    def create_audit_package(
        self,
        template: Optional[LabelTemplate],
        sku_list: List[SKUData],
        validation_results: List[ValidationResult],
        project_name: str = "未命名项目"
    ) -> AuditPackage:
        """创建审计包"""
        total_records = len(sku_list)
        valid_records = sum(1 for vr in validation_results if vr.is_valid)
        invalid_records = total_records - valid_records
        
        all_errors: List[ValidationError] = []
        for vr in validation_results:
            all_errors.extend(vr.errors)
            all_errors.extend(vr.warnings)
        
        box_numbers = [sku.box_number for sku in sku_list if sku.box_number]
        from collections import Counter
        box_counts = Counter(box_numbers)
        duplicate_boxes = [box for box, count in box_counts.items() if count > 1]
        
        missing_fields = []
        if template:
            template_fields = set(template.get_field_names())
            if sku_list:
                data_fields = set(sku_list[0].to_dict().keys())
                missing_fields = list(template_fields - data_fields)
        
        template_hash = ""
        template_name = ""
        if template:
            template_hash = self._calculate_hash(template.raw_content)
            template_name = template.name
        
        return AuditPackage(
            version="1.0",
            generated_at=datetime.now(),
            template_name=template_name,
            template_hash=template_hash,
            total_records=total_records,
            valid_records=valid_records,
            invalid_records=invalid_records,
            all_errors=all_errors,
            duplicate_box_numbers=duplicate_boxes,
            missing_fields=missing_fields,
        )
    
    def export_audit_package(
        self,
        audit_package: AuditPackage,
        output_path: str
    ):
        """导出审计包到JSON文件"""
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(audit_package.to_dict(), f, ensure_ascii=False, indent=2)
    
    def export_errors_csv(
        self,
        validation_results: List[ValidationResult],
        output_path: str
    ):
        """导出错误清单到CSV"""
        import csv
        from pathlib import Path
        
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        rows = []
        for vr in validation_results:
            sku = vr.sku_data
            
            for error in vr.errors:
                rows.append({
                    '行号': sku.row_index,
                    '箱号': sku.box_number,
                    'SKU': sku.sku,
                    '级别': '错误',
                    '错误代码': error.error_code,
                    '字段': error.field or '',
                    '消息': error.message,
                })
            
            for warning in vr.warnings:
                rows.append({
                    '行号': sku.row_index,
                    '箱号': sku.box_number,
                    'SKU': sku.sku,
                    '级别': '警告',
                    '错误代码': warning.error_code,
                    '字段': warning.field or '',
                    '消息': warning.message,
                })
        
        if rows:
            fieldnames = list(rows[0].keys())
            with open(path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)
    
    def export_summary(
        self,
        audit_package: AuditPackage,
        output_path: str
    ):
        """导出摘要报告"""
        summary = {
            '项目信息': {
                '生成时间': audit_package.generated_at.isoformat() if audit_package.generated_at else None,
                '模板名称': audit_package.template_name,
                '模板哈希': audit_package.template_hash,
            },
            '统计概览': {
                '总记录数': audit_package.total_records,
                '通过记录数': audit_package.valid_records,
                '失败记录数': audit_package.invalid_records,
                '通过率': f"{(audit_package.valid_records / audit_package.total_records * 100) if audit_package.total_records > 0 else 0:.1f}%",
            },
            '问题汇总': {
                '重复箱号': audit_package.duplicate_box_numbers,
                '缺失字段': audit_package.missing_fields,
                '总问题数': len(audit_package.all_errors),
            }
        }
        
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
