import csv
from typing import List, Tuple
from datetime import datetime
from .models import Agent, Call, QCInspector
from .storage import Storage


class CSVImporter:
    def __init__(self, storage: Storage):
        self.storage = storage

    def import_agents(self, csv_path: str) -> Tuple[int, int]:
        added = 0
        updated = 0
        with open(csv_path, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                agent_id = row.get('agent_id') or row.get('坐席工号')
                if not agent_id:
                    continue
                existing = self.storage.get_agent(agent_id)
                agent = Agent(
                    agent_id=agent_id,
                    name=row.get('name', row.get('姓名', '')),
                    team=row.get('team', row.get('团队', '')),
                    risk_score=float(row.get('risk_score', row.get('风险分', 50.0))),
                    historical_avg_score=float(row.get('historical_avg_score', row.get('历史平均分', 85.0))),
                    total_qc_calls=int(row.get('total_qc_calls', row.get('质检次数', 0))),
                    last_updated=datetime.now().isoformat()
                )
                self.storage.upsert_agent(agent)
                if existing:
                    updated += 1
                else:
                    added += 1
        return added, updated

    def import_calls(self, csv_path: str) -> Tuple[int, int]:
        added = 0
        skipped_duplicate = 0
        with open(csv_path, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                call_id = row.get('call_id') or row.get('通话ID')
                if not call_id:
                    continue

                existing = self.storage.get_call(call_id)
                if existing and existing.status.value != 'pending':
                    skipped_duplicate += 1
                    continue

                call = Call(
                    call_id=call_id,
                    agent_id=row.get('agent_id', row.get('坐席工号', '')),
                    call_time=row.get('call_time', row.get('通话时间', '')),
                    duration_sec=int(row.get('duration_sec', row.get('通话时长(秒)', 0))),
                    business_type=row.get('business_type', row.get('业务类型', '')),
                    is_complaint=self._parse_bool(row.get('is_complaint', row.get('是否投诉', 'false')))
                )

                if existing:
                    call.status = existing.status
                    call.sampled_at = existing.sampled_at
                    call.qc_assigned_to = existing.qc_assigned_to
                    call.qc_score = existing.qc_score
                    call.qc_notes = existing.qc_notes
                    call.sampling_reason = existing.sampling_reason

                is_new = self.storage.upsert_call(call)
                if is_new:
                    added += 1

        return added, skipped_duplicate

    def import_inspectors(self, csv_path: str) -> Tuple[int, int]:
        added = 0
        updated = 0
        with open(csv_path, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                inspector_id = row.get('inspector_id') or row.get('质检员工号')
                if not inspector_id:
                    continue
                existing = self.storage.get_inspector(inspector_id)
                inspector = QCInspector(
                    inspector_id=inspector_id,
                    name=row.get('name', row.get('姓名', '')),
                    active=self._parse_bool(row.get('active', row.get('是否在职', 'true'))),
                    current_task_count=int(row.get('current_task_count', 0))
                )
                self.storage.upsert_inspector(inspector)
                if existing:
                    updated += 1
                else:
                    added += 1
        return added, updated

    def _parse_bool(self, value) -> bool:
        if isinstance(value, bool):
            return value
        s = str(value).lower().strip()
        return s in ('true', '1', 'yes', '是', '投诉', '有')
