import re
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

from models import (
    MigrationItem,
    AlarmRecord,
    InterfaceDoc,
    AuditLog,
    AuditConclusion,
    DisputeRecord,
    ChangeType,
    RecordStatus,
    DisputeType,
)


class EvidenceLinker:
    def __init__(self):
        self.migration_items: Dict[str, List[MigrationItem]] = defaultdict(list)
        self.alarm_records: Dict[str, List[AlarmRecord]] = defaultdict(list)
        self.interface_docs: Dict[str, List[InterfaceDoc]] = defaultdict(list)
        self.audit_logs: Dict[str, List[AuditLog]] = defaultdict(list)
        self.request_id_map: Dict[str, List] = defaultdict(list)
        self.idempotency_key_map: Dict[str, List] = defaultdict(list)

    def load_data(
        self,
        migrations: List[MigrationItem],
        alarms: List[AlarmRecord],
        docs: List[InterfaceDoc],
        audit_logs: List[AuditLog]
    ):
        for item in migrations:
            self.migration_items[item.interface_name].append(item)
            if item.remarks:
                self._extract_and_map_ids(item.remarks, item)

        for alarm in alarms:
            self.alarm_records[alarm.interface_name].append(alarm)
            if alarm.request_id:
                self.request_id_map[alarm.request_id].append(alarm)
            if alarm.idempotency_key:
                self.idempotency_key_map[alarm.idempotency_key].append(alarm)

        for doc in docs:
            self.interface_docs[doc.interface_name].append(doc)

        for log in audit_logs:
            self.audit_logs[log.operation].append(log)
            if log.request_id:
                self.request_id_map[log.request_id].append(log)
            if log.idempotency_key:
                self.idempotency_key_map[log.idempotency_key].append(log)

    def _extract_and_map_ids(self, text: str, item):
        request_ids = re.findall(r'request_id[=:]\s*([a-f0-9\-]+)', text, re.IGNORECASE)
        for rid in request_ids:
            self.request_id_map[rid].append(item)

        idemp_keys = re.findall(r'idempotency_?key[=:]\s*([a-f0-9\-]+)', text, re.IGNORECASE)
        for key in idemp_keys:
            self.idempotency_key_map[key].append(item)


class ChangeAnalyzer:
    MATERIAL_KEYWORDS = ['补充', '补录', '补材料', '完善', '文档', '说明', '备注']
    CONCLUSION_KEYWORDS = ['修改', '变更', '调整', '修正', '修复', '更正', '改结论']

    @classmethod
    def determine_change_type(
        cls,
        migration: MigrationItem,
        alarms: List[AlarmRecord],
        docs: List[InterfaceDoc]
    ) -> Tuple[ChangeType, str]:
        combined_text = migration.remarks + ' ' + ' '.join(a.error_message for a in alarms)
        combined_text += ' ' + ' '.join(d.change_description for d in docs)

        has_manual_doc_change = any(d.is_manual_change for d in docs)

        material_score = sum(1 for kw in cls.MATERIAL_KEYWORDS if kw in combined_text)
        conclusion_score = sum(1 for kw in cls.CONCLUSION_KEYWORDS if kw in combined_text)

        if has_manual_doc_change and conclusion_score == 0:
            return ChangeType.MATERIAL_ONLY, '接口文档存在手工改动，无结论变更迹象'

        if conclusion_score > 0 and material_score == 0:
            return ChangeType.CONCLUSION_CHANGED, '存在明确的结论修改关键词'

        if conclusion_score > 0 and material_score > 0:
            if has_manual_doc_change:
                return ChangeType.CONCLUSION_CHANGED, '既有结论修改也有材料补充，以结论变更为准'
            return ChangeType.INFO_SUPPLEMENT, '同时包含材料补充和信息更新'

        if material_score > 0:
            return ChangeType.MATERIAL_ONLY, '仅涉及材料补充相关内容'

        return ChangeType.UNKNOWN, '无法确定变更类型，需要人工复核'


