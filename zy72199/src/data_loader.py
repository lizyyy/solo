import json
import csv
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Tuple
import logging

from .data_models import (
    EvaluationRecord,
    AnnotationRecord,
    ConflictCase,
    LabelType,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DataLoader:
    def __init__(self):
        self.records: List[EvaluationRecord] = []
        self.annotations: Dict[str, AnnotationRecord] = {}
        self.conflict_cases: Dict[str, ConflictCase] = {}

    def load_evaluation_logs(self, file_path: Path) -> List[EvaluationRecord]:
        logger.info(f"加载评测日志: {file_path}")
        records = []
        empty_count = 0

        with open(file_path, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue

                try:
                    data = json.loads(line)
                except json.JSONDecodeError as e:
                    logger.warning(f"第{line_num}行JSON解析失败: {e}")
                    continue

                required_fields = ["sample_id", "problem_id", "model_output", "model_version", "score", "timestamp"]
                missing = [f for f in required_fields if f not in data]
                if missing:
                    logger.warning(f"第{line_num}行缺少字段: {missing}，跳过")
                    continue

                try:
                    timestamp = datetime.fromisoformat(data["timestamp"])
                except (ValueError, TypeError):
                    logger.warning(f"第{line_num}行时间格式错误: {data['timestamp']}，跳过")
                    continue

                record = EvaluationRecord(
                    sample_id=data["sample_id"],
                    problem_id=data["problem_id"],
                    model_output=str(data.get("model_output", "")),
                    model_version=data["model_version"],
                    score=float(data.get("score", 0.0)),
                    timestamp=timestamp,
                    raw_source=data,
                )

                records.append(record)

                if record.is_empty():
                    empty_count += 1

        self.records.extend(records)
        logger.info(f"成功加载 {len(records)} 条评测记录，其中空值 {empty_count} 条")
        return records

    def load_annotations(self, file_path: Path) -> Dict[str, AnnotationRecord]:
        logger.info(f"加载标注表: {file_path}")
        annotations = {}

        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, 2):
                try:
                    label_str = row.get("human_label", "pending").lower()
                    try:
                        label = LabelType(label_str)
                    except ValueError:
                        logger.warning(f"第{row_num}行标签无效: {label_str}，使用pending")
                        label = LabelType.PENDING

                    try:
                        ann_time = datetime.fromisoformat(row["annotation_time"])
                    except (ValueError, KeyError):
                        ann_time = datetime.now()
                        logger.warning(f"第{row_num}行标注时间缺失或格式错误，使用当前时间")

                    ann = AnnotationRecord(
                        sample_id=row["sample_id"],
                        problem_id=row.get("problem_id", ""),
                        human_label=label,
                        annotator=row.get("annotator", "unknown"),
                        annotation_time=ann_time,
                        confidence=row.get("confidence", "medium"),
                        notes=row.get("notes", ""),
                    )
                    annotations[ann.sample_id] = ann
                except Exception as e:
                    logger.warning(f"第{row_num}行解析失败: {e}")
                    continue

        self.annotations.update(annotations)
        logger.info(f"成功加载 {len(annotations)} 条标注记录")
        return annotations

    def load_conflict_cases(self, file_path: Path) -> Dict[str, ConflictCase]:
        logger.info(f"加载冲突案例: {file_path}")
        cases = {}

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            for item in data:
                case = ConflictCase(
                    case_id=item["case_id"],
                    sample_id=item["sample_id"],
                    description=item["description"],
                    expected_action=item["expected_action"],
                    severity=item["severity"],
                )
                cases[case.sample_id] = case

        self.conflict_cases.update(cases)
        logger.info(f"成功加载 {len(cases)} 条冲突案例")
        return cases

    def load_all(
        self,
        logs_path: Path,
        annotations_path: Path,
        conflicts_path: Path,
    ) -> Tuple[List[EvaluationRecord], Dict[str, AnnotationRecord], Dict[str, ConflictCase]]:
        records = self.load_evaluation_logs(logs_path)
        annotations = self.load_annotations(annotations_path)
        conflicts = self.load_conflict_cases(conflicts_path)
        return records, annotations, conflicts

    def get_statistics(self) -> Dict:
        total = len(self.records)
        unique_samples = len(set(r.sample_id for r in self.records))
        empty_count = sum(1 for r in self.records if r.is_empty())
        version_counts = {}
        for r in self.records:
            version_counts[r.model_version] = version_counts.get(r.model_version, 0) + 1

        return {
            "total_records": total,
            "unique_samples": unique_samples,
            "empty_records": empty_count,
            "duplicate_potential": total - unique_samples,
            "version_distribution": version_counts,
            "annotated_samples": len(self.annotations),
            "conflict_cases": len(self.conflict_cases),
        }
