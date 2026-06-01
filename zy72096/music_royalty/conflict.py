from typing import List, Optional
from .models import RoyaltyRecord, ConflictItem
from .params import ParamStore


CONFLICT_TOLERANCE = 0.001


class ConflictDetector:
    def __init__(self, param_store: Optional[ParamStore] = None):
        self.param_store = param_store

    def detect(self, record: RoyaltyRecord) -> List[ConflictItem]:
        conflicts = []
        fields_to_check = [
            ("decay_factor", "衰减系数"),
            ("platform_share", "平台分成"),
            ("rights_share", "版权方分成"),
        ]

        for field, label in fields_to_check:
            data_val = getattr(record, field, None)
            if data_val is None:
                continue

            if self.param_store:
                param_val = self.param_store.get(record.record_id, field)
            else:
                param_val = None

            if param_val is not None:
                if abs(float(data_val) - float(param_val)) > CONFLICT_TOLERANCE:
                    conflicts.append(
                        ConflictItem(
                            record_id=record.record_id,
                            field_name=label,
                            param_value=param_val,
                            param_source=f"参数表(持久化, 记录ID={record.record_id})",
                            data_value=data_val,
                            data_source=f"导入数据(来源={record.source or '未标注'})",
                            suggestion=(
                                f"参数表为 {param_val}，导入数据为 {data_val}。"
                                f"请确认以哪个为准：若以参数表为准，可忽略导入值；"
                                f"若以导入数据为准，请运行 --update-param {record.record_id} {field}={data_val}"
                            ),
                        )
                    )

        return conflicts

    def detect_batch(self, records: List[RoyaltyRecord]) -> List[ConflictItem]:
        all_conflicts = []
        for r in records:
            all_conflicts.extend(self.detect(r))
        return all_conflicts
