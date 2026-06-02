from typing import Dict, List, Any, Optional
from collections import defaultdict
from datetime import datetime

from models import TailDifferenceStatus
from tail_difference_tracker import TailDifferenceTracker
from report_generator import ReportGenerator


class VisualizationService:
    def __init__(self, tracker: TailDifferenceTracker, report_gen: ReportGenerator):
        self.tracker = tracker
        self.report_gen = report_gen

    def get_chart_data(self, chart_type: str = "bar") -> Dict[str, Any]:
        records = list(self.tracker.records.values())

        if chart_type == "bar":
            return self._get_bar_chart_data(records)
        elif chart_type == "pie":
            return self._get_pie_chart_data(records)
        elif chart_type == "3d":
            return self._get_3d_chart_data(records)
        else:
            return self._get_bar_chart_data(records)

    def _get_bar_chart_data(self, records) -> Dict[str, Any]:
        data_by_date = defaultdict(lambda: {
            'total_tail': 0,
            'record_count': 0,
            'record_ids': []
        })

        for record in records:
            date_key = record.trade_date
            data_by_date[date_key]['total_tail'] += abs(record.tail_difference)
            data_by_date[date_key]['record_count'] += 1
            data_by_date[date_key]['record_ids'].append(record.id)

        sorted_dates = sorted(data_by_date.keys())

        return {
            'chart_type': '柱状图',
            'x_axis': sorted_dates,
            'y_axis_label': '尾差绝对值合计(元)',
            'data_points': [
                {
                    'date': date,
                    'value': round(data_by_date[date]['total_tail'], 2),
                    'record_count': data_by_date[date]['record_count'],
                    'drilldown_record_ids': data_by_date[date]['record_ids']
                }
                for date in sorted_dates
            ],
            'click_behavior': '点击柱子可查看当日明细记录'
        }

    def _get_pie_chart_data(self, records) -> Dict[str, Any]:
        status_counts = defaultdict(list)
        for record in records:
            status_counts[record.status.value].append(record.id)

        return {
            'chart_type': '饼图',
            'data_points': [
                {
                    'name': status,
                    'value': len(record_ids),
                    'drilldown_record_ids': record_ids
                }
                for status, record_ids in status_counts.items()
            ],
            'click_behavior': '点击扇区可查看该状态下的所有记录'
        }

    def _get_3d_chart_data(self, records) -> Dict[str, Any]:
        funds = sorted(set(r.fund_code for r in records))
        dates = sorted(set(r.trade_date for r in records))

        heatmap_data = []
        for record in records:
            heatmap_data.append({
                'x': dates.index(record.trade_date),
                'y': funds.index(record.fund_code),
                'z': abs(record.tail_difference),
                'record_id': record.id,
                'fund_name': record.fund_name,
                'date': record.trade_date
            })

        return {
            'chart_type': '3D热力图',
            'x_axis': dates,
            'y_axis': funds,
            'data_points': heatmap_data,
            'click_behavior': '点击任意位置可追溯到具体记录和原始邮件'
        }

    def drilldown_to_record(self, record_id: str) -> Dict[str, Any]:
        viz_data = self.report_gen.get_record_for_visualization(record_id)

        if not viz_data:
            return {'error': '记录不存在'}

        result = {
            'record_detail': viz_data,
            'trace_options': {
                'can_trace_to_email': viz_data['trace_sources']['email']['available'],
                'can_trace_to_batch': viz_data['trace_sources']['batch']['available'],
            },
            'actions': [
                {
                    'action': 'view_email',
                    'label': '查看客户经理补充邮件',
                    'available': viz_data['trace_sources']['email']['available']
                },
                {
                    'action': 'view_batch',
                    'label': '查看清算批次详情',
                    'available': viz_data['trace_sources']['batch']['available']
                },
                {
                    'action': 'view_history',
                    'label': '查看变更历史',
                    'available': viz_data['change_history_count'] > 0
                }
            ]
        }

        if viz_data['needs_manual_review']:
            result['special_attention'] = {
                'level': 'high',
                'message': '此条金额为0但备注已冲正，需风控同事人工复核确认',
                'suggested_action': '联系风控同事进行复核'
            }

        return result

    def trace_to_original_email(self, record_id: str) -> Dict[str, Any]:
        email = self.tracker.trace_to_email(record_id)
        if not email:
            return {'error': '未找到关联的客户经理补充邮件'}

        return {
            'source_type': '客户经理补充邮件',
            'source_file': email.source_file,
            'import_time': email.import_time.strftime('%Y-%m-%d %H:%M:%S'),
            'batch_id': email.batch_id,
            'raw_content_preview': {k: v for k, v in list(email.raw_data.items())[:10]}
        }

    def trace_to_settlement_batch(self, record_id: str) -> Dict[str, Any]:
        batch = self.tracker.trace_to_settlement_batch(record_id)
        if not batch:
            return {'error': '未找到关联的清算批次'}

        return {
            'source_type': '清算批次',
            'batch_number': batch.batch_number,
            'trade_date': batch.trade_date,
            'settlement_date': batch.settlement_date,
            'total_amount': batch.total_amount,
            'status': batch.status
        }

    def get_record_change_history_visual(self, record_id: str) -> Dict[str, Any]:
        history = self.tracker.get_record_change_history(record_id)
        if not history:
            return {'message': '暂无变更历史'}

        return {
            'record_id': record_id,
            'timeline': [
                {
                    'time': h['时间'],
                    'actor': h['操作人'],
                    'action': h['变更类型'],
                    'field': h['字段'],
                    'before': h['变更前'],
                    'after': h['变更后'],
                    'reason': h['原因']
                }
                for h in history
            ],
            'total_changes': len(history)
        }