class DisputeAnalyzer:
    @staticmethod
    def analyze_idempotency_failures(records: List) -> Optional[DisputeRecord]:
        idemp_records = [r for r in records if getattr(r, 'idempotency_key', None)]

        if not idemp_records:
            return None

        key_groups: Dict[str, List] = defaultdict(list)
        for record in idemp_records:
            key = getattr(record, 'idempotency_key', '')
            if key:
                key_groups[key].append(record)

        for key, group in key_groups.items():
            if len(group) > 1:
                timestamps = [getattr(r, 'timestamp', datetime.now()) for r in group]
                time_diff = max(timestamps) - min(timestamps)

                statuses = [getattr(r, 'status', getattr(r, 'error_type', '')) for r in group]
                has_different_statuses = len(set(statuses)) > 1

                if time_diff > timedelta(minutes=5) or has_different_statuses:
                    evidence = [
                        f"{r.__class__.__name__}:{r.id}@{r.source_file}:{getattr(r, 'line_number', 0)}"
                        for r in group
                    ]

                    reason = f"幂等键[{key}]在{len(group)}条记录中出现，"
                    if has_different_statuses:
                        reason += f"且状态不一致: {', '.join(set(statuses))}，"
                    reason += f"时间跨度{time_diff.total_seconds():.0f}秒"

                    return DisputeRecord(
                        dispute_type=DisputeType.IDEMPOTENCY_KEY_FAILURE,
                        description=f"幂等键失效问题涉及{len(group)}条记录",
                        verifiable_reason=reason,
                        evidence_refs=evidence
                    )

        return None

    @staticmethod
    def analyze_timestamp_mismatches(
        migrations: List[MigrationItem],
        alarms: List[AlarmRecord]
    ) -> Optional[DisputeRecord]:
        if not migrations or not alarms:
            return None

        migration_dates = [m.migration_date for m in migrations]
        alarm_times = [a.timestamp for a in alarms]

        avg_migration = sum(m.timestamp() for m in migration_dates) / len(migration_dates)
        avg_alarm = sum(a.timestamp() for a in alarm_times) / len(alarm_times)

        time_diff = abs(avg_migration - avg_alarm)

        if time_diff > 3600 * 24:
            evidence = [f"Migration:{m.id} date={m.migration_date}" for m in migrations[:3]]
            evidence += [f"Alarm:{a.id} time={a.timestamp}" for a in alarms[:3]]

            return DisputeRecord(
                dispute_type=DisputeType.TIMESTAMP_MISMATCH,
                description=f"迁移清单与报警记录时间相差{time_diff/3600:.1f}小时",
                verifiable_reason=f"迁移平均时间({datetime.fromtimestamp(avg_migration)})与报警平均时间({datetime.fromtimestamp(avg_alarm)})相差超过24小时，可能存在时钟不同步或数据滞后问题",
                evidence_refs=evidence
            )

        return None


