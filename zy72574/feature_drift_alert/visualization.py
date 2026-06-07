from typing import Optional, List, Dict, Any
from .models import Alert, TrainingLog, ThresholdNote
from .storage import AlertStorage


class VisualizationLink:
    def __init__(self, storage: AlertStorage):
        self.storage = storage

    def get_alert_detail_with_sources(self, alert_id: str) -> dict:
        alert = self.storage.get_alert(alert_id)
        if not alert:
            return {"error": "报警不存在"}

        training_log = self.storage.get_training_log(alert.evidence.training_log_id)
        threshold_notes = [
            self.storage.get_threshold_note(nid)
            for nid in alert.evidence.threshold_note_ids
        ]
        threshold_notes = [n for n in threshold_notes if n is not None]

        return {
            "alert": {
                "alert_id": alert.alert_id,
                "feature_name": alert.feature_name,
                "offline_score": alert.offline_score,
                "online_score": alert.online_score,
                "offline_bucket": alert.offline_bucket.value,
                "online_bucket": alert.online_bucket.value,
                "bucket_diff": alert.bucket_diff,
                "status": alert.status.value,
                "remark": alert.remark,
            },
            "sources": {
                "training_log": self._log_to_dict(training_log) if training_log else None,
                "training_log_url": f"/training_logs/{alert.evidence.training_log_id}",
                "threshold_notes": [self._note_to_dict(n) for n in threshold_notes],
                "threshold_notes_urls": [
                    f"/threshold_notes/{n.note_id}" for n in threshold_notes
                ],
            },
            "traceable": True,
            "message": "点击数据源可追溯：训练日志曲线 / 阈值调参笔记均可跳转",
        }

    def get_chart_data_with_trace(self, alert_id: str, chart_type: str = "2d") -> dict:
        detail = self.get_alert_detail_with_sources(alert_id)
        if "error" in detail:
            return detail

        return {
            "chart_type": chart_type,
            "chart_data": {
                "x": ["离线得分", "线上得分"],
                "y": [detail["alert"]["offline_score"], detail["alert"]["online_score"]],
                "feature": detail["alert"]["feature_name"],
            },
            "trace_links": detail["sources"],
            "warning": "图表仅作展示用，复核结论请点击溯源链接查看原始证据",
            "review_hint": "离线和线上分数差了一个桶时，请务必回到训练日志曲线和阈值笔记复核",
        }

    def get_change_history_diff(self, alert_id: str) -> List[dict]:
        alert = self.storage.get_alert(alert_id)
        if not alert:
            return []

        history = []
        for change in alert.change_history:
            history.append({
                "change_id": change.change_id,
                "field_name": change.field_name,
                "before": change.old_value,
                "after": change.new_value,
                "author": change.author,
                "timestamp": change.timestamp.isoformat(),
                "change_type": change.change_type,
                "diff_preview": f"{change.old_value} → {change.new_value}",
            })
        return history

    def _log_to_dict(self, log: TrainingLog) -> dict:
        return {
            "log_id": log.log_id,
            "experiment_name": log.experiment_name,
            "model_version": log.model_version,
            "timestamp": log.timestamp.isoformat(),
            "feature_count": len(log.feature_scores),
        }

    def _note_to_dict(self, note: ThresholdNote) -> dict:
        return {
            "note_id": note.note_id,
            "feature_name": note.feature_name,
            "title": note.title,
            "content": note.content,
            "author": note.author,
            "timestamp": note.timestamp.isoformat(),
        }
