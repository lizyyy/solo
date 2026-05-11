import click
import os
import pandas as pd
from tabulate import tabulate
from src.database import get_session, init_db
from src.billing import (
    calculate_record_total,
    calculate_farmer_total,
    calculate_village_summary
)
from src.models import WorkRecord, Farmer, HistoricalDebt, Correction


@click.group()
def export_cmd():
    """报表导出命令"""
    pass


@export_cmd.command('village')
@click.argument('output_path', type=click.Path())
@click.option('--village', help='指定村名（不指定则导出所有村）')
@click.option('--format', 'fmt', default='excel', type=click.Choice(['excel', 'csv']), help='输出格式')
@click.option('--include-details', is_flag=True, help='包含明细数据')
def export_village(output_path, village, fmt, include_details):
    """导出村级汇总报表"""
    init_db()
    session = get_session()
    
    try:
        summary = calculate_village_summary(session, village, include_finalized_only=True)
        
        if not summary:
            click.echo('没有数据可导出')
            return
        
        summary_df = pd.DataFrame(summary)
        summary_df = summary_df.rename(columns={
            'village': '村',
            'farmer_count': '农户数',
            'record_count': '记录数',
            'work_fee': '作业费',
            'oil_subsidy': '油补',
            'historical_debt': '历史欠款',
            'total_amount': '累计应付'
        })
        
        all_dfs = {'村级汇总': summary_df}
        
        if include_details:
            farmers = session.query(Farmer).all()
            if village:
                farmers = [f for f in farmers if f.village == village]
            
            farmer_details = []
            record_details = []
            
            for farmer in farmers:
                totals = calculate_farmer_total(
                    session, 
                    farmer.id, 
                    include_confirmed_only=True,
                    include_finalized_only=True
                )
                farmer_details.append({
                    '村': farmer.village or '未分配',
                    '农户': farmer.name,
                    '电话': farmer.phone or '',
                    '作业费': totals['work_fee'],
                    '油补': totals['oil_subsidy'],
                    '本期实付': totals['current_actual_fee'],
                    '历史欠款': totals['historical_debt'],
                    '累计应付': totals['total_amount']
                })
                
                records = session.query(WorkRecord).filter(
                    WorkRecord.farmer_id == farmer.id,
                    WorkRecord.is_finalized == True
                ).all()
                
                for record in records:
                    fees = calculate_record_total(session, record)
                    record_details.append({
                        '村': farmer.village or '未分配',
                        '农户': farmer.name,
                        '地块': record.plot.plot_name if record.plot else '未知',
                        '作业类型': record.work_type.name if record.work_type else '未知',
                        '作业日期': record.work_date,
                        '面积': record.area,
                        '单位': record.area_unit,
                        '作业费': fees['work_fee'],
                        '油补': fees['oil_subsidy'],
                        '实付': fees['actual_fee'],
                        '确认人': record.confirmed_by or '',
                        '结算人': record.finalized_by or '',
                        '来源': record.source or ''
                    })
            
            if farmer_details:
                all_dfs['农户明细'] = pd.DataFrame(farmer_details)
            if record_details:
                all_dfs['作业明细'] = pd.DataFrame(record_details)
        
        if fmt == 'excel':
            if not output_path.endswith('.xlsx'):
                output_path += '.xlsx'
            
            with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
                for sheet_name, df in all_dfs.items():
                    df.to_excel(writer, sheet_name=sheet_name, index=False)
        else:
            if not output_path.endswith('.csv'):
                output_path += '.csv'
            summary_df.to_csv(output_path, index=False, encoding='utf-8-sig')
            
            if include_details:
                base_path = output_path.rsplit('.', 1)[0]
                if '农户明细' in all_dfs:
                    all_dfs['农户明细'].to_csv(f'{base_path}_farmers.csv', index=False, encoding='utf-8-sig')
                if '作业明细' in all_dfs:
                    all_dfs['作业明细'].to_csv(f'{base_path}_records.csv', index=False, encoding='utf-8-sig')
        
        click.echo(f'✅ 报表已导出到: {output_path}')
        click.echo(f'   包含 {len(summary)} 个村的数据')
        
    finally:
        session.close()


