from datetime import datetime
from typing import List, Dict, Any
from collections import defaultdict

from models import TailDifferenceRecord, TailDifferenceStatus
from tail_difference_tracker import TailDifferenceTracker


class ReportGenerator:
    def __init__(self, tracker: TailDifferenceTracker):
        self.tracker = tracker

    def generate_executive_summary(self) -> Dict[str, Any]:
        all_records = list(self.tracker.records.values())
        pending_records = self.tracker.get_pending_review_records()

        status_counts = defaultdict(int)
        for r in all_records:
            status_counts[r.status.value] += 1

        needs_manual_review = [
            r for r in all_records if r.needs_manual_review()
        ]

        return {
            '报告生成时间': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            '总记录数': len(all_records),
            '待复核记录数': len(pending_records),
            '需特别关注（金额0但备注已冲正）': len(needs_manual_review),
            '各状态统计': dict(status_counts),
            '待办事项摘要': self._generate_todo_summary(pending_records),
            '计算参数说明': self._get_params_note()
        }

    def _generate_todo_summary(self, pending_records: List[TailDifferenceRecord]) -> List[Dict]:
        todos = []
        for record in pending_records:
            summary = record.get_review_summary()
            todo = {
                '记录ID': summary['record_id'],
                '基金': summary['fund'],
                '尾差金额': f"{summary['tail_difference']:.2f}元",
                '当前状态': summary['status'],
                '为何留下': summary['why_kept'],
                '缺什么材料': summary['missing_materials'] if summary['missing_materials'] else '材料齐全',
                '下一步找谁': self._get_next_contact(summary),
                '具体动作': record.next_action or '请查看详情',
                '可追溯邮件': '是' if summary['can_trace_to_email'] else '否',
                '可追溯批次': '是' if summary['can_trace_to_batch'] else '否'
            }
            todos.append(todo)
        return todos

    def _get_next_contact(self, summary: Dict) -> str:
        if summary['responsible']:
            return summary['responsible']
        if summary['missing_materials']:
            return '找风控值班老秦联系客户经理补材料'
        if summary['status'] == '待风控复核':
            return '找风控同事复核'
        return '待分配'

    def _get_params_note(self) -> Dict:
        params = self.tracker.calculation_params
        return {
            '参数版本': params.version,
            '容忍阈值': f"{params.tolerance_threshold}元",
            '舍入方式': params.rounding_method,
            '交易截止时点': params.trade_date_cutoff,
            '计算逻辑说明': params.notes
        }

    def generate_detailed_report(self) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("                    基金申赎尾差追踪报告")
        lines.append("=" * 80)
        lines.append("")

        summary = self.generate_executive_summary()
        lines.append(f"报告时间: {summary['报告生成时间']}")
        lines.append(f"总记录数: {summary['总记录数']}")
        lines.append(f"待复核: {summary['待复核记录数']}条")
        lines.append(f"需特别关注: {summary['需特别关注（金额0但备注已冲正）']}条")
        lines.append("")

        lines.append("-" * 80)
        lines.append("【一、待办事项摘要（给负责人看）】")
        lines.append("-" * 80)
        lines.append("")

        for i, todo in enumerate(summary['待办事项摘要'], 1):
            lines.append(f"▶ 待处理事项 #{i}")
            lines.append(f"  基金: {todo['基金']}")
            lines.append(f"  尾差: {todo['尾差金额']} | 状态: {todo['当前状态']}")
            lines.append(f"  → 为何留下: {todo['为何留下']}")
            lines.append(f"  → 材料情况: {todo['缺什么材料']}")
            lines.append(f"  → 下一步找: {todo['下一步找谁']}")
            lines.append(f"  → 具体动作: {todo['具体动作']}")
            lines.append(f"  → 追溯能力: 邮件{todo['可追溯邮件']} | 批次{todo['可追溯批次']}")
            lines.append("")

        lines.append("-" * 80)
        lines.append("【二、计算参数说明】")
        lines.append("-" * 80)
        params = summary['计算参数说明']
        lines.append(f"  参数版本: {params['参数版本']}")
        lines.append(f"  容忍阈值: {params['容忍阈值']}")
        lines.append(f"  舍入方式: {params['舍入方式']}")
        lines.append(f"  截止时点: {params['交易截止时点']}")
        lines.append(f"  逻辑说明: {params['计算逻辑说明']}")
        lines.append("")

        lines.append("-" * 80)
        lines.append("【三、记录明细】")
        lines.append("-" * 80)
        lines.append("")

        for record_id, record in self.tracker.records.items():
            lines.append(f"记录ID: {record_id}")
            lines.append(f"  交易日期: {record.trade_date}")
            lines.append(f"  基金: {record.fund_code} {record.fund_name}")
            lines.append(f"  申请金额: {record.application_amount:.2f}元")
            lines.append(f"  赎回金额: {record.redemption_amount:.2f}元")
            lines.append(f"  清算金额: {record.settlement_amount:.2f}元")
            lines.append(f"  尾差: {record.tail_difference:.2f}元")
            lines.append(f"  状态: {record.status.value}")
            lines.append(f"  备注: {record.remark or '(无)'}")
            lines.append(f"  责任人: {record.responsible_person or '(未分配)'}")
            lines.append(f"  关联邮件ID: {record.client_email_id or '(无)'}")
            lines.append(f"  关联批次号: {record.settlement_batch_number or '(无)'}")

            if record.change_history:
                lines.append(f"  变更历史:")
                history = self.tracker.get_record_change_history(record_id)
                for h in history:
                    lines.append(f"    - [{h['时间']}] {h['操作人']} {h['变更类型']}: "
                                 f"{h['变更前']} → {h['变更后']}")
                    if h['原因']:
                        lines.append(f"      原因: {h['原因']}")
            lines.append("")

        lines.append("=" * 80)
        lines.append("报告结束")
        lines.append("=" * 80)

        return "\n".join(lines)

    def get_record_for_visualization(self, record_id: str) -> Dict[str, Any]:
        record = self.tracker.records.get(record_id)
        if not record:
            return {}

        email = self.tracker.trace_to_email(record_id)
        batch = self.tracker.trace_to_settlement_batch(record_id)

        return {
            'record_id': record_id,
            'fund_info': f"{record.fund_code} {record.fund_name}",
            'trade_date': record.trade_date,
            'amounts': {
                'application': record.application_amount,
                'redemption': record.redemption_amount,
                'settlement': record.settlement_amount,
                'tail_difference': record.tail_difference
            },
            'status': record.status.value,
            'remark': record.remark,
            'calculation_params': {
                'version': record.calculation_params.version,
                'notes': record.calculation_params.notes
            } if record.calculation_params else None,
            'trace_sources': {
                'email': {
                    'available': email is not None,
                    'source_file': email.source_file if email else None,
                    'import_time': email.import_time.strftime('%Y-%m-%d %H:%M:%S') if email else None
                },
                'batch': {
                    'available': batch is not None,
                    'batch_number': batch.batch_number if batch else None,
                    'settlement_date': batch.settlement_date if batch else None
                }
            },
            'needs_manual_review': record.needs_manual_review(),
            'change_history_count': len(record.change_history)
        }
