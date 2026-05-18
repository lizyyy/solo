import json
import math
import os
from typing import Dict, List, Any
from datetime import datetime
from tabulate import tabulate


class ReportExporter:
    def __init__(self):
        pass
    
    def generate_human_readable(self, result: Dict[str, Any]) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("                      采购比价分析报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("【一、数据概览】")
        lines.append("-" * 80)
        lines.append(f"原始数据行数: {result.get('raw_rows', 0)}")
        lines.append(f"有效数据行数: {result.get('valid_count', 0)}")
        lines.append(f"无效数据行数: {result.get('invalid_count', 0)}")
        lines.append("")
        
        lines.append("【二、缺项统计】")
        lines.append("-" * 80)
        missing = result.get('missing_summary', {})
        if missing:
            for field, count in missing.items():
                lines.append(f"  {field}: 缺失 {count} 条")
        else:
            lines.append("  无缺项")
        lines.append("")
        
        lines.append("【三、冲突检测】")
        lines.append("-" * 80)
        conflicts = result.get('conflicts', [])
        if conflicts:
            for i, conflict in enumerate(conflicts, 1):
                lines.append(f"  {i}. {conflict['type']}")
                for k, v in conflict.items():
                    if k != 'type':
                        lines.append(f"     {k}: {v}")
        else:
            lines.append("  无冲突")
        lines.append("")
        
        lines.append("【四、警告信息】")
        lines.append("-" * 80)
        warnings = result.get('warnings', [])
        if warnings:
            for i, w in enumerate(warnings, 1):
                lines.append(f"  {i}. {w}")
        else:
            lines.append("  无警告")
        lines.append("")
        
        lines.append("【五、错误信息】")
        lines.append("-" * 80)
        errors = result.get('errors', [])
        if errors:
            for i, e in enumerate(errors, 1):
                lines.append(f"  {i}. {e}")
        else:
            lines.append("  无错误")
        lines.append("")
        
        lines.append("【六、比价结果(按交期排序)】")
        lines.append("-" * 80)
        
        records = result.get('sorted_records', [])
        if records:
            table_data = []
            headers = ['序号', '行号', '供应商', '含税价', '税率', '不含税价', '税额', '交期', '品类', '状态']
            
            for i, r in enumerate(records, 1):
                status = []
                if r.get('缺项列表'):
                    status.append('缺项')
                if not r.get('报价_有效'):
                    status.append('报价无效')
                if not r.get('税率_有效'):
                    status.append('税率无效')
                if not r.get('交期_有效'):
                    status.append('交期无效')
                
                status_str = ','.join(status) if status else '正常'
                
                price = r.get('报价')
                price_ex_tax = r.get('不含税价')
                tax_amount = r.get('税额')
                tax_rate = r.get('税率_标准化')
                
                def format_num(v, decimals=2):
                    if v is None:
                        return '-'
                    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                        return '-'
                    return f"{v:.{decimals}f}"
                
                table_data.append([
                    i,
                    r.get('原始行号', ''),
                    str(r.get('供应商', ''))[:15],
                    format_num(price),
                    f"{tax_rate * 100:.1f}%" if tax_rate is not None else '-',
                    format_num(price_ex_tax),
                    format_num(tax_amount),
                    r.get('交期_标准化', '-'),
                    str(r.get('采购品类', ''))[:10],
                    status_str
                ])
            
            lines.append(tabulate(table_data, headers=headers, tablefmt='simple'))
        else:
            lines.append("  无数据")
        lines.append("")
        
        lines.append("【七、比价建议】")
        lines.append("-" * 80)
        valid_records = [r for r in result.get('sorted_records', []) if self._is_valid_supplier(r)]
        
        if valid_records:
            cheapest = min(valid_records, key=lambda x: x['不含税价'])
            fastest = min(valid_records, key=lambda x: x['交期_排序键'])
            
            lines.append(f"  最低价推荐: {cheapest.get('供应商')} - 不含税价 {cheapest['不含税价']:.2f} - 交期 {cheapest.get('交期_标准化')}")
            if fastest.get('供应商') != cheapest.get('供应商'):
                lines.append(f"  最快交期推荐: {fastest.get('供应商')} - 交期 {fastest.get('交期_标准化')} - 不含税价 {fastest['不含税价']:.2f}")
            
            price_diff = (fastest['不含税价'] - cheapest['不含税价']) / cheapest['不含税价']
            if price_diff > 0.1:
                lines.append(f"  备注: 最快交期方案比最低价方案贵 {price_diff*100:.1f}%")
        else:
            lines.append("  无有效数据可生成建议")
        
        lines.append("")
        lines.append("=" * 80)
        lines.append("                      报告结束")
        lines.append("=" * 80)
        
        return "\n".join(lines)
    
    def _sanitize_value(self, value):
        if value is None:
            return None
        if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
            return None
        return value
    
    def _is_valid_supplier(self, r: Dict[str, Any]) -> bool:
        supplier = r.get('供应商')
        category = r.get('采购品类')
        price_ex_tax = r.get('不含税价')
        has_supplier = supplier is not None and str(supplier).strip() != '' and str(supplier).strip().lower() != 'nan'
        has_category = category is not None and str(category).strip() != '' and str(category).strip().lower() != 'nan'
        has_valid_price = price_ex_tax is not None and price_ex_tax > 0
        has_valid_delivery = r.get('交期_有效', False)
        has_valid_tax = r.get('税率_有效', False)
        return has_supplier and has_category and has_valid_price and has_valid_delivery and has_valid_tax

    def generate_machine_readable(self, result: Dict[str, Any]) -> Dict[str, Any]:
        output = {
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'version': '1.0.0'
            },
            'summary': {
                'raw_rows': result.get('raw_rows', 0),
                'valid_count': result.get('valid_count', 0),
                'invalid_count': result.get('invalid_count', 0),
                'missing_summary': result.get('missing_summary', {}),
                'conflict_count': len(result.get('conflicts', [])),
                'warning_count': len(result.get('warnings', [])),
                'error_count': len(result.get('errors', [])),
            },
            'conflicts': result.get('conflicts', []),
            'warnings': result.get('warnings', []),
            'errors': result.get('errors', []),
            'records': []
        }
        
        for r in result.get('sorted_records', []):
            record = {
                'row_number': r.get('原始行号'),
                'supplier': self._sanitize_value(r.get('供应商')),
                'price': self._sanitize_value(r.get('报价')),
                'tax_rate': self._sanitize_value(r.get('税率')),
                'tax_rate_normalized': self._sanitize_value(r.get('税率_标准化')),
                'price_ex_tax': self._sanitize_value(r.get('不含税价')),
                'tax_amount': self._sanitize_value(r.get('税额')),
                'delivery': self._sanitize_value(r.get('交期')),
                'delivery_normalized': self._sanitize_value(r.get('交期_标准化')),
                'delivery_days': self._sanitize_value(r.get('交期_天数')),
                'category': self._sanitize_value(r.get('采购品类')),
                'source': self._sanitize_value(r.get('附件来源')),
                'missing_fields': r.get('缺项列表', []),
                'is_price_valid': r.get('报价_有效', False),
                'is_tax_valid': r.get('税率_有效', False),
                'is_delivery_valid': r.get('交期_有效', False),
            }
            output['records'].append(record)
        
        valid_records = [r for r in result.get('sorted_records', []) if self._is_valid_supplier(r)]
        
        if valid_records:
            cheapest = min(valid_records, key=lambda x: x['不含税价'])
            fastest = min(valid_records, key=lambda x: x['交期_排序键'])
            output['recommendations'] = {
                'cheapest': {
                    'supplier': cheapest.get('供应商'),
                    'price_ex_tax': self._sanitize_value(cheapest.get('不含税价')),
                    'delivery': self._sanitize_value(cheapest.get('交期_标准化')),
                    'row_number': cheapest.get('原始行号'),
                },
                'fastest': {
                    'supplier': fastest.get('供应商'),
                    'price_ex_tax': self._sanitize_value(fastest.get('不含税价')),
                    'delivery': self._sanitize_value(fastest.get('交期_标准化')),
                    'row_number': fastest.get('原始行号'),
                }
            }
        
        return output
    
    def export(self, result: Dict[str, Any], output_dir: str, base_name: str = 'procurement_report') -> Dict[str, str]:
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        human_report = self.generate_human_readable(result)
        human_file = os.path.join(output_dir, f"{base_name}.txt")
        with open(human_file, 'w', encoding='utf-8') as f:
            f.write(human_report)
        
        machine_report = self.generate_machine_readable(result)
        machine_file = os.path.join(output_dir, f"{base_name}.json")
        with open(machine_file, 'w', encoding='utf-8') as f:
            json.dump(machine_report, f, ensure_ascii=False, indent=2)
        
        return {
            'human_readable': human_file,
            'machine_readable': machine_file
        }
