from __future__ import annotations

import uuid
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
import numpy as np

from .models import (
    FeatureSnapshot,
    ResampleRecord,
    ResampleSession,
    RecordStatus,
    AuditAction,
)


class ImbalanceResampler:
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.default_score_threshold = self.config.get("default_score_threshold", 0.5)
        self.missing_feature_default_value = self.config.get(
            "missing_feature_default_value", -999
        )

    def detect_default_score_usage(
        self, row_data: Dict[str, Any], score_col: str
    ) -> Tuple[bool, List[str], Optional[str]]:
        used_default = False
        missing_features = []
        reason = None

        for col, val in row_data.items():
            if col == score_col:
                continue
            if val is None or (
                isinstance(val, (int, float))
                and val == self.missing_feature_default_value
            ):
                missing_features.append(col)

        if missing_features:
            score = row_data.get(score_col)
            if score is not None and score == self.default_score_threshold:
                used_default = True
                reason = f"特征缺失时使用默认分 {self.default_score_threshold}"

        return used_default, missing_features, reason

    def import_feature_snapshot(
        self,
        df: pd.DataFrame,
        score_column: str,
        label_column: Optional[str] = None,
        snapshot_id: Optional[str] = None,
        operator: str = "system",
    ) -> List[ResampleRecord]:
        snapshot_id = snapshot_id or f"snap_{uuid.uuid4().hex[:8]}"
        records = []

        for idx, row in df.iterrows():
            row_data = row.to_dict()
            original_line = int(idx) + 2

            used_default, missing_feats, reason = self.detect_default_score_usage(
                row_data, score_column
            )

            feature_snapshot = FeatureSnapshot(
                snapshot_id=snapshot_id,
                original_line_number=original_line,
                raw_data=row_data,
                has_missing_features=len(missing_feats) > 0,
                missing_features=missing_feats,
                used_default_score=used_default,
                default_score_reason=reason,
                model_score=float(row[score_column]) if score_column in df.columns else 0.0,
                true_label=int(row[label_column]) if label_column and label_column in df.columns else None,
            )

            record = ResampleRecord(
                record_id=f"rec_{uuid.uuid4().hex[:10]}",
                snapshot=feature_snapshot,
                current_status=RecordStatus.IMPORTED,
            )

            record.add_audit_entry(
                action=AuditAction.IMPORT,
                operator=operator,
                comment=f"从特征快照 {snapshot_id} 导入，原始行号: {original_line}",
            )

            if used_default and missing_feats:
                record.change_status(
                    new_status=RecordStatus.SUSPICIOUS_DEFAULT_SCORE,
                    operator="system",
                    comment=f"检测到特征缺失并使用默认分，待人工复核。缺失特征: {', '.join(missing_feats)}",
                )

            records.append(record)

        return records

    def calculate_class_weights(
        self, records: List[ResampleRecord], label_col: str
    ) -> Dict[int, float]:
        labels = []
        for rec in records:
            label = rec.snapshot.raw_data.get(label_col)
            if label is not None:
                labels.append(int(label))

        if not labels:
            return {0: 1.0, 1: 1.0}

        unique, counts = np.unique(labels, return_counts=True)
        total = len(labels)
        weights = {}
        for cls, cnt in zip(unique, counts):
            weights[int(cls)] = total / (len(unique) * cnt)

        return weights

    def apply_resampling_weights(
        self,
        session: ResampleSession,
        label_col: str,
        operator: str,
    ) -> ResampleSession:
        weights = self.calculate_class_weights(session.records, label_col)

        for record in session.records:
            label = record.snapshot.raw_data.get(label_col)
            if label is not None:
                base_weight = weights.get(int(label), 1.0)
            else:
                base_weight = 1.0

            if record.current_status == RecordStatus.SUSPICIOUS_DEFAULT_SCORE:
                base_weight = base_weight * 0.5
                record.add_audit_entry(
                    action=AuditAction.MANUAL_EDIT,
                    operator=operator,
                    field_name="final_weight",
                    old_value=record.final_weight,
                    new_value=base_weight,
                    comment="特征缺失使用默认分的记录，权重临时减半，待推荐负责人复核",
                )
            elif record.current_status == RecordStatus.EXCLUDED:
                base_weight = 0.0

            record.final_weight = base_weight

        return session

    def get_boundary_rules(self) -> Dict[str, Any]:
        return {
            "missing_feature_detection": {
                "trigger_value": self.missing_feature_default_value,
                "description": "特征值等于该值时判定为缺失",
            },
            "default_score_detection": {
                "threshold": self.default_score_threshold,
                "conditions": [
                    "存在特征缺失",
                    "模型分精确等于阈值",
                ],
                "action": "标记为 SUSPICIOUS_DEFAULT_SCORE，等待人工复核",
            },
            "weight_rules": {
                "suspicious_default_score": "权重减半，待复核",
                "excluded": "权重为0，不参与训练",
                "needs_recheck": "保持基础权重，标记高亮",
            },
            "rollback_policy": {
                "supported": True,
                "audit_required": True,
                "rollback_creates_new_record": True,
            },
        }
