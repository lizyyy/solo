import uuid
from typing import Dict, List, Optional
from .models import Alert, TrainingLog, ThresholdNote


def generate_id() -> str:
    return str(uuid.uuid4())[:8]


class AlertStorage:
    def __init__(self):
        self._alerts: Dict[str, Alert] = {}
        self._training_logs: Dict[str, TrainingLog] = {}
        self._content_hash_to_log_id: Dict[str, str] = {}
        self._threshold_notes: Dict[str, ThresholdNote] = {}
        self._log_id_to_alert_ids: Dict[str, List[str]] = {}

    def import_training_log(self, training_log: TrainingLog) -> tuple[bool, str]:
        content_hash = training_log.content_hash()
        if content_hash in self._content_hash_to_log_id:
            existing_log_id = self._content_hash_to_log_id[content_hash]
            return False, existing_log_id

        self._training_logs[training_log.log_id] = training_log
        self._content_hash_to_log_id[content_hash] = training_log.log_id
        self._log_id_to_alert_ids[training_log.log_id] = []
        return True, training_log.log_id

    def is_log_imported(self, content_hash: str) -> Optional[str]:
        return self._content_hash_to_log_id.get(content_hash)

    def add_alert(self, alert: Alert) -> None:
        self._alerts[alert.alert_id] = alert
        log_id = alert.evidence.training_log_id
        if log_id not in self._log_id_to_alert_ids:
            self._log_id_to_alert_ids[log_id] = []
        if alert.alert_id not in self._log_id_to_alert_ids[log_id]:
            self._log_id_to_alert_ids[log_id].append(alert.alert_id)

    def get_alerts_for_log(self, log_id: str) -> List[Alert]:
        alert_ids = self._log_id_to_alert_ids.get(log_id, [])
        return [self._alerts[aid] for aid in alert_ids if aid in self._alerts]

    def get_alert(self, alert_id: str) -> Optional[Alert]:
        return self._alerts.get(alert_id)

    def get_training_log(self, log_id: str) -> Optional[TrainingLog]:
        return self._training_logs.get(log_id)

    def add_threshold_note(self, note: ThresholdNote) -> None:
        self._threshold_notes[note.note_id] = note

    def get_threshold_note(self, note_id: str) -> Optional[ThresholdNote]:
        return self._threshold_notes.get(note_id)

    def get_notes_for_feature(self, feature_name: str) -> List[ThresholdNote]:
        return [
            n
            for n in self._threshold_notes.values()
            if n.feature_name == feature_name or n.feature_name is None
        ]

    def link_note_to_alert(self, alert_id: str, note_id: str) -> bool:
        alert = self._alerts.get(alert_id)
        if not alert:
            return False
        if note_id not in alert.evidence.threshold_note_ids:
            alert.evidence.threshold_note_ids.append(note_id)
        return True

    def get_all_alerts(self) -> List[Alert]:
        return list(self._alerts.values())

    def get_all_logs(self) -> List[TrainingLog]:
        return list(self._training_logs.values())

    def rollback_alert_status(self, alert_id: str, author: str) -> bool:
        alert = self._alerts.get(alert_id)
        if not alert or not alert.change_history:
            return False

        status_changes = [
            c for c in alert.change_history if c.field_name == "status"
        ]
        if not status_changes:
            return False

        last_change = status_changes[-1]
        old_status_str = str(last_change.old_value).split(" | ")[0]
        from .models import AlertStatus

        try:
            old_status = AlertStatus(old_status_str)
        except ValueError:
            return False

        alert.update_status(old_status, author, reason=f"rollback from {last_change.new_value}")
        return True
