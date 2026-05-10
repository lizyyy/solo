from typing import List, Optional
from datetime import date

from core.ledger import FarmerLedger, LedgerEntry, SaleSettlement


def format_currency(amount: float) -> str:
    return f'¥{amount:,.2f}'


def format_error(result, header: str = '验证失败') -> str:
    lines = []
    lines.append(f'⚠️  {header}')
    if result.raw_input:
        lines.append(f'  原始输入: {result.raw_input}')
    
    if result.errors:
        lines.append('  ❌ 错误:')
        for err in result.errors:
            if '重复' in err or '已存在' in err:
                lines.append(f'      [规则拦截] {err}')
            elif '缺少' in err or '不存在' in err:
                lines.append(f'      [数据缺失] {err}')
            elif '超过' in err or '格式错误' in err or '必须' in err:
                lines.append(f'      [状态冲突] {err}')
            else:
                lines.append(f'      {err}')
    
    if result.warnings:
        lines.append('  ⚠️ 警告:')
        for warn in result.warnings:
            lines.append(f'      {warn}')
    
    return '\n'.join(lines)


def format_ledger(ledger: FarmerLedger) -> str:
    lines = []
    
    farmer = ledger.farmer
    lines.append('=' * 80)
    lines.append(f'  农户账本 - {farmer.name}')
    lines.append(f'  电话: {farmer.phone}  |  村: {farmer.village}  |  地址: {farmer.address}')
    lines.append('=' * 80)
    
    lines.append('')
    lines.append('  ┌──────────────────────────────────────────────────────────────────────┐')
    lines.append('  │                        账 户 概 况                                    │')
    lines.append('  ├──────────────────────────────────────────────────────────────────────┤')
    lines.append(f'  │  累计赊销: {format_currency(ledger.total_sales):>65s}  │')
    lines.append(f'  │  累计退货: {format_currency(ledger.total_returns):>65s}  │')
    lines.append(f'  │  累计抵扣: {format_currency(ledger.total_deductions):>65s}  │')
    lines.append(f'  │  累计回款: {format_currency(ledger.total_payments):>65s}  │')
    lines.append('  ├──────────────────────────────────────────────────────────────────────┤')
    lines.append(f'  │  当前欠款: {format_currency(ledger.total_balance):>64s}  │')
    lines.append('  └──────────────────────────────────────────────────────────────────────┘')
    
    lines.append('')
    lines.append('  ┌──────────────────────────────────────────────────────────────────────┐')
    lines.append('  │                        明 细 账 单                                    │')
    lines.append('  ├────────────┬──────┬─────────────────────────────────┬─────────┬─────────┬─────────┤')
    lines.append('  │    日期    │ 类型 │            摘要                 │  借方   │  贷方   │  余额   │')
    lines.append('  ├────────────┼──────┼─────────────────────────────────┼─────────┼─────────┼─────────┤')
    
    for entry in ledger.ledger_entries:
        debit = format_currency(entry.debit) if entry.debit > 0 else '       '
        credit = format_currency(entry.credit) if entry.credit > 0 else '       '
        balance = format_currency(entry.balance)
        
        desc = entry.description[:32]
        if len(entry.description) > 32:
            desc = entry.description[:29] + '...'
        
        type_map = {'赊销': '赊销', '回款': '回款', '退货': '退货', '抵扣': '抵扣'}
        type_str = type_map.get(entry.type, entry.type)
        
        lines.append(f'  │ {entry.date:10s} │ {type_str:4s} │ {desc:31s} │ {debit:>7s} │ {credit:>7s} │ {balance:>7s} │')
    
    lines.append('  └────────────┴──────┴─────────────────────────────────┴─────────┴─────────┴─────────┘')
    
    if ledger.sale_settlements:
        lines.append('')
        lines.append('  ┌──────────────────────────────────────────────────────────────────────┐')
        lines.append('  │                        赊 销 单 结 算                                  │')
        lines.append('  ├────────────┬────────────┬────────────┬─────────┬─────────┬─────────┤')
        lines.append('  │  赊销日期  │  到期日期  │   总额     │  已退货  │  已回款  │  欠款   │')
        lines.append('  ├────────────┼────────────┼────────────┼─────────┼─────────┼─────────┤')
        
        for settlement in ledger.sale_settlements:
            sale = settlement.sale
            due_date = sale.due_date or '   -   '
            overdue_tag = ''
            
            if settlement.overdue_info:
                days = settlement.overdue_info.days_overdue
                if settlement.overdue_info.cross_season:
                    seasons = '+'.join(settlement.overdue_info.overdue_seasons)
                    overdue_tag = f' [⚠️逾期{days}天|跨{seasons}]'
                else:
                    overdue_tag = f' [⚠️逾期{days}天]'
            
            lines.append(f'  │ {sale.sale_date:10s} │ {due_date:10s} │ {format_currency(settlement.total_amount):>10s} │ {format_currency(settlement.returned_amount):>7s} │ {format_currency(settlement.paid_amount):>7s} │ {format_currency(settlement.balance):>7s} │{overdue_tag}')
        
        lines.append('  └────────────┴────────────┴────────────┴─────────┴─────────┴─────────┘')
    
    if ledger.overdue_info:
        lines.append('')
        lines.append('  ⚠️  逾期提醒:')
        for info in ledger.overdue_info:
            if info.cross_season:
                seasons = '+'.join(info.overdue_seasons)
                lines.append(f'      [严重] 赊销单 {info.sale_id[:8]}... 逾期 {info.days_overdue} 天，跨{seasons}，尚欠 {format_currency(info.overdue_amount)}')
            else:
                lines.append(f'      [注意] 赊销单 {info.sale_id[:8]}... 逾期 {info.days_overdue} 天，尚欠 {format_currency(info.overdue_amount)}')
    
    lines.append('=' * 80)
    return '\n'.join(lines)


