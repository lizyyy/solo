import os
from datetime import date, datetime
from typing import Dict, List
import pandas as pd
from .storage import Storage
from .business import PropDepositManager
from .config import REPORTS_DIR
from .models import PropStatus, BorrowStatus, DamageLevel


class ReportGenerator:
    def __init__(self, storage: Storage, manager: PropDepositManager):
        self.storage = storage
        self.manager = manager
        os.makedirs(REPORTS_DIR, exist_ok=True)
    
    def generate_deposit_summary_report(self) -> str:
        summary = self.manager.get_deposit_summary()
        
        report_data = [
            {'指标': '道具总数', '数值': summary['total_props']},
            {'指标': '借用单总数', '数值': summary['total_borrows']},
            {'指标': '活动借用', '数值': summary['active_borrows']},
            {'指标': '逾期借用', '数值': summary['overdue_borrows']},
            {'指标': '冻结押金总额', '数值': f"¥{summary['total_deposit_frozen']:,.2f}"},
            {'指标': '损坏费用总额', '数值': f"¥{summary['total_damage_fees']:,.2f}"},
            {'指标': '延期费用总额', '数值': f"¥{summary['total_delay_fees']:,.2f}"},
            {'指标': '退款总额', '数值': f"¥{summary['total_refunds']:,.2f}"},
            {'指标': '待结算借用单', '数值': summary['pending_settlements']}
        ]
        
        df = pd.DataFrame(report_data)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'deposit_summary_{timestamp}.xlsx'
        filepath = os.path.join(REPORTS_DIR, filename)
        
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='汇总统计', index=False)
            
            props_df = pd.DataFrame([
                {
                    '道具ID': p.prop_id,
                    '名称': p.name,
                    '分类': p.category,
                    '价值': p.value,
                    '押金比例': p.deposit_rate,
                    '所需押金': p.required_deposit(),
                    '状态': p.status.value,
                    '存放位置': p.location
                }
                for p in self.storage.get_all_props()
            ])
            if not props_df.empty:
                props_df.to_excel(writer, sheet_name='道具清单', index=False)
            
            borrows_df = pd.DataFrame([
                {
                    '借用单ID': b.borrow_id,
                    '道具ID': b.prop_id,
                    '剧组': b.crew_name,
                    '借用日期': b.borrow_date,
                    '计划归还': b.scheduled_return_date,
                    '实际归还': b.actual_return_date,
                    '所需押金': b.required_deposit,
                    '已交押金': b.deposit_paid,
                    '损坏费': b.damage_fee,
                    '延期费': b.delay_fee,
                    '退款': b.refund_amount,
                    '状态': b.status.value
                }
                for b in self.storage.get_all_borrows()
            ])
            if not borrows_df.empty:
                borrows_df.to_excel(writer, sheet_name='借用记录', index=False)
        
        return filepath
    
    def generate_overdue_report(self) -> str:
        from .models import BorrowStatus
        
        overdue_borrows = [
            b for b in self.storage.get_all_borrows()
            if b.status == BorrowStatus.OVERDUE
        ]
        
        overdue_data = []
        for b in overdue_borrows:
            prop = self.storage.get_prop(b.prop_id)
            prop_name = prop.name if prop else '未知道具'
            overdue_days = (date.today() - b.scheduled_return_date).days
            estimated_delay_fee = b.required_deposit * 0.1 * overdue_days
            
            overdue_data.append({
                '借用单ID': b.borrow_id,
                '道具ID': b.prop_id,
                '道具名称': prop_name,
                '剧组': b.crew_name,
                '借用日期': b.borrow_date,
                '计划归还': b.scheduled_return_date,
                '逾期天数': overdue_days,
                '已交押金': b.deposit_paid,
                '预计延期费': estimated_delay_fee
            })
        
        df = pd.DataFrame(overdue_data)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'overdue_report_{timestamp}.xlsx'
        filepath = os.path.join(REPORTS_DIR, filename)
        
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            if df.empty:
                pd.DataFrame({'提示': ['当前无逾期借用单']}).to_excel(writer, sheet_name='逾期清单', index=False)
            else:
                df.to_excel(writer, sheet_name='逾期清单', index=False)
                
                summary_data = [
                    {'指标': '逾期借用单数量', '数值': len(overdue_data)},
                    {'指标': '涉及剧组数', '数值': len(set(b['剧组'] for b in overdue_data))},
                    {'指标': '预计延期费总额', '数值': f"¥{sum(b['预计延期费'] for b in overdue_data):,.2f}"}
                ]
                pd.DataFrame(summary_data).to_excel(writer, sheet_name='汇总', index=False)
        
        return filepath
    
    def generate_damage_report(self) -> str:
        from .models import BorrowStatus, DamageLevel
        
        damaged_borrows = [
            b for b in self.storage.get_all_borrows()
            if b.damage_level != DamageLevel.NONE and b.damage_fee > 0
        ]
        
        damage_data = []
        for b in damaged_borrows:
            prop = self.storage.get_prop(b.prop_id)
            prop_name = prop.name if prop else '未知道具'
            prop_value = prop.value if prop else 0
            
            damage_level_cn = {
                'minor': '轻微损坏',
                'major': '严重损坏',
                'total': '报废'
            }.get(b.damage_level.value, b.damage_level.value)
            
            damage_data.append({
                '借用单ID': b.borrow_id,
                '道具ID': b.prop_id,
                '道具名称': prop_name,
                '道具价值': prop_value,
                '剧组': b.crew_name,
                '损坏程度': damage_level_cn,
                '损坏费用': b.damage_fee,
                '借用状态': b.status.value
            })
        
        df = pd.DataFrame(damage_data)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'damage_report_{timestamp}.xlsx'
        filepath = os.path.join(REPORTS_DIR, filename)
        
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            if df.empty:
                pd.DataFrame({'提示': ['当前无损坏记录']}).to_excel(writer, sheet_name='损坏清单', index=False)
            else:
                df.to_excel(writer, sheet_name='损坏清单', index=False)
                
                summary_data = [
                    {'指标': '损坏借用单数量', '数值': len(damage_data)},
                    {'指标': '损坏费用总额', '数值': f"¥{sum(b['损坏费用'] for b in damage_data):,.2f}"},
                    {'指标': '轻微损坏', '数值': len([b for b in damaged_borrows if b.damage_level == DamageLevel.MINOR])},
                    {'指标': '严重损坏', '数值': len([b for b in damaged_borrows if b.damage_level == DamageLevel.MAJOR])},
                    {'指标': '报废', '数值': len([b for b in damaged_borrows if b.damage_level == DamageLevel.TOTAL])}
                ]
                pd.DataFrame(summary_data).to_excel(writer, sheet_name='汇总', index=False)
        
        return filepath
    
    def generate_problems_report(self, include_fixed: bool = False) -> str:
        problems = self.storage.get_all_problems(include_fixed=include_fixed)
        
        problems_data = []
        for p in problems:
            problems_data.append({
                '问题ID': p.problem_id,
                '来源文件': p.source_file,
                '行号': p.line_number,
                '错误类型': p.error_type,
                '错误信息': p.error_message,
                '原始数据': str(p.data),
                '已修复': '是' if p.fixed else '否',
                '创建时间': p.created_at
            })
        
        df = pd.DataFrame(problems_data)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'problems_report_{timestamp}.xlsx'
        filepath = os.path.join(REPORTS_DIR, filename)
        
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            if df.empty:
                pd.DataFrame({'提示': ['当前无问题记录']}).to_excel(writer, sheet_name='问题清单', index=False)
            else:
                df.to_excel(writer, sheet_name='问题清单', index=False)
                
                error_type_counts = pd.Series([p.error_type for p in problems]).value_counts().reset_index()
                error_type_counts.columns = ['错误类型', '数量']
                error_type_counts.to_excel(writer, sheet_name='错误类型统计', index=False)
        
        return filepath
    
    def generate_business_summary_for_manager(self) -> str:
        summary = self.manager.get_deposit_summary()
        consistency = self.manager.run_consistency_check()
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'business_summary_{timestamp}.xlsx'
        filepath = os.path.join(REPORTS_DIR, filename)
        
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            overview_data = [
                {'项目': '道具总数', '数值': summary['total_props']},
                {'项目': '借用单总数', '数值': summary['total_borrows']},
                {'项目': '活动借用', '数值': summary['active_borrows']},
                {'项目': '逾期借用', '数值': summary['overdue_borrows']},
                {'项目': '冻结押金总额', '数值': f"¥{summary['total_deposit_frozen']:,.2f}"},
                {'项目': '累计损坏费用', '数值': f"¥{summary['total_damage_fees']:,.2f}"},
                {'项目': '累计延期费用', '数值': f"¥{summary['total_delay_fees']:,.2f}"},
                {'项目': '累计退款', '数值': f"¥{summary['total_refunds']:,.2f}"},
                {'项目': '待结算数量', '数值': summary['pending_settlements']}
            ]
            pd.DataFrame(overview_data).to_excel(writer, sheet_name='概览', index=False)
            
            alerts = []
            if summary['overdue_borrows'] > 0:
                alerts.append({'类型': '警告', '内容': f"有 {summary['overdue_borrows']} 个借用单已逾期"})
            if summary['pending_settlements'] > 0:
                alerts.append({'类型': '提醒', '内容': f"有 {summary['pending_settlements']} 个借用单待结算"})
            
            all_issues = consistency['state_inconsistencies'] + consistency['deposit_issues'] + consistency['borrow_issues']
            for issue in all_issues:
                alerts.append({'类型': '异常', '内容': issue['message']})
            
            if alerts:
                pd.DataFrame(alerts).to_excel(writer, sheet_name='警告与异常', index=False)
            
            crew_summary = {}
            for borrow in self.storage.get_all_borrows():
                crew = borrow.crew_name
                if crew not in crew_summary:
                    crew_summary[crew] = {
                        '借用次数': 0,
                        '逾期次数': 0,
                        '损坏次数': 0,
                        '损坏费用': 0,
                        '延期费用': 0,
                        '押金冻结': 0
                    }
                crew_summary[crew]['借用次数'] += 1
                if borrow.status == BorrowStatus.OVERDUE:
                    crew_summary[crew]['逾期次数'] += 1
                if borrow.damage_level != DamageLevel.NONE:
                    crew_summary[crew]['损坏次数'] += 1
                crew_summary[crew]['损坏费用'] += borrow.damage_fee
                crew_summary[crew]['延期费用'] += borrow.delay_fee
                if borrow.status in [BorrowStatus.ACTIVE, BorrowStatus.PENDING, BorrowStatus.OVERDUE]:
                    crew_summary[crew]['押金冻结'] += borrow.deposit_paid
            
            if crew_summary:
                crew_data = []
                for crew, stats in crew_summary.items():
                    crew_data.append({
                        '剧组': crew,
                        '借用次数': stats['借用次数'],
                        '逾期次数': stats['逾期次数'],
                        '损坏次数': stats['损坏次数'],
                        '损坏费用': stats['损坏费用'],
                        '延期费用': stats['延期费用'],
                        '当前冻结押金': stats['押金冻结']
                    })
                pd.DataFrame(crew_data).to_excel(writer, sheet_name='剧组统计', index=False)
        
        return filepath
