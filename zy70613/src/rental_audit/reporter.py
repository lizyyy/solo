import csv
import json
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import List, Dict, Any, Optional
import logging

from .models import (
    RentalOrder, DepositTransaction, DamageItem, RenewalApplication,
    AuditResult, BadRow, SettlementReport
)
from .rules import AuditEngine

logger = logging.getLogger(__name__)


class ReportGenerator:
    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.audit_engine = AuditEngine()

    def generate_audit_report(self,
                             orders: List[RentalOrder],
                             transactions: List[DepositTransaction],
                             damages: List[DamageItem],
                             renewals: List[RenewalApplication],
                             bad_rows: List[BadRow],
                             report_name: Optional[str] = None) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_name = report_name or f"audit_report_{timestamp}"
        
        transactions_by_order: Dict[str, List[DepositTransaction]] = {}
        for t in transactions:
            transactions_by_order.setdefault(t.order_id, []).append(t)
        
        damages_by_order: Dict[str, List[DamageItem]] = {}
        for d in damages:
            damages_by_order.setdefault(d.order_id, []).append(d)
        
        renewals_by_order: Dict[str, List[RenewalApplication]] = {}
        for r in renewals:
            renewals_by_order.setdefault(r.order_id, []).append(r)
        
        audit_results = []
        settlement_details = []
        
        for order in sorted(orders, key=lambda x: x.order_id):
            order_transactions = transactions_by_order.get(order.order_id, [])
            order_damages = damages_by_order.get(order.order_id, [])
            order_renewals = renewals_by_order.get(order.order_id, [])
            
            audit_result = self.audit_engine.audit_order(
                order, order_transactions, order_damages, order_renewals
            )
            audit_results.append(audit_result)
            
            settlement = self.audit_engine.calculate_settlement(
                order, order_transactions, order_damages, order_renewals
            )
            settlement_details.append(settlement)
        
        summary = self._generate_summary(
            orders, transactions, damages, renewals, audit_results, bad_rows
        )
        
        json_path = self._write_json_report(
            report_name, summary, audit_results, settlement_details, bad_rows
        )
        
        csv_path = self._write_csv_report(
            report_name, audit_results, settlement_details
        )
        
        self._write_bad_rows_report(report_name, bad_rows)
        
        logger.info(f"审计报告已生成: {json_path}, {csv_path}")
        
        return str(self.output_dir / report_name)

    def _generate_summary(self,
                         orders: List[RentalOrder],
                         transactions: List[DepositTransaction],
                         damages: List[DamageItem],
                         renewals: List[RenewalApplication],
                         audit_results: List[AuditResult],
                         bad_rows: List[BadRow]) -> Dict[str, Any]:
        total_orders = len(orders)
        total_transactions = len(transactions)
        total_damages = len(damages)
        total_renewals = len(renewals)
        total_bad_rows = len(bad_rows)
        
        passed_orders = sum(1 for r in audit_results if r.overall_passed)
        failed_orders = total_orders - passed_orders
        
        risk_counts = {
            'LOW': sum(1 for r in audit_results if r.risk_level == 'LOW'),
            'MEDIUM': sum(1 for r in audit_results if r.risk_level == 'MEDIUM'),
            'HIGH': sum(1 for r in audit_results if r.risk_level == 'HIGH'),
            'CRITICAL': sum(1 for r in audit_results if r.risk_level == 'CRITICAL')
        }
        
        deposit_issue_count = sum(len(r.deposit_issues) for r in audit_results)
        overdue_issue_count = sum(len(r.overdue_issues) for r in audit_results)
        damage_issue_count = sum(len(r.damage_issues) for r in audit_results)
        renewal_issue_count = sum(len(r.renewal_issues) for r in audit_results)
        
        total_deposit = sum(o.deposit_amount for o in orders)
        total_overdue_charge = sum(
            self.audit_engine.overdue_engine.calculate_overdue_charge(
                o, self.audit_engine.overdue_engine.calculate_overdue_days(
                    o, [r for r in renewals if r.order_id == o.order_id]
                )
            )
            for o in orders
        )
        total_damage_cost = sum(d.repair_cost for d in damages if d.is_verified)
        
        summary = {
            'report_generated_at': datetime.now().isoformat(),
            'total_orders': total_orders,
            'total_transactions': total_transactions,
            'total_damages': total_damages,
            'total_renewals': total_renewals,
            'total_bad_rows': total_bad_rows,
            'audit_results': {
                'passed': passed_orders,
                'failed': failed_orders,
                'pass_rate': f"{(passed_orders / total_orders * 100):.2f}%" if total_orders > 0 else "N/A"
            },
            'risk_distribution': risk_counts,
            'issues_by_category': {
                'deposit_issues': deposit_issue_count,
                'overdue_issues': overdue_issue_count,
                'damage_issues': damage_issue_count,
                'renewal_issues': renewal_issue_count
            },
            'financial_summary': {
                'total_deposit': str(total_deposit),
                'total_overdue_charge': str(total_overdue_charge),
                'total_damage_cost': str(total_damage_cost),
                'total_expected_deductions': str(total_overdue_charge + total_damage_cost)
            }
        }
        
        return summary

    def _write_json_report(self,
                          report_name: str,
                          summary: Dict,
                          audit_results: List[AuditResult],
                          settlement_details: List[Dict],
                          bad_rows: List[BadRow]) -> str:
        def _default(obj):
            if isinstance(obj, Decimal):
                return str(obj)
            if isinstance(obj, datetime):
                return obj.isoformat()
            if hasattr(obj, 'model_dump'):
                return obj.model_dump()
            return str(obj)

        report_data = {
            'summary': summary,
            'audit_results': [r.model_dump() for r in audit_results],
            'settlement_details': settlement_details,
            'bad_rows': [br.model_dump() for br in bad_rows]
        }
        
        file_path = self.output_dir / f"{report_name}.json"
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2, default=_default)
        
        return str(file_path)

    def _write_csv_report(self,
                         report_name: str,
                         audit_results: List[AuditResult],
                         settlement_details: List[Dict]) -> str:
        file_path = self.output_dir / f"{report_name}.csv"
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow([
                '订单ID', '整体通过', '风险等级',
                '押金检查通过', '押金问题数',
                '逾期检查通过', '逾期问题数',
                '损坏检查通过', '损坏问题数',
                '续租检查通过', '续租问题数',
                '原始押金', '逾期天数', '逾期费用',
                '损坏数量', '损坏费用', '扣款总计', '应退押金',
                '推荐操作'
            ])
            
            for i, audit_result in enumerate(sorted(audit_results, key=lambda x: x.order_id)):
                settlement = settlement_details[i]
                
                writer.writerow([
                    audit_result.order_id,
                    '是' if audit_result.overall_passed else '否',
                    audit_result.risk_level,
                    '是' if audit_result.deposit_check_passed else '否',
                    len(audit_result.deposit_issues),
                    '是' if audit_result.overdue_check_passed else '否',
                    len(audit_result.overdue_issues),
                    '是' if audit_result.damage_check_passed else '否',
                    len(audit_result.damage_issues),
                    '是' if audit_result.renewal_check_passed else '否',
                    len(audit_result.renewal_issues),
                    settlement['original_deposit'],
                    settlement['overdue_days'],
                    settlement['overdue_charge'],
                    settlement['damage_count'],
                    settlement['damage_charge'],
                    settlement['total_deductions'],
                    settlement['net_refund'],
                    '; '.join(audit_result.recommended_actions)
                ])
        
        return str(file_path)

    def _write_bad_rows_report(self, report_name: str, bad_rows: List[BadRow]) -> str:
        if not bad_rows:
            return ""
        
        file_path = self.output_dir / f"{report_name}_bad_rows.csv"
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow([
                '文件路径', '行号', '错误类型', '错误信息', '原始数据'
            ])
            
            for bad_row in sorted(bad_rows, key=lambda x: (x.source.file_path, x.source.line_number or 0)):
                writer.writerow([
                    bad_row.source.file_path,
                    bad_row.source.line_number or '',
                    bad_row.error_type,
                    bad_row.error_message,
                    bad_row.raw_data
                ])
        
        return str(file_path)

    def generate_settlement_report(self,
                                   order: RentalOrder,
                                   transactions: List[DepositTransaction],
                                   damages: List[DamageItem],
                                   renewals: List[RenewalApplication],
                                   report_id: Optional[str] = None) -> SettlementReport:
        settlement = self.audit_engine.calculate_settlement(
            order, transactions, damages, renewals
        )
        
        report_id = report_id or f"SETTLE_{order.order_id}_{datetime.now().strftime('%Y%m%d')}"
        
        settlement_report = SettlementReport(
            report_id=report_id,
            order_id=order.order_id,
            report_date=datetime.now(),
            original_deposit=settlement['original_deposit'],
            total_deductions=settlement['total_deductions'],
            overdue_charge=settlement['overdue_charge'],
            damage_charge=settlement['damage_charge'],
            other_charges=settlement['other_charges'],
            net_refund=settlement['net_refund'],
            rental_days_actual=0,
            rental_days_overdue=settlement['overdue_days'],
            damage_count=settlement['damage_count'],
            renewal_count=settlement['renewal_count'],
            transactions=[t.transaction_id for t in transactions],
            damages=[d.damage_id for d in damages],
            renewals=[r.renewal_id for r in renewals]
        )
        
        return settlement_report

    def export_detailed_audit(self,
                            order: RentalOrder,
                            transactions: List[DepositTransaction],
                            damages: List[DamageItem],
                            renewals: List[RenewalApplication]) -> str:
        audit_result = self.audit_engine.audit_order(
            order, transactions, damages, renewals
        )
        
        settlement = self.audit_engine.calculate_settlement(
            order, transactions, damages, renewals
        )
        
        report_content = [
            "=" * 80,
            f"订单详细审计报告",
            "=" * 80,
            "",
            f"订单ID: {order.order_id}",
            f"客户: {order.customer_name} ({order.customer_id})",
            f"设备: {order.equipment_name} ({order.equipment_id})",
            f"租赁时间: {order.rental_start_date} 至 {order.rental_end_date}",
            f"日租金: {order.daily_rate} CNY",
            f"押金金额: {order.deposit_amount} CNY",
            f"订单状态: {order.status.value}",
            f"实际归还日期: {order.actual_return_date or '未归还'}",
            "",
            "-" * 80,
            "审计结果",
            "-" * 80,
            "",
            f"整体通过: {'是' if audit_result.overall_passed else '否'}",
            f"风险等级: {audit_result.risk_level}",
            "",
            f"押金检查: {'通过' if audit_result.deposit_check_passed else '不通过'}",
            *[f"  - {issue}" for issue in audit_result.deposit_issues],
            "",
            f"逾期检查: {'通过' if audit_result.overdue_check_passed else '不通过'}",
            *[f"  - {issue}" for issue in audit_result.overdue_issues],
            "",
            f"损坏检查: {'通过' if audit_result.damage_check_passed else '不通过'}",
            *[f"  - {issue}" for issue in audit_result.damage_issues],
            "",
            f"续租检查: {'通过' if audit_result.renewal_check_passed else '不通过'}",
            *[f"  - {issue}" for issue in audit_result.renewal_issues],
            "",
            "-" * 80,
            "结算明细",
            "-" * 80,
            "",
            f"原始押金: {settlement['original_deposit']} CNY",
            f"逾期天数: {settlement['overdue_days']} 天",
            f"逾期费用: {settlement['overdue_charge']} CNY",
            f"损坏数量: {settlement['damage_count']} 项",
            f"损坏费用: {settlement['damage_charge']} CNY",
            f"其他费用: {settlement['other_charges']} CNY",
            f"扣款总计: {settlement['total_deductions']} CNY",
            f"应退押金: {settlement['net_refund']} CNY",
            "",
            "-" * 80,
            "推荐操作",
            "-" * 80,
            "",
            *[f"- {action}" for action in audit_result.recommended_actions],
            "",
            "=" * 80,
            f"报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "=" * 80,
        ]
        
        file_path = self.output_dir / f"audit_{order.order_id}.txt"
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(report_content))
        
        return str(file_path)

    def print_console_summary(self,
                             orders: List[RentalOrder],
                             transactions: List[DepositTransaction],
                             damages: List[DamageItem],
                             renewals: List[RenewalApplication],
                             bad_rows: List[BadRow]) -> None:
        print("\n" + "=" * 80)
        print("租赁押金审计 - 概览报告")
        print("=" * 80)
        
        print(f"\n数据统计:")
        print(f"  订单总数: {len(orders)}")
        print(f"  交易记录: {len(transactions)}")
        print(f"  损坏记录: {len(damages)}")
        print(f"  续租记录: {len(renewals)}")
        print(f"  解析错误: {len(bad_rows)}")
        
        if bad_rows:
            print(f"\n解析错误详情:")
            for bad_row in bad_rows[:5]:
                print(f"  [{bad_row.error_type}] {bad_row.source.file_path}:{bad_row.source.line_number or '?'}")
                print(f"    {bad_row.error_message}")
            if len(bad_rows) > 5:
                print(f"  ... 还有 {len(bad_rows) - 5} 条错误")
        
        print("\n" + "-" * 80)
        print("查看完整报告文件获取详细信息")
        print(f"输出目录: {self.output_dir}")
        print("=" * 80 + "\n")
