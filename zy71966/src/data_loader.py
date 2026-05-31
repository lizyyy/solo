"""数据导入模块：处理混合材料包，包括正常记录、晚到附件、重复项、人工更正"""
import os
import hashlib
import pandas as pd
from datetime import datetime
from typing import List, Dict, Tuple, Optional
from pathlib import Path

from .models import (
    DataRecord, RecordType, AnnotationSample, EvaluationRecord
)


def generate_id(prefix: str, content: str) -> str:
    """生成稳定的ID"""
    hash_str = hashlib.md5(content.encode()).hexdigest()[:8]
    return f"{prefix}_{hash_str}"


class DataLoader:
    """数据加载器"""

    def __init__(self, label_mapping: Optional[Dict[str, str]] = None):
        self.label_mapping = label_mapping or {}
        self.records: Dict[str, DataRecord] = {}
        self.sample_index: Dict[str, List[str]] = {}
        self.duplicate_groups: Dict[str, List[str]] = {}

    def load_material_package(self, package_path: str) -> List[DataRecord]:
        """加载材料包目录下的所有文件"""
        package = Path(package_path)
        if not package.exists():
            raise FileNotFoundError(f"材料包目录不存在: {package_path}")

        records = []

        for file_path in sorted(package.glob("**/*.csv")):
            records.extend(self._load_csv_file(file_path))

        for file_path in sorted(package.glob("**/*.txt")):
            records.extend(self._load_text_file(file_path))

        return records

    def _load_csv_file(self, file_path: Path) -> List[DataRecord]:
        """加载CSV文件"""
        df = pd.read_csv(file_path)
        records = []

        file_tag = self._detect_file_tag(file_path.name)

        for idx, row in df.iterrows():
            record = self._parse_row(row, file_path, idx + 2, file_tag)
            if record:
                records.append(record)
                self._index_record(record)

        return records

    def _detect_file_tag(self, filename: str) -> Optional[RecordType]:
        """根据文件名检测记录类型"""
        name = filename.lower()
        if "late" in name or "attachment" in name or "补传" in name or "晚到" in name:
            return RecordType.LATE_ATTACHMENT
        elif "dup" in name or "duplicate" in name or "重复" in name:
            return RecordType.DUPLICATE
        elif "correction" in name or "correct" in name or "更正" in name or "返工" in name:
            return RecordType.MANUAL_CORRECTION
        return None

    def _parse_row(
        self, row: pd.Series, file_path: Path, line_num: int,
        file_tag: Optional[RecordType]
    ) -> Optional[DataRecord]:
        """解析单行数据"""
        row_dict = row.to_dict()

        if "text" in row_dict and "label" in row_dict:
            return self._parse_annotation_row(row_dict, file_path, line_num, file_tag)
        elif "predicted_label" in row_dict or "ground_truth" in row_dict:
            return self._parse_evaluation_row(row_dict, file_path, line_num, file_tag)
        elif "sample_text" in row_dict:
            row_dict["text"] = row_dict.pop("sample_text")
            if "true_label" in row_dict:
                row_dict["label"] = row_dict.pop("true_label")
            return self._parse_annotation_row(row_dict, file_path, line_num, file_tag)

        return None

    def _parse_annotation_row(
        self, row: Dict, file_path: Path, line_num: int,
        file_tag: Optional[RecordType]
    ) -> DataRecord:
        """解析标注样本行"""
        text = str(row.get("text", ""))
        label = str(row.get("label", ""))

        content_hash = hashlib.md5(text.encode()).hexdigest()
        sample_id = generate_id("S", text + label)

        annotated_at = self._parse_datetime(row.get("annotated_at", row.get("timestamp", "")))
        received_at = self._parse_datetime(row.get("received_at", ""))

        record_type = file_tag or RecordType.NORMAL

        label_source = row.get("label_source", "")
        if label_source == "manual_correction" or "更正" in str(row.get("note", "")):
            record_type = RecordType.MANUAL_CORRECTION

        sample = AnnotationSample(
            sample_id=sample_id,
            text=text,
            label=label,
            annotator=str(row.get("annotator", "unknown")),
            annotated_at=annotated_at,
            source_file=str(file_path),
            source_line=line_num,
            confidence=float(row.get("confidence", 1.0)),
            metadata={k: v for k, v in row.items() if k not in [
                "text", "label", "annotator", "annotated_at", "timestamp",
                "received_at", "confidence", "note"
            ]}
        )

        parent_id = row.get("parent_record_id") or row.get("original_id")

        record = DataRecord(
            record_id=generate_id("R", sample_id + str(line_num) + str(file_path)),
            record_type=record_type,
            sample=sample,
            parent_record_id=parent_id if pd.notna(parent_id) else None,
            received_at=received_at if received_at else annotated_at,
            note=str(row.get("note", "")),
            metadata={"content_hash": content_hash}
        )

        return record

    def _parse_evaluation_row(
        self, row: Dict, file_path: Path, line_num: int,
        file_tag: Optional[RecordType]
    ) -> DataRecord:
        """解析评估记录行"""
        sample_id = str(row.get("sample_id", generate_id("S", str(row.get("text", "")))))
        eval_id = generate_id("E", sample_id + str(row.get("model_version", "")) + str(line_num))

        predicted = str(row.get("predicted_label", ""))
        ground_truth = str(row.get("ground_truth", ""))
        is_correct = predicted == ground_truth

        evaluated_at = self._parse_datetime(row.get("evaluated_at", row.get("timestamp", "")))
        received_at = self._parse_datetime(row.get("received_at", ""))

        metrics = {}
        for k in ["precision", "recall", "f1", "accuracy"]:
            if k in row and pd.notna(row[k]):
                metrics[k] = float(row[k])

        evaluation = EvaluationRecord(
            eval_id=eval_id,
            sample_id=sample_id,
            predicted_label=predicted,
            ground_truth=ground_truth,
            is_correct=is_correct,
            evaluator=str(row.get("evaluator", "unknown")),
            evaluated_at=evaluated_at,
            source_file=str(file_path),
            source_line=line_num,
            model_version=str(row.get("model_version", "unknown")),
            metrics=metrics,
            metadata={k: v for k, v in row.items() if k not in [
                "sample_id", "predicted_label", "ground_truth", "evaluator",
                "evaluated_at", "model_version", "precision", "recall",
                "f1", "accuracy", "note"
            ]}
        )

        record_type = file_tag or RecordType.NORMAL

        record = DataRecord(
            record_id=generate_id("R", eval_id + str(line_num)),
            record_type=record_type,
            evaluation=evaluation,
            received_at=received_at if received_at else evaluated_at,
            note=str(row.get("note", ""))
        )

        return record

    def _load_text_file(self, file_path: Path) -> List[DataRecord]:
        """加载文本文件（日志格式）"""
        records = []
        with open(file_path, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line or line.startswith("#"):
                    continue

                record = self._parse_log_line(line, file_path, line_num)
                if record:
                    records.append(record)
                    self._index_record(record)

        return records

    def _parse_log_line(self, line: str, file_path: Path, line_num: int) -> Optional[DataRecord]:
        """解析日志行"""
        if "TEXT:" in line and "LABEL:" in line:
            parts = line.split("\t")
            data = {}
            for part in parts:
                if ":" in part:
                    k, v = part.split(":", 1)
                    data[k.strip()] = v.strip()

            if "TEXT" in data and "LABEL" in data:
                return self._parse_annotation_row({
                    "text": data["TEXT"],
                    "label": data["LABEL"],
                    "annotator": data.get("ANNOTATOR", "unknown"),
                    "annotated_at": data.get("TIME", ""),
                    "note": data.get("NOTE", "")
                }, file_path, line_num, None)

        return None

    def _parse_datetime(self, value) -> datetime:
        """解析日期时间"""
        if pd.isna(value) or not value:
            return datetime.now()
        if isinstance(value, datetime):
            return value
        try:
            return pd.to_datetime(str(value)).to_pydatetime()
        except:
            return datetime.now()

    def _index_record(self, record: DataRecord):
        """索引记录以便后续检测"""
        self.records[record.record_id] = record

        if record.sample:
            content_hash = record.metadata.get("content_hash")
            if content_hash:
                if content_hash not in self.duplicate_groups:
                    self.duplicate_groups[content_hash] = []
                self.duplicate_groups[content_hash].append(record.record_id)

            if record.sample.sample_id not in self.sample_index:
                self.sample_index[record.sample.sample_id] = []
            self.sample_index[record.sample.sample_id].append(record.record_id)

    def detect_duplicates(self) -> Dict[str, List[str]]:
        """检测重复项"""
        return {
            h: ids for h, ids in self.duplicate_groups.items()
            if len(ids) > 1
        }

    def get_all_records(self) -> List[DataRecord]:
        """获取所有记录"""
        return list(self.records.values())

    def get_records_by_type(self, record_type: RecordType) -> List[DataRecord]:
        """按类型获取记录"""
        return [r for r in self.records.values() if r.record_type == record_type]

    def get_records_by_sample_id(self, sample_id: str) -> List[DataRecord]:
        """按样本ID获取关联记录"""
        record_ids = self.sample_index.get(sample_id, [])
        return [self.records[rid] for rid in record_ids if rid in self.records]
