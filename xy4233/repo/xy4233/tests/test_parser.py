"""
测试解析校验模块
"""

import json
from datetime import datetime
from pathlib import Path
from tempfile import TemporaryDirectory

import pandas as pd
import pytest
import yaml

from label_drift_inspector.models import (
    AnnotationRecord,
    SplitType,
)
from label_drift_inspector.parser import (
    AnnotationParser,
    DataValidator,
    LabelSchemaParser,
    PredictionParser,
    SamplingFeedbackParser,
)


class TestLabelSchemaParser:
    def test_parse_yaml_with_dict_labels(self):
        with TemporaryDirectory() as tmp:
            schema_path = Path(tmp) / "schema.yaml"
            schema_data = {
                "name": "test_schema",
                "version": "1.0.0",
                "labels": {
                    "label1": "描述1",
                    "label2": "描述2",
                },
            }
            with open(schema_path, "w", encoding="utf-8") as f:
                yaml.dump(schema_data, f)

            schema = LabelSchemaParser.parse(schema_path)

            assert schema.name == "test_schema"
            assert schema.version == "1.0.0"
            assert set(schema.all_labels) == {"label1", "label2"}

    def test_parse_yaml_with_list_labels(self):
        with TemporaryDirectory() as tmp:
            schema_path = Path(tmp) / "schema.yaml"
            schema_data = {
                "name": "test_schema",
                "version": "1.0.0",
                "labels": ["label1", "label2", "label3"],
            }
            with open(schema_path, "w", encoding="utf-8") as f:
                yaml.dump(schema_data, f)

            schema = LabelSchemaParser.parse(schema_path)

            assert set(schema.all_labels) == {"label1", "label2", "label3"}
            assert schema.labels["label1"] == "label1"

    def test_validate_version_mismatch(self):
        from label_drift_inspector.models import LabelSchema

        schema = LabelSchema(
            name="test",
            version="2.0.0",
            labels={"label": "描述"},
        )

        is_valid, warnings = LabelSchemaParser.validate_version(schema, "1.0.0")

        assert is_valid is False
        assert len(warnings) == 1
        assert "版本不匹配" in warnings[0]

    def test_validate_version_match(self):
        from label_drift_inspector.models import LabelSchema

        schema = LabelSchema(
            name="test",
            version="1.0.0",
            labels={"label": "描述"},
        )

        is_valid, warnings = LabelSchemaParser.validate_version(schema, "1.0.0")

        assert is_valid is True
        assert len(warnings) == 0


class TestAnnotationParser:
    def test_parse_jsonl_valid(self):
        with TemporaryDirectory() as tmp:
            jsonl_path = Path(tmp) / "annotations.jsonl"
            records = [
                {
                    "session_id": "s001",
                    "turn_id": "t01",
                    "text": "测试文本1",
                    "label": "label1",
                    "annotator_id": "a01",
                    "annotated_at": datetime.now().isoformat(),
                    "split": "train",
                },
                {
                    "session_id": "s002",
                    "turn_id": None,
                    "text": "测试文本2",
                    "label": "label2",
                    "annotator_id": "a02",
                },
            ]

            with open(jsonl_path, "w", encoding="utf-8") as f:
                for record in records:
                    f.write(json.dumps(record, ensure_ascii=False) + "\n")

            parsed = AnnotationParser.parse_jsonl(jsonl_path)

            assert len(parsed) == 2
            assert parsed[0].session_id == "s001"
            assert parsed[0].split == SplitType.TRAIN
            assert parsed[1].session_id == "s002"
            assert parsed[1].split == SplitType.UNKNOWN

    def test_parse_jsonl_invalid_json(self):
        with TemporaryDirectory() as tmp:
            jsonl_path = Path(tmp) / "annotations.jsonl"
            with open(jsonl_path, "w", encoding="utf-8") as f:
                f.write('{"session_id": "s001"}\n')
                f.write("invalid json\n")

            with pytest.raises(ValueError, match="JSON 解析错误"):
                AnnotationParser.parse_jsonl(jsonl_path)

    def test_parse_jsonl_missing_field(self):
        with TemporaryDirectory() as tmp:
            jsonl_path = Path(tmp) / "annotations.jsonl"
            with open(jsonl_path, "w", encoding="utf-8") as f:
                f.write('{"session_id": "s001", "text": "test"}\n')

            with pytest.raises(ValueError, match="缺少必需字段"):
                AnnotationParser.parse_jsonl(jsonl_path)

    def test_validate_records_invalid_label(self):
        from label_drift_inspector.models import LabelSchema

        schema = LabelSchema(
            name="test",
            version="1.0.0",
            labels={"valid_label": "有效标签"},
        )

        now = datetime.now()
        records = [
            AnnotationRecord(
                session_id="s001",
                turn_id=None,
                text="有效文本",
                label="valid_label",
                annotator_id="a01",
                annotated_at=now,
            ),
            AnnotationRecord(
                session_id="s002",
                turn_id=None,
                text="有效文本",
                label="invalid_label",
                annotator_id="a01",
                annotated_at=now,
            ),
        ]

        errors, warnings = AnnotationParser.validate_records(records, schema)

        assert len(errors) == 1
        assert errors[0]["error_type"] == "invalid_label"
        assert errors[0]["session_id"] == "s002"

    def test_validate_records_empty_text(self):
        from label_drift_inspector.models import LabelSchema

        schema = LabelSchema(
            name="test",
            version="1.0.0",
            labels={"label": "描述"},
        )

        now = datetime.now()
        records = [
            AnnotationRecord(
                session_id="s001",
                turn_id=None,
                text="   ",
                label="label",
                annotator_id="a01",
                annotated_at=now,
            ),
        ]

        errors, warnings = AnnotationParser.validate_records(records, schema)

        assert len(errors) == 1
        assert errors[0]["error_type"] == "empty_text"


