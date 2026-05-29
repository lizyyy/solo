from datetime import datetime, date
from typing import List, Dict, Any, Optional
from collections import defaultdict
from .models import DataStore, HistoryRecord, OperationType, ErrorRecord
from .storage import StorageManager


class HistoryManager:
    def __init__(self, storage: StorageManager):
        self.storage = storage

    def query_history(
        self, store: DataStore,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        operation_type: Optional[OperationType] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        operator: Optional[str] = None
    ) -> List[HistoryRecord]:
        records = list(store.history.values())

        if entity_type:
            records = [r for r in records if r.entity_type == entity_type]
        if entity_id:
            records = [r for r in records if r.entity_id == entity_id]
        if operation_type:
            records = [r for r in records if r.operation_type == operation_type]
        if start_date:
            records = [r for r in records if r.operation_time.date() >= start_date]
        if end_date:
            records = [r for r in records if r.operation_time.date() <= end_date]
        if operator:
            records = [r for r in records if r.operator == operator]

        records.sort(key=lambda r: r.operation_time, reverse=True)
        return records

    def build_entity_timeline(self, entity_type: str, entity_id: str, store: DataStore) -> List[Dict[str, Any]]:
        records = self.query_history(store, entity_type=entity_type, entity_id=entity_id)
        timeline = []

        for record in records:
            changes = []
            if record.before_data and record.after_data:
                for key in set(list(record.before_data.keys()) + list(record.after_data.keys())):
                    before = record.before_data.get(key)
                    after = record.after_data.get(key)
                    if before != after:
                        changes.append({
                            'field': key,
                            'before': before,
                            'after': after
                        })

            timeline.append({
                'time': record.operation_time,
                'operation': record.operation_type.value,
                'operator': record.operator,
                'reason': record.change_reason,
                'changes': changes,
                'calculation_trace': record.calculation_trace,
                'record_id': record.record_id
            })

        return timeline

    def verify_revocation_integrity(self, sample_id: str, store: DataStore) -> Dict[str, Any]:
        result = {
            'sample_id': sample_id,
            'is_revoked': False,
            'revocation_time': None,
            'revocation_reason': None,
            'related_records_removed': True,
            'garment_associations_cleared': True,
            'status_chain_valid': True,
            'anomalies': [],
            'verification_trace': []
        }

        sample = store.samples.get(sample_id)
        if not sample:
            result['anomalies'].append(f"样卡 {sample_id} 不存在")
            result['verification_trace'].append("验证失败: 样卡不存在")
            return result

        result['is_revoked'] = sample.inspection_status.value == "已撤回"
        result['verification_trace'].append(f"样卡当前状态: {sample.inspection_status.value}")

        revocation_records = [
            r for r in store.history.values()
            if r.entity_type == "sample"
            and r.entity_id == sample_id
            and r.operation_type == OperationType.REVOKE
        ]

        if revocation_records:
            revocation_records.sort(key=lambda r: r.operation_time)
            last_revocation = revocation_records[-1]
            result['revocation_time'] = last_revocation.operation_time
            result['revocation_reason'] = last_revocation.change_reason
            result['verification_trace'].append(f"最后撤回时间: {last_revocation.operation_time}")
            result['verification_trace'].append(f"撤回原因: {last_revocation.change_reason}")

        related_matches = [
            m for m in store.matches.values()
            if m.sample_id == sample_id
        ]
        if related_matches:
            result['related_records_removed'] = False
            result['anomalies'].append(f"存在 {len(related_matches)} 条未清理的匹配记录")
            result['verification_trace'].append(f"⚠ 发现未清理匹配记录: {[m.match_id for m in related_matches]}")

        garments_with_sample = [
            g for g in store.garments.values()
            if g.sample_id == sample_id
        ]
        if garments_with_sample:
            result['garment_associations_cleared'] = False
            result['anomalies'].append(f"{len(garments_with_sample)} 件成衣仍关联此样卡")
            result['verification_trace'].append(f"⚠ 发现未解除关联成衣: {[g.garment_id for g in garments_with_sample]}")

        timeline = self.build_entity_timeline("sample", sample_id, store)
        status_values = [sample.inspection_status.value]
        for event in timeline:
            for change in event['changes']:
                if change['field'] == 'inspection_status':
                    if change['after'] not in status_values:
                        status_values.append(change['after'])

        result['verification_trace'].append(f"状态流转序列: {' → '.join(reversed(status_values))}")

        if "已撤回" in status_values and len(status_values) > 1:
            idx = status_values.index("已撤回")
            if idx > 0 and status_values[idx - 1] == "待检验":
                result['status_chain_valid'] = False
                result['anomalies'].append("状态流转异常: 撤回后直接回待检验可能跳过了必要流程")

        return result

    def get_operation_statistics(self, store: DataStore, start_date: Optional[date] = None, end_date: Optional[date] = None) -> Dict[str, Any]:
        records = self.query_history(store, start_date=start_date, end_date=end_date)

        stats = {
            'total_operations': len(records),
            'by_operation_type': defaultdict(int),
            'by_entity_type': defaultdict(int),
            'by_operator': defaultdict(int),
            'daily_operations': defaultdict(int),
            'period': {
                'start': start_date.isoformat() if start_date else None,
                'end': end_date.isoformat() if end_date else None
            }
        }

        for r in records:
            stats['by_operation_type'][r.operation_type.value] += 1
            stats['by_entity_type'][r.entity_type] += 1
            if r.operator:
                stats['by_operator'][r.operator] += 1
            stats['daily_operations'][r.operation_time.date().isoformat()] += 1

        stats['by_operation_type'] = dict(stats['by_operation_type'])
        stats['by_entity_type'] = dict(stats['by_entity_type'])
        stats['by_operator'] = dict(stats['by_operator'])
        stats['daily_operations'] = dict(sorted(stats['daily_operations'].items()))

        return stats

    def generate_audit_trail(self, store: DataStore, output_format: str = "text") -> str:
        records = self.query_history(store)

        if output_format == "text":
            lines = [
                "=" * 80,
                "服装秀面料样卡管理系统 - 审计追踪",
                f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                f"记录总数: {len(records)}",
                "=" * 80,
                ""
            ]

            for r in records:
                lines.append(f"[{r.operation_time.strftime('%Y-%m-%d %H:%M:%S')}]")
                lines.append(f"  记录ID: {r.record_id}")
                lines.append(f"  操作类型: {r.operation_type.value}")
                lines.append(f"  实体类型: {r.entity_type}")
                lines.append(f"  实体ID: {r.entity_id}")
                lines.append(f"  操作人: {r.operator or '未指定'}")
                if r.change_reason:
                    lines.append(f"  变更原因: {r.change_reason}")

                if r.before_data and r.after_data:
                    lines.append(f"  变更详情:")
                    for key in set(list(r.before_data.keys()) + list(r.after_data.keys())):
                        before = r.before_data.get(key)
                        after = r.after_data.get(key)
                        if before != after:
                            lines.append(f"    - {key}: {before} → {after}")

                if r.calculation_trace:
                    lines.append(f"  计算追踪:")
                    for trace in r.calculation_trace[-5:]:
                        lines.append(f"    {trace}")

                lines.append("")

            return "\n".join(lines)

        return ""
