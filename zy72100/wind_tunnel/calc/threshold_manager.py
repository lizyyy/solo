from datetime import datetime
from typing import List, Optional, Dict

from ..models.models import ThresholdConfig, AuditEntry


class ThresholdManager:
    def __init__(self):
        self.configs: List[ThresholdConfig] = []
        self.audit_log: List[AuditEntry] = []

    def add_config(self, config: ThresholdConfig) -> str:
        self.configs.append(config)
        entry = AuditEntry(
            action="threshold_created",
            actor=config.created_by,
            details=f"新建阈值配置, 原因: {config.reason}",
            threshold_config_id=config.config_id,
            after_value=str(config.to_dict()),
        )
        self.audit_log.append(entry)
        return config.config_id

    def get_active(self) -> Optional[ThresholdConfig]:
        if not self.configs:
            return None
        return self.configs[-1]

    def override_threshold(
        self,
        field_name: str,
        new_value: float,
        reason: str,
        actor: str = "manual",
    ) -> Optional[ThresholdConfig]:
        current = self.get_active()
        if current is None:
            return None

        old_value = getattr(current, field_name, None)
        if old_value is None:
            return None

        new_config = ThresholdConfig(
            created_at=datetime.now(),
            created_by=actor,
            reason=reason,
        )

        for attr in [
            "cl_max", "cl_min", "cd_max", "cd_min",
            "ld_ratio_min", "ld_ratio_max",
            "pressure_max_kpa", "wind_speed_max_mps",
        ]:
            setattr(new_config, attr, getattr(current, attr))

        setattr(new_config, field_name, new_value)

        entry = AuditEntry(
            action="threshold_overridden",
            actor=actor,
            details=f"手动修改阈值 {field_name}: {old_value} -> {new_value}, 原因: {reason}",
            threshold_config_id=new_config.config_id,
            before_value=f"{field_name}={old_value}",
            after_value=f"{field_name}={new_value}",
        )
        self.audit_log.append(entry)

        self.configs.append(new_config)
        return new_config

    def get_version_chain(self) -> List[Dict]:
        return [
            {
                "config_id": c.config_id,
                "created_at": c.created_at.isoformat(),
                "created_by": c.created_by,
                "reason": c.reason,
                "values": c.to_dict(),
            }
            for c in self.configs
        ]

    def audit_summary(self) -> List[Dict]:
        return [e.to_dict() for e in self.audit_log]