class AuditMatcher:
    def __init__(self):
        self.linker = EvidenceLinker()
        self.conclusions: List[AuditConclusion] = []

    def analyze(
        self,
        migrations: List[MigrationItem],
        alarms: List[AlarmRecord],
        docs: List[InterfaceDoc],
        audit_logs: List[AuditLog]
    ) -> List[AuditConclusion]:
        self.linker.load_data(migrations, alarms, docs, audit_logs)

        all_interfaces = set()
        all_interfaces.update(self.linker.migration_items.keys())
        all_interfaces.update(self.linker.alarm_records.keys())
        all_interfaces.update(self.linker.interface_docs.keys())

        conclusion_id = 1
        for interface in all_interfaces:
            conclusion = self._analyze_interface(interface, conclusion_id)
            if conclusion:
                self.conclusions.append(conclusion)
                conclusion_id += 1

        self._analyze_cross_cutting_issues(conclusion_id)

        return self.conclusions

    def _analyze_interface(self, interface: str, conclusion_id: int) -> Optional[AuditConclusion]:
        migrations = self.linker.migration_items.get(interface, [])
        alarms = self.linker.alarm_records.get(interface, [])
        docs = self.linker.interface_docs.get(interface, [])

        if not migrations and not alarms and not docs:
            return None

        change_type, reason = ChangeAnalyzer.determine_change_type(
            migrations[0] if migrations else MigrationItem('', '', '', '', datetime.now(), '', ''),
            alarms,
            docs
        )

        status = RecordStatus.PENDING
        dispute = None

        if alarms:
            dispute = DisputeAnalyzer.analyze_idempotency_failures(alarms)
            if dispute:
                status = RecordStatus.DISPUTED

        if migrations and alarms and not dispute:
            dispute = DisputeAnalyzer.analyze_timestamp_mismatches(migrations, alarms)
            if dispute:
                status = RecordStatus.DISPUTED

        if not dispute and change_type != ChangeType.UNKNOWN:
            status = RecordStatus.VERIFIED

        migration_refs = [f"{m.id}@{m.source_file}:{m.line_number}" for m in migrations]
        alarm_refs = [f"{a.id}@{a.source_file}:{a.line_number}" for a in alarms]
        doc_refs = [f"{d.interface_name}:v{d.version}@{d.source_file}" for d in docs]

        related_logs = []
        for alarm in alarms:
            if alarm.request_id:
                related_logs.extend(self.linker.request_id_map.get(alarm.request_id, []))
        audit_log_refs = list(set(
            f"{l.id}@{l.source_file}" for l in related_logs if hasattr(l, 'file_name')
        ))

        summary_parts = []
        if migrations:
            summary_parts.append(f"迁移项{len(migrations)}条")
        if alarms:
            summary_parts.append(f"报警{len(alarms)}条")
        if docs:
            summary_parts.append(f"文档{len(docs)}版")
        if dispute:
            summary_parts.append(f"存在{dispute.dispute_type.value}")

        return AuditConclusion(
            id=f"CONC-{conclusion_id:04d}",
            interface_name=interface or '未命名接口',
            summary='，'.join(summary_parts) + f'，判定为{change_type.value}',
            change_type=change_type,
            status=status,
            migration_refs=migration_refs,
            alarm_refs=alarm_refs,
            doc_refs=doc_refs,
            audit_log_refs=audit_log_refs,
            dispute=dispute,
            notes=reason
        )

    def _analyze_cross_cutting_issues(self, start_id: int):
        for idemp_key, records in self.linker.idempotency_key_map.items():
            if len(records) >= 3:
                dispute = DisputeRecord(
                    dispute_type=DisputeType.IDEMPOTENCY_KEY_FAILURE,
                    description=f"幂等键[{idemp_key}]在多条记录中重复出现",
                    verifiable_reason=f"该幂等键在{len(records)}条不同记录中被使用，可能存在幂等机制失效或被绕过的情况",
                    evidence_refs=[
                        f"{r.__class__.__name__}:{getattr(r, 'id', '?')}@{getattr(r, 'source_file', '?')}"
                        for r in records
                    ]
                )

                interfaces = set(getattr(r, 'interface_name', '') for r in records)

                self.conclusions.append(AuditConclusion(
                    id=f"CONC-{start_id:04d}",
                    interface_name=f"跨接口问题: {idemp_key[:12]}...",
                    summary=f"幂等键[{idemp_key}]涉及{len(records)}条记录，{len(interfaces)}个接口，存在争议",
                    change_type=ChangeType.UNKNOWN,
                    status=RecordStatus.DISPUTED,
                    migration_refs=[],
                    alarm_refs=[],
                    doc_refs=[],
                    audit_log_refs=[],
                    dispute=dispute,
                    notes=f"涉及接口: {', '.join(interfaces) if interfaces else '未知'}"
                ))
                start_id += 1
