import json
from typing import List, Dict
from models import FoundItem, LostReport, ClaimRecord
from datetime import datetime


class MarkdownExporter:
    def export(self, 
               found_items: List[FoundItem], 
               lost_reports: List[LostReport], 
               claim_records: List[ClaimRecord]) -> str:
        lines = []
        
        lines.append('# 失物招领管理系统 - 值班室清单')
        lines.append(f'')
        lines.append(f'**生成时间**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
        lines.append(f'')
        lines.append(f'**统计摘要**:')
        lines.append(f'- 拾到物品总数: {len(found_items)}')
        lines.append(f'- 报失记录总数: {len(lost_reports)}')
        lines.append(f'- 领取记录总数: {len(claim_records)}')
        
        claimed_count = sum(1 for r in claim_records if r.status in ['claimed', 'returned', 'confirmed'])
        unclaimed_count = len(found_items) - claimed_count
        lines.append(f'- 已领取: {claimed_count}')
        lines.append(f'- 待领取: {unclaimed_count}')
        lines.append(f'')
        lines.append('---')
        lines.append('')
        
        lines.append('## 一、拾到物品清单')
        lines.append('')
        
        if not found_items:
            lines.append('暂无拾到物品记录。')
        else:
            status_groups = {}
            for item in found_items:
                if item.status not in status_groups:
                    status_groups[item.status] = []
                status_groups[item.status].append(item)
            
            status_order = ['unclaimed', 'pending', 'confirmed', 'claimed', 'returned', 'disposed']
            status_names = {
                'unclaimed': '待认领',
                'pending': '认领中',
                'confirmed': '已确认',
                'claimed': '已领取',
                'returned': '已归还',
                'disposed': '已处置'
            }
            
            for status in status_order:
                if status in status_groups:
                    items = status_groups[status]
                    lines.append(f'### {status_names.get(status, status)} ({len(items)}件)')
                    lines.append('')
                    
                    for i, item in enumerate(items, 1):
                        lines.append(f'#### {i}. {item.title}')
                        lines.append(f'')
                        lines.append(f'- **物品ID**: {item.item_id}')
                        lines.append(f'- **描述**: {item.description or "无"}')
                        lines.append(f'- **拾获地点**: {item.location or "未知"}')
                        lines.append(f'- **拾获日期**: {item.found_date or "未知"}')
                        lines.append(f'- **拾获人**: {item.finder or "未知"}')
                        if item.tags:
                            lines.append(f'- **标签**: {", ".join(item.tags)}')
                        if item.notes:
                            lines.append(f'- **备注**: {item.notes}')
                        lines.append('')
                    
                    lines.append('')
        
        lines.append('---')
        lines.append('')
        
        lines.append('## 二、报失记录清单')
        lines.append('')
        
        if not lost_reports:
            lines.append('暂无报失记录。')
        else:
            status_groups = {}
            for report in lost_reports:
                if report.status not in status_groups:
                    status_groups[report.status] = []
                status_groups[report.status].append(report)
            
            status_order = ['active', 'found', 'closed', 'withdrawn']
            status_names = {
                'active': '寻找中',
                'found': '已找到',
                'closed': '已关闭',
                'withdrawn': '已撤销'
            }
            
            for status in status_order:
                if status in status_groups:
                    reports = status_groups[status]
                    lines.append(f'### {status_names.get(status, status)} ({len(reports)}条)')
                    lines.append('')
                    
                    for i, report in enumerate(reports, 1):
                        lines.append(f'#### {i}. {report.title}')
                        lines.append(f'')
                        lines.append(f'- **报失ID**: {report.report_id}')
                        lines.append(f'- **描述**: {report.description or "无"}')
                        lines.append(f'- **遗失地点**: {report.location or "未知"}')
                        lines.append(f'- **遗失日期**: {report.lost_date or "未知"}')
                        lines.append(f'- **报失人**: {report.reporter or "未知"}')
                        lines.append(f'- **联系方式**: {report.contact or "无"}')
                        if report.tags:
                            lines.append(f'- **标签**: {", ".join(report.tags)}')
                        if report.notes:
                            lines.append(f'- **备注**: {report.notes}')
                        lines.append('')
                    
                    lines.append('')
        
        lines.append('---')
        lines.append('')
        
        lines.append('## 三、领取记录清单')
        lines.append('')
        
        if not claim_records:
            lines.append('暂无领取记录。')
        else:
            for i, record in enumerate(claim_records, 1):
                status_names = {
                    'pending': '待确认',
                    'confirmed': '已确认',
                    'rejected': '已拒绝',
                    'returned': '已归还'
                }
                status_display = status_names.get(record.status, record.status)
                
                lines.append(f'### 领取记录 #{i}')
                lines.append(f'')
                lines.append(f'- **领取ID**: {record.claim_id}')
                lines.append(f'- **关联物品ID**: {record.item_id or "无"}')
                lines.append(f'- **关联报失ID**: {record.report_id or "无"}')
                lines.append(f'- **领取人**: {record.claimant or "未知"}')
                lines.append(f'- **联系方式**: {record.claimant_contact or "无"}')
                lines.append(f'- **认领日期**: {record.claim_date or "未知"}')
                lines.append(f'- **状态**: {status_display}')
                if record.confirmed_by:
                    lines.append(f'- **确认人**: {record.confirmed_by}')
                if record.return_date:
                    lines.append(f'- **归还日期**: {record.return_date}')
                if record.notes:
                    lines.append(f'- **备注**: {record.notes}')
                lines.append('')
        
        lines.append('---')
        lines.append('')
        lines.append('*本清单由失物招领管理系统自动生成*')
        
        return '\n'.join(lines)


class JSONExporter:
    def export(self,
               found_items: List[FoundItem],
               lost_reports: List[LostReport],
               claim_records: List[ClaimRecord]) -> str:
        data = {
            'export_info': {
                'export_time': datetime.now().isoformat(),
                'version': '1.0'
            },
            'statistics': {
                'found_items_count': len(found_items),
                'lost_reports_count': len(lost_reports),
                'claim_records_count': len(claim_records)
            },
            'found_items': [item.to_dict() for item in found_items],
            'lost_reports': [report.to_dict() for report in lost_reports],
            'claim_records': [record.to_dict() for record in claim_records]
        }
        
        return json.dumps(data, ensure_ascii=False, indent=2)
