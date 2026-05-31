"""
对账说明导出模块
生成带处理口径的对账说明文档
"""
import pandas as pd
from datetime import datetime
from typing import Dict, List, Tuple
import io

from .models import RecordStatus


class ReconciliationReport:
    def __init__(self):
        self.processing_rules = {
            '确认规则': '交易流水与结算记录金额差异在0.01元以内视为已确认',
            '待补充规则': '缺少关键信息或无法匹配的交易标记为待补充',
            '人工修改规则': '经人工核实并修改的记录需标注修改原因',
            '重复入账规则': '同日同商户同金额同订单号视为重复入账风险',
            '手续费跨期规则': '每月25日之后产生的手续费视为跨期手续费',
            '沉淀计算规则': '期末沉淀 = 期初余额 + 本期存款 - 本期结算 - 本期手续费'
        }

    def generate_reconciliation_statement(
        self,
        period: str,
        summary: Dict,
        confirmed_txns: List[Dict],
        pending_txns: List[Dict],
        modified_txns: List[Dict],
        duplicate_txns: List[Dict]
    ) -> Dict:
        statement = {
            '报告标题': '预付卡沉淀核对说明',
            '核对期间': period,
            '生成时间': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            '处理口径': self.processing_rules,
            '汇总统计': {
                '交易总笔数': summary.get('total_transactions', 0),
                '已确认笔数': len(confirmed_txns),
                '待补充笔数': len(pending_txns),
                '人工修改笔数': len(modified_txns),
                '重复入账风险笔数': len(duplicate_txns),
                '交易总金额': summary.get('total_deposit', 0),
                '手续费总额': summary.get('total_fee', 0),
                '期末沉淀金额': summary.get('closing_balance', 0)
            },
            '已确认交易明细': confirmed_txns,
            '待补充交易明细': pending_txns,
            '人工修改交易明细': modified_txns,
            '重复入账风险明细': duplicate_txns,
            '复核意见': '',
            '复核人': '',
            '复核日期': ''
        }
        return statement

    def export_statement_to_excel(
        self,
        statement: Dict,
        file_path: str
    ) -> str:
        with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
            pd.DataFrame([{
                '项目': '报告标题',
                '内容': statement['报告标题']
            }, {
                '项目': '核对期间',
                '内容': statement['核对期间']
            }, {
                '项目': '生成时间',
                '内容': statement['生成时间']
            }]).to_excel(writer, sheet_name='报告封面', index=False)

            rules_df = pd.DataFrame([
                {'规则名称': k, '规则说明': v}
                for k, v in statement['处理口径'].items()
            ])
            rules_df.to_excel(writer, sheet_name='处理口径', index=False)

            summary_df = pd.DataFrame([
                {'统计项': k, '数值': v}
                for k, v in statement['汇总统计'].items()
            ])
            summary_df.to_excel(writer, sheet_name='汇总统计', index=False)

            if statement['已确认交易明细']:
                pd.DataFrame(statement['已确认交易明细']).to_excel(
                    writer, sheet_name='已确认交易', index=False
                )

            if statement['待补充交易明细']:
                pd.DataFrame(statement['待补充交易明细']).to_excel(
                    writer, sheet_name='待补充交易', index=False
                )

            if statement['人工修改交易明细']:
                pd.DataFrame(statement['人工修改交易明细']).to_excel(
                    writer, sheet_name='人工修改记录', index=False
                )

            if statement['重复入账风险明细']:
                pd.DataFrame(statement['重复入账风险明细']).to_excel(
                    writer, sheet_name='重复入账风险', index=False
                )

            pd.DataFrame([{
                '复核意见': statement['复核意见'],
                '复核人': statement['复核人'],
                '复核日期': statement['复核日期']
            }]).to_excel(writer, sheet_name='复核记录', index=False)

        return file_path

    def categorize_transactions(
        self,
        txns_df: pd.DataFrame
    ) -> Tuple[List[Dict], List[Dict], List[Dict], List[Dict]]:
        confirmed = []
        pending = []
        modified = []
        duplicates = []

        for _, row in txns_df.iterrows():
            txn_dict = row.to_dict()

            if row.get('状态') == RecordStatus.CONFIRMED.value:
                confirmed.append(txn_dict)
            elif row.get('状态') == RecordStatus.PENDING.value:
                pending.append(txn_dict)
            elif row.get('状态') == RecordStatus.MANUAL_MODIFIED.value:
                modified.append(txn_dict)

            if row.get('是否重复') == '是':
                duplicates.append(txn_dict)

        return confirmed, pending, modified, duplicates

    def get_duplicate_analysis(self, duplicate_txns: List[Dict]) -> str:
        if not duplicate_txns:
            return "无重复入账风险记录"

        analysis = f"发现 {len(duplicate_txns)} 笔重复入账风险记录：\n"
        for txn in duplicate_txns[:5]:
            analysis += (
                f"- 流水号: {txn.get('交易流水号')}, "
                f"日期: {txn.get('交易日期')}, "
                f"金额: {txn.get('交易金额')}, "
                f"商户: {txn.get('商户名称')}, "
                f"重复流水: {txn.get('重复流水号')}\n"
            )
        if len(duplicate_txns) > 5:
            analysis += f"... 还有 {len(duplicate_txns) - 5} 笔\n"

        return analysis
