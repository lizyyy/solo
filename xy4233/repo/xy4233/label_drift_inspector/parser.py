"""
解析校验模块 - 负责解析和验证各种输入数据格式
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import yaml

from .models import (
    AnnotationRecord,
    ImportValidationResult,
    LabelSchema,
    PredictionRecord,
    SamplingFeedback,
    SplitType,
)


class LabelSchemaParser:
    @staticmethod
    def parse(file_path: Path) -> LabelSchema:
        with open(file_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        labels = data.get("labels", {})
        if isinstance(labels, list):
            labels = {label: label for label in labels}
        elif not isinstance(labels, dict):
            raise ValueError("Invalid labels format: must be list or dict")

        parent_labels = data.get("parent_labels", {})
        if not isinstance(parent_labels, dict):
            parent_labels = {}

        return LabelSchema(
            name=data.get("name", "intent_labels"),
            version=str(data.get("version", "1.0.0")),
            labels=labels,
            parent_labels=parent_labels,
            created_at=datetime.now(),
        )

    @staticmethod
    def validate_version(
        current_schema: LabelSchema, expected_version: Optional[str] = None
    ) -> Tuple[bool, List[str]]:
        warnings = []
        is_valid = True

        if expected_version and current_schema.version != expected_version:
            warnings.append(
                f"版本不匹配: 期望 {expected_version}, 实际 {current_schema.version}"
            )
            is_valid = False

        if len(current_schema.labels) == 0:
            warnings.append("标签体系为空")
            is_valid = False

        return is_valid, warnings


class AnnotationParser:
    REQUIRED_FIELDS = ["session_id", "text", "label", "annotator_id"]

    @staticmethod
    def parse_jsonl(file_path: Path) -> List[AnnotationRecord]:
        records = []
        with open(file_path, "r", encoding="utf-8") as f:
            for line_idx, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    record = AnnotationParser._parse_record(data, line_idx)
                    records.append(record)
                except json.JSONDecodeError as e:
                    raise ValueError(f"第 {line_idx} 行 JSON 解析错误: {e}")
                except KeyError as e:
                    raise ValueError(f"第 {line_idx} 行缺少必需字段: {e}")
                except Exception as e:
                    raise ValueError(f"第 {line_idx} 行解析错误: {e}")
        return records

    @staticmethod
    def _parse_record(data: Dict[str, Any], line_idx: int) -> AnnotationRecord:
        for field in AnnotationParser.REQUIRED_FIELDS:
            if field not in data:
                raise KeyError(field)

        split_str = data.get("split", "unknown").lower()
        try:
            split = SplitType(split_str)
        except ValueError:
            split = SplitType.UNKNOWN

        annotated_at_str = data.get("annotated_at")
        if annotated_at_str:
            try:
                annotated_at = datetime.fromisoformat(annotated_at_str)
            except ValueError:
                annotated_at = datetime.now()
        else:
            annotated_at = datetime.now()

        return AnnotationRecord(
            session_id=str(data["session_id"]),
            turn_id=str(data["turn_id"]) if data.get("turn_id") else None,
            text=str(data["text"]),
            label=str(data["label"]),
            annotator_id=str(data["annotator_id"]),
            annotated_at=annotated_at,
            split=split,
            metadata=data.get("metadata", {}),
        )

    @staticmethod
    def validate_records(
        records: List[AnnotationRecord], schema: LabelSchema
    ) -> Tuple[List[Dict[str, Any]], List[str]]:
        errors = []
        warnings = []

        invalid_labels = set()
        valid_annotators = set()
        invalid_annotators = set()

        for record in records:
            if not schema.validate_label(record.label):
                invalid_labels.add(record.label)
                errors.append(
                    {
                        "session_id": record.session_id,
                        "turn_id": record.turn_id,
                        "error_type": "invalid_label",
                        "details": f"标签 '{record.label}' 不在标签体系中",
                    }
                )

            if len(record.text.strip()) == 0:
                errors.append(
                    {
                        "session_id": record.session_id,
                        "turn_id": record.turn_id,
                        "error_type": "empty_text",
                        "details": "文本内容为空",
                    }
                )

        if invalid_labels:
            warnings.append(f"发现 {len(invalid_labels)} 个无效标签: {list(invalid_labels)}")

        return errors, warnings


class PredictionParser:
    REQUIRED_FIELDS = ["session_id", "predicted_label", "confidence", "model_version"]

    @staticmethod
    def parse_csv(file_path: Path) -> List[PredictionRecord]:
        df = pd.read_csv(file_path)
        records = []

        for idx, row in df.iterrows():
            try:
                record = PredictionParser._parse_row(row, idx + 1)
                records.append(record)
            except KeyError as e:
                raise ValueError(f"第 {idx + 1} 行缺少必需字段: {e}")
            except Exception as e:
                raise ValueError(f"第 {idx + 1} 行解析错误: {e}")

        return records

    @staticmethod
    def _parse_row(row: pd.Series, line_idx: int) -> PredictionRecord:
        for field in PredictionParser.REQUIRED_FIELDS:
            if field not in row.index:
                raise KeyError(field)

        predicted_at_str = row.get("predicted_at")
        if pd.notna(predicted_at_str):
            try:
                predicted_at = pd.to_datetime(predicted_at_str).to_pydatetime()
            except (ValueError, TypeError):
                predicted_at = datetime.now()
        else:
            predicted_at = datetime.now()

        confidence = float(row["confidence"])
        if confidence < 0 or confidence > 1:
            confidence = max(0.0, min(1.0, confidence))

        return PredictionRecord(
            session_id=str(row["session_id"]),
            turn_id=str(row["turn_id"]) if pd.notna(row.get("turn_id")) else None,
            predicted_label=str(row["predicted_label"]),
            confidence=confidence,
            model_version=str(row["model_version"]),
            predicted_at=predicted_at,
            metadata={},
        )


class SamplingFeedbackParser:
    @staticmethod
    def parse_csv(file_path: Path) -> List[SamplingFeedback]:
        df = pd.read_csv(file_path)
        records = []

        for idx, row in df.iterrows():
            try:
                record = SamplingFeedbackParser._parse_row(row, idx + 1)
                records.append(record)
            except Exception as e:
                raise ValueError(f"第 {idx + 1} 行解析错误: {e}")

        return records

    @staticmethod
    def _parse_row(row: pd.Series, line_idx: int) -> SamplingFeedback:
        is_agreement = row.get("is_agreement", True)
        if isinstance(is_agreement, str):
            is_agreement = is_agreement.lower() in ["true", "yes", "1", "y"]

        reviewed_at_str = row.get("reviewed_at")
        if pd.notna(reviewed_at_str):
            try:
                reviewed_at = pd.to_datetime(reviewed_at_str).to_pydatetime()
            except (ValueError, TypeError):
                reviewed_at = datetime.now()
        else:
            reviewed_at = datetime.now()

        return SamplingFeedback(
            session_id=str(row.get("session_id", "")),
            turn_id=str(row["turn_id"]) if pd.notna(row.get("turn_id")) else None,
            original_label=str(row.get("original_label", "")),
            reviewer_label=str(row.get("reviewer_label", "")),
            reviewer_id=str(row.get("reviewer_id", "")),
            is_agreement=bool(is_agreement),
            feedback_notes=str(row.get("feedback_notes", "")),
            reviewed_at=reviewed_at,
        )


class DataValidator:
    @staticmethod
    def run_import_validation(
        annotations: List[AnnotationRecord],
        schema: LabelSchema,
        predictions: Optional[List[PredictionRecord]] = None,
        feedbacks: Optional[List[SamplingFeedback]] = None,
    ) -> ImportValidationResult:
        total_records = len(annotations)
        errors = []
        warnings = []

        annot_errors, annot_warnings = AnnotationParser.validate_records(annotations, schema)
        errors.extend(annot_errors)
        warnings.extend(annot_warnings)

        if predictions:
            prediction_sessions = {p.session_id for p in predictions}
            annotation_sessions = {a.session_id for a in annotations}
            missing_annotations = prediction_sessions - annotation_sessions
            if missing_annotations:
                warnings.append(
                    f"预测数据中有 {len(missing_annotations)} 个会话在标注数据中不存在"
                )

            low_confidence = [p for p in predictions if p.confidence < 0.5]
            if low_confidence:
                warnings.append(
                    f"发现 {len(low_confidence)} 个低置信度预测 (< 0.5)"
                )

        if feedbacks:
            agreement_rate = sum(1 for f in feedbacks if f.is_agreement) / len(feedbacks)
            if agreement_rate < 0.8:
                warnings.append(
                    f"抽检一致率较低: {agreement_rate:.2%}"
                )

        valid_records = total_records - len(
            [e for e in errors if e["error_type"] in ["invalid_label", "empty_text"]]
        )

        return ImportValidationResult(
            is_valid=len(errors) == 0,
            total_records=total_records,
            valid_records=valid_records,
            invalid_records=total_records - valid_records,
            errors=errors,
            warnings=warnings,
            schema_info={
                "name": schema.name,
                "version": schema.version,
                "label_count": len(schema.labels),
                "labels": schema.all_labels,
            },
        )