@export_cmd.command('farmer')
@click.argument('farmer_name')
@click.argument('output_path', type=click.Path())
@click.option('--format', 'fmt', default='excel', type=click.Choice(['excel', 'csv']), help='输出格式')
def export_farmer(farmer_name, output_path, fmt):
    """导出单个农户的详细账单"""
    init_db()
    session = get_session()
    
    try:
        farmer = session.query(Farmer).filter(Farmer.name == farmer_name).first()
        if not farmer:
            click.echo(f'错误: 找不到农户 "{farmer_name}"')
            return
        
        totals = calculate_farmer_total(session, farmer.id, include_confirmed_only=True)
        
        records = session.query(WorkRecord).filter(
            WorkRecord.farmer_id == farmer.id
        ).order_by(WorkRecord.work_date).all()
        
        debts = session.query(HistoricalDebt).filter(
            HistoricalDebt.farmer_id == farmer.id
        ).all()
        
        corrections = session.query(Correction).join(WorkRecord).filter(
            WorkRecord.farmer_id == farmer.id
        ).all()
        
        summary_data = [{
            '项目': '农户姓名',
            '值': farmer.name
        }, {
            '项目': '所在村',
            '值': farmer.village or '未分配'
        }, {
            '项目': '联系电话',
            '值': farmer.phone or ''
        }, {
            '项目': '本期作业费',
            '值': f'¥{totals["work_fee"]:.2f}'
        }, {
            '项目': '本期油补',
            '值': f'¥{totals["oil_subsidy"]:.2f}'
        }, {
            '项目': '本期实际应付',
            '值': f'¥{totals["current_actual_fee"]:.2f}'
        }, {
            '项目': '历史欠款',
            '值': f'¥{totals["historical_debt"]:.2f}'
        }, {
            '项目': '累计应付款',
            '值': f'¥{totals["total_amount"]:.2f}'
        }]
        
        summary_df = pd.DataFrame(summary_data)
        
        records_data = []
        for record in records:
            fees = calculate_record_total(session, record)
            records_data.append({
                '记录ID': record.id,
                '地块': record.plot.plot_name if record.plot else '未知',
                '作业类型': record.work_type.name if record.work_type else '未知',
                '作业日期': record.work_date,
                '面积': record.area,
                '单位': record.area_unit,
                '作业费': fees['work_fee'],
                '油补': fees['oil_subsidy'],
                '实付': fees['actual_fee'],
                '机手': record.operator_name or '',
                '机械': record.machine_name or '',
                '已确认': '是' if record.is_confirmed else '否',
                '已结算': '是' if record.is_finalized else '否',
                '来源': record.source or ''
            })
        records_df = pd.DataFrame(records_data) if records_data else pd.DataFrame()
        
        debts_data = []
        for debt in debts:
            debts_data.append({
                '欠款日期': debt.debt_date or '',
                '金额': debt.amount,
                '说明': debt.description or '',
                '来源': debt.source or ''
            })
        debts_df = pd.DataFrame(debts_data) if debts_data else pd.DataFrame()
        
        corrections_data = []
        for corr in corrections:
            corrections_data.append({
                '记录ID': corr.work_record_id,
                '修改字段': corr.field_name,
                '原值': corr.old_value,
                '新值': corr.new_value,
                '操作人': corr.corrected_by or '',
                '原因': corr.reason or '',
                '修改时间': corr.created_at
            })
        corrections_df = pd.DataFrame(corrections_data) if corrections_data else pd.DataFrame()
        
        all_dfs = {
            '账单概览': summary_df,
            '作业明细': records_df,
            '历史欠款': debts_df,
            '修正记录': corrections_df
        }
        
        if fmt == 'excel':
            if not output_path.endswith('.xlsx'):
                output_path += '.xlsx'
            
            with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
                for sheet_name, df in all_dfs.items():
                    if not df.empty:
                        df.to_excel(writer, sheet_name=sheet_name, index=False)
        else:
            if not output_path.endswith('.csv'):
                output_path += '.csv'
            summary_df.to_csv(output_path, index=False, encoding='utf-8-sig')
            
            base_path = output_path.rsplit('.', 1)[0]
            if not records_df.empty:
                records_df.to_csv(f'{base_path}_records.csv', index=False, encoding='utf-8-sig')
            if not debts_df.empty:
                debts_df.to_csv(f'{base_path}_debts.csv', index=False, encoding='utf-8-sig')
            if not corrections_df.empty:
                corrections_df.to_csv(f'{base_path}_corrections.csv', index=False, encoding='utf-8-sig')
        
        click.echo(f'✅ 农户账单已导出到: {output_path}')
        click.echo(f'   农户: {farmer.name}')
        click.echo(f'   累计应付款: ¥{totals["total_amount"]:.2f}')
        
    finally:
        session.close()


@export_cmd.command('audit')
@click.argument('output_path', type=click.Path())
@click.option('--days', type=int, help='最近N天的日志')
@click.option('--format', 'fmt', default='excel', type=click.Choice(['excel', 'csv']), help='输出格式')
def export_audit(output_path, days, fmt):
    """导出审计日志（供会计复查）"""
    init_db()
    session = get_session()
    
    try:
        from src.models import AuditLog
        from datetime import datetime, timedelta
        
        query = session.query(AuditLog).order_by(AuditLog.created_at.desc())
        
        if days:
            cutoff = datetime.now() - timedelta(days=days)
            query = query.filter(AuditLog.created_at >= cutoff)
        
        logs = query.all()
        
        if not logs:
            click.echo('没有审计日志')
            return
        
        log_data = []
        for log in logs:
            log_data.append({
                '日志ID': log.id,
                '操作类型': log.action,
                '表名': log.table_name or '',
                '记录ID': log.record_id or '',
                '详情': log.details or '',
                '操作人': log.operator or '',
                '操作时间': log.created_at
            })
        
        df = pd.DataFrame(log_data)
        
        if fmt == 'excel':
            if not output_path.endswith('.xlsx'):
                output_path += '.xlsx'
            df.to_excel(output_path, index=False)
        else:
            if not output_path.endswith('.csv'):
                output_path += '.csv'
            df.to_csv(output_path, index=False, encoding='utf-8-sig')
        
        click.echo(f'✅ 审计日志已导出到: {output_path}')
        click.echo(f'   共 {len(logs)} 条记录')
        
    finally:
        session.close()