def format_collection_list(collection_list: List[dict]) -> str:
    if not collection_list:
        return '🎉 恭喜！目前没有需要催收的农户。'
    
    lines = []
    lines.append('=' * 80)
    lines.append('  催 收 清 单')
    lines.append('=' * 80)
    
    lines.append('')
    lines.append('  ┌──────────┬─────────┬──────────────┬─────────┬─────────┬────────┬──────────────┐')
    lines.append('  │  农户    │  电话   │    村庄      │  总欠款  │ 逾期数  │ 最长   │    状态      │')
    lines.append('  │  姓名    │         │              │          │  (笔)   │ 逾期   │              │')
    lines.append('  │          │         │              │          │         │ 天数   │              │')
    lines.append('  ├──────────┼─────────┼──────────────┼─────────┼─────────┼────────┼──────────────┤')
    
    for item in collection_list:
        status = '正常'
        status_color = ''
        
        if item['has_cross_season']:
            status = '⚠️ 跨季逾期'
        elif item['max_days_overdue'] > 30:
            status = '⚠️ 严重逾期'
        elif item['max_days_overdue'] > 0:
            status = '⚠️ 逾期'
        
        village = item['village'][:10] if item['village'] else '-'
        
        lines.append(f'  │ {item["farmer_name"]:8s} │ {item["phone"]:9s} │ {village:12s} │ {format_currency(item["total_balance"]):>7s} │ {item["overdue_count"]:7d} │ {item["max_days_overdue"]:6d} │ {status:12s} │')
    
    lines.append('  └──────────┴─────────┴──────────────┴─────────┴─────────┴────────┴──────────────┘')
    
    total_debt = sum(item['total_balance'] for item in collection_list)
    total_overdue = sum(item['total_overdue'] for item in collection_list)
    
    lines.append('')
    lines.append(f'  📊 统计: 农户 {len(collection_list)} 户, 总欠款 {format_currency(total_debt)}, 逾期金额 {format_currency(total_overdue)}')
    
    return '\n'.join(lines)


def format_report(ledger: FarmerLedger) -> str:
    lines = []
    
    farmer = ledger.farmer
    lines.append('# 农户对账报告')
    lines.append('')
    lines.append(f'**农户姓名:** {farmer.name}')
    lines.append(f'**联系电话:** {farmer.phone}')
    lines.append(f'**所在村庄:** {farmer.village}')
    lines.append(f'**详细地址:** {farmer.address}')
    lines.append(f'**报告日期:** {date.today().isoformat()}')
    lines.append('')
    
    lines.append('## 账户概况')
    lines.append('')
    lines.append('| 项目 | 金额 |')
    lines.append('|------|------|')
    lines.append(f'| 累计赊销 | {format_currency(ledger.total_sales)} |')
    lines.append(f'| 累计退货 | {format_currency(ledger.total_returns)} |')
    lines.append(f'| 累计抵扣 | {format_currency(ledger.total_deductions)} |')
    lines.append(f'| 累计回款 | {format_currency(ledger.total_payments)} |')
    lines.append(f'| **当前欠款** | **{format_currency(ledger.total_balance)}** |')
    lines.append('')
    
    lines.append('## 明细账单')
    lines.append('')
    lines.append('| 日期 | 类型 | 摘要 | 借方(应收) | 贷方(已收) | 余额 |')
    lines.append('|------|------|------|-----------|-----------|------|')
    
    for entry in ledger.ledger_entries:
        debit = format_currency(entry.debit) if entry.debit > 0 else '-'
        credit = format_currency(entry.credit) if entry.credit > 0 else '-'
        lines.append(f'| {entry.date} | {entry.type} | {entry.description} | {debit} | {credit} | {format_currency(entry.balance)} |')
    
    lines.append('')
    
    if ledger.overdue_info:
        lines.append('## 逾期提醒')
        lines.append('')
        for info in ledger.overdue_info:
            if info.cross_season:
                seasons = '+'.join(info.overdue_seasons)
                lines.append(f'- **[严重]** 赊销单 `{info.sale_id[:8]}...` 逾期 {info.days_overdue} 天，跨越 {seasons}，尚欠 {format_currency(info.overdue_amount)}')
            else:
                lines.append(f'- **[注意]** 赊销单 `{info.sale_id[:8]}...` 逾期 {info.days_overdue} 天，尚欠 {format_currency(info.overdue_amount)}')
        lines.append('')
    
    lines.append('---')
    lines.append('*本报告由农资赊销回款系统自动生成*')
    
    return '\n'.join(lines)
