import json
import csv
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional
from .models import (
    EvalSlice,
    FeatureInfo,
    FeatureStatus,
    YamlParams,
    ReviewStatus,
)


class SliceImporter:
    def __init__(self, yaml_params: Optional[YamlParams] = None):
        self.yaml_params = yaml_params

    def set_yaml_params(self, yaml_params: YamlParams):
        self.yaml_params = yaml_params

    def import_from_json(self, json_path: str) -> List[EvalSlice]:
        path = Path(json_path)
        if not path.exists():
            raise FileNotFoundError(f"评测切片文件不存在: {json_path}")

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if isinstance(data, list):
            return [self._parse_slice(item) for item in data]
        elif isinstance(data, dict) and "slices" in data:
            return [self._parse_slice(item) for item in data["slices"]]
        else:
            return [self._parse_slice(data)]

    def import_from_csv(self, csv_path: str) -> List[EvalSlice]:
        path = Path(csv_path)
        if not path.exists():
            raise FileNotFoundError(f"评测切片文件不存在: {csv_path}")

        slices = []
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                slices.append(self._parse_csv_row(row))
        return slices

    def _parse_slice(self, data: Dict[str, Any]) -> EvalSlice:
        slice_id = data.get("slice_id", f"slice_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}")
        ts = data.get("timestamp", datetime.now().isoformat())
        if isinstance(ts, str):
            timestamp = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        else:
            timestamp = ts

        reward_score = float(data.get("reward_score", 0.0))
        predicted_reward = float(data.get("predicted_reward", 0.0))
        context = data.get("context", {})

        features_data = data.get("features", {})
        features = self._detect_features(features_data)

        review_status = ReviewStatus(data.get("review_status", "pending"))
        reviewer_notes = data.get("reviewer_notes", "")

        return EvalSlice(
            slice_id=slice_id,
            timestamp=timestamp,
            features=features,
            reward_score=reward_score,
            predicted_reward=predicted_reward,
            context=context,
            review_status=review_status,
            reviewer_notes=reviewer_notes,
        )

    def _parse_csv_row(self, row: Dict[str, str]) -> EvalSlice:
        slice_id = row.get("slice_id", f"slice_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}")
        ts = row.get("timestamp", datetime.now().isoformat())
        try:
            timestamp = datetime.fromisoformat(ts)
        except (ValueError, TypeError):
            timestamp = datetime.now()

        reward_score = float(row.get("reward_score", 0.0))
        predicted_reward = float(row.get("predicted_reward", 0.0))

        features_data = {}
        if self.yaml_params:
            for feat_name in self.yaml_params.feature_list:
                if feat_name in row:
                    val = row[feat_name]
                    try:
                        features_data[feat_name] = float(val)
                    except (ValueError, TypeError):
                        features_data[feat_name] = val

        features = self._detect_features(features_data)

        return EvalSlice(
            slice_id=slice_id,
            timestamp=timestamp,
            features=features,
            reward_score=reward_score,
            predicted_reward=predicted_reward,
        )

    def _detect_features(self, features_data: Dict[str, Any]) -> Dict[str, FeatureInfo]:
        features = {}

        if not self.yaml_params:
            for name, value in features_data.items():
                features[name] = FeatureInfo(
                    name=name,
                    status=FeatureStatus.NORMAL,
                    actual_value=value,
                )
            return features

        expected_features = self.yaml_params.feature_list
        default_values = self.yaml_params.default_values
        descriptions = self.yaml_params.feature_descriptions
        thresholds = self.yaml_params.threshold_config

        for feat_name in expected_features:
            actual_value = features_data.get(feat_name)
            default_val = default_values.get(feat_name)
            description = descriptions.get(feat_name, "")
            threshold = thresholds.get(feat_name, {})

            if actual_value is None or actual_value == "":
                if default_val is not None:
                    status = FeatureStatus.MISSING_WITH_DEFAULT
                    confidence = 0.5
                else:
                    status = FeatureStatus.MISSING_NO_DEFAULT
                    confidence = 0.0
                actual_value = default_val
            else:
                if self._is_outlier(actual_value, threshold):
                    status = FeatureStatus.OUTLIER
                    confidence = 0.7
                else:
                    status = FeatureStatus.NORMAL
                    confidence = 1.0

            features[feat_name] = FeatureInfo(
                name=feat_name,
                status=status,
                actual_value=actual_value,
                default_value=default_val,
                description=description,
                confidence_score=confidence,
            )

        for feat_name, value in features_data.items():
            if feat_name not in features:
                features[feat_name] = FeatureInfo(
                    name=feat_name,
                    status=FeatureStatus.NORMAL,
                    actual_value=value,
                    description="非预期特征",
                    confidence_score=0.8,
                )

        return features

    def _is_outlier(self, value: Any, threshold: Dict[str, Any]) -> bool:
        if not isinstance(value, (int, float)):
            return False
        min_val = threshold.get("min")
        max_val = threshold.get("max")
        if min_val is not None and value < min_val:
            return True
        if max_val is not None and value > max_val:
            return True
        return False

    def get_slices_with_missing_features(self, slices: List[EvalSlice]) -> List[EvalSlice]:
        return [s for s in slices if s.has_missing_features]

    def generate_missing_report(self, slices: List[EvalSlice]) -> Dict[str, Any]:
        total = len(slices)
        missing_slices = self.get_slices_with_missing_features(slices)
        missing_count = len(missing_slices)

        feature_missing_count: Dict[str, int] = {}
        for s in missing_slices:
            for feat in s.missing_features:
                feature_missing_count[feat.name] = feature_missing_count.get(feat.name, 0) + 1

        return {
            "total_slices": total,
            "slices_with_missing": missing_count,
            "missing_ratio": missing_count / total if total > 0 else 0,
            "feature_missing_counts": feature_missing_count,
            "affected_slice_ids": [s.slice_id for s in missing_slices],
        }