class TestPredictionParser:
    def test_parse_csv_valid(self):
        with TemporaryDirectory() as tmp:
            csv_path = Path(tmp) / "predictions.csv"
            df = pd.DataFrame(
                {
                    "session_id": ["s001", "s002", "s003"],
                    "turn_id": ["t01", None, "t03"],
                    "predicted_label": ["label1", "label2", "label1"],
                    "confidence": [0.95, 0.80, 0.50],
                    "model_version": ["v1.0", "v1.0", "v1.0"],
                }
            )
            df.to_csv(csv_path, index=False, encoding="utf-8-sig")

            parsed = PredictionParser.parse_csv(csv_path)

            assert len(parsed) == 3
            assert parsed[0].session_id == "s001"
            assert parsed[0].confidence == 0.95
            assert parsed[0].predicted_label == "label1"
            assert parsed[1].turn_id is None

    def test_parse_csv_missing_field(self):
        with TemporaryDirectory() as tmp:
            csv_path = Path(tmp) / "predictions.csv"
            df = pd.DataFrame(
                {
                    "session_id": ["s001"],
                    "predicted_label": ["label1"],
                }
            )
            df.to_csv(csv_path, index=False, encoding="utf-8-sig")

            with pytest.raises(ValueError, match="缺少必需字段"):
                PredictionParser.parse_csv(csv_path)


class TestSamplingFeedbackParser:
    def test_parse_csv_valid(self):
        with TemporaryDirectory() as tmp:
            csv_path = Path(tmp) / "feedback.csv"
            df = pd.DataFrame(
                {
                    "session_id": ["s001", "s002"],
                    "turn_id": [None, "t02"],
                    "original_label": ["label1", "label2"],
                    "reviewer_label": ["label1", "label3"],
                    "reviewer_id": ["r01", "r01"],
                    "is_agreement": [True, False],
                    "feedback_notes": ["确认无误", "应该是label3"],
                }
            )
            df.to_csv(csv_path, index=False, encoding="utf-8-sig")

            parsed = SamplingFeedbackParser.parse_csv(csv_path)

            assert len(parsed) == 2
            assert parsed[0].session_id == "s001"
            assert parsed[0].is_agreement is True
            assert parsed[1].is_agreement is False
            assert parsed[1].reviewer_label == "label3"


class TestDataValidator:
    def test_run_import_validation_all_valid(self):
        from label_drift_inspector.models import LabelSchema

        schema = LabelSchema(
            name="test",
            version="1.0.0",
            labels={"label1": "描述1", "label2": "描述2"},
        )

        now = datetime.now()
        annotations = [
            AnnotationRecord(
                session_id=f"s{i:03d}",
                turn_id=None,
                text=f"测试文本{i}",
                label="label1" if i % 2 == 0 else "label2",
                annotator_id=f"a{i % 3 + 1:02d}",
                annotated_at=now,
            )
            for i in range(10)
        ]

        result = DataValidator.run_import_validation(
            annotations=annotations,
            schema=schema,
        )

        assert result.is_valid is True
        assert result.total_records == 10
        assert result.valid_records == 10
        assert result.invalid_records == 0
        assert len(result.errors) == 0

    def test_run_import_validation_with_errors(self):
        from label_drift_inspector.models import LabelSchema

        schema = LabelSchema(
            name="test",
            version="1.0.0",
            labels={"valid_label": "有效标签"},
        )

        now = datetime.now()
        annotations = [
            AnnotationRecord(
                session_id="s001",
                turn_id=None,
                text="有效文本",
                label="valid_label",
                annotator_id="a01",
                annotated_at=now,
            ),
            AnnotationRecord(
                session_id="s002",
                turn_id=None,
                text="",
                label="valid_label",
                annotator_id="a01",
                annotated_at=now,
            ),
            AnnotationRecord(
                session_id="s003",
                turn_id=None,
                text="有效文本",
                label="invalid_label",
                annotator_id="a01",
                annotated_at=now,
            ),
        ]

        result = DataValidator.run_import_validation(
            annotations=annotations,
            schema=schema,
        )

        assert result.is_valid is False
        assert result.total_records == 3
        assert result.valid_records == 1
        assert result.invalid_records == 2
        assert len(result.errors) == 2
