import json
import uuid
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from difflib import SequenceMatcher
import pandas as pd

from .models import (
    EvaluationLog,
    AnnotationRecord,
    AttributionResult,
    ThresholdConfig,
    ErrorType,
    AttributionStatus,
)
from . import PROJECT_ROOT


class ErrorAttributor:
    def __init__(self, threshold_config: Optional[ThresholdConfig] = None):
        self.threshold = threshold_config or ThresholdConfig(version="default")
        self.homophone_pairs = self._load_homophone_pairs()

    def _load_homophone_pairs(self) -> Dict[str, List[str]]:
        homophone_file = PROJECT_ROOT / "data" / "homophones.json"
        if homophone_file.exists():
            with open(homophone_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}

    def _calculate_similarity(self, word1: str, word2: str) -> float:
        if not word1 or not word2:
            return 0.0
        return SequenceMatcher(None, word1.lower(), word2.lower()).ratio()

    def _is_acronym(self, word: str) -> bool:
        if not word:
            return False
        return bool(re.match(r"^[A-Z0-9]{2,}$", word)) or (
            word.isupper() and len(word) >= 2
        )

    def _is_proper_noun(self, word: str) -> bool:
        if not word:
            return False
        proper_nouns = ["阿里巴巴", "腾讯", "百度", "华为", "小米", "北京", "上海", "广州", "深圳"]
        return word in proper_nouns or (word.istitle() and not word.isupper())

    def _detect_homophone(self, error_word: str, correct_word: str) -> Tuple[bool, float, List[str]]:
        if not error_word or not correct_word:
            return False, 0.0, []

        evidence = []
        similarity = self._calculate_similarity(error_word, correct_word)

        if similarity >= 0.8 and len(error_word) == len(correct_word):
            evidence.append(f"发音相似度: {similarity:.2f}")
            return True, similarity, evidence

        if correct_word in self.homophone_pairs:
            if error_word in self.homophone_pairs[correct_word]:
                evidence.append(f"匹配同音词表: {correct_word} -> {error_word}")
                return True, 0.95, evidence

        return False, similarity, evidence

    def _detect_acronym(self, error_word: str, correct_word: str) -> Tuple[bool, float, List[str]]:
        if not error_word or not correct_word:
            return False, 0.0, []

        evidence = []
        confidence = 0.0

        if self._is_acronym(error_word):
            evidence.append(f"错误词 '{error_word}' 符合缩写格式")
            confidence += 0.4

        if len(correct_word.split()) > 1:
            words = correct_word.split()
            acronym = "".join(w[0].upper() for w in words if w)
            if error_word.upper() == acronym:
                evidence.append(f"错误词匹配正确词首字母缩写: {correct_word} -> {acronym}")
                confidence = 0.95

        if confidence > 0:
            return confidence >= self.threshold.confidence_medium, confidence, evidence
        return False, 0.0, []

    def _detect_proper_noun(self, error_word: str, correct_word: str) -> Tuple[bool, float, List[str]]:
        if not error_word or not correct_word:
            return False, 0.0, []

        evidence = []
        confidence = 0.0

        if self._is_proper_noun(correct_word):
            evidence.append(f"正确词 '{correct_word}' 是专有名词")
            confidence += 0.3

        similarity = self._calculate_similarity(error_word, correct_word)
        if 0.5 <= similarity < 0.9:
            evidence.append(f"拼写相似度: {similarity:.2f}")
            confidence += similarity * 0.4

        if confidence > 0:
            return confidence >= self.threshold.confidence_low, confidence, evidence
        return False, 0.0, []

    def _is_empty(self, value: Any) -> bool:
        if value is None:
            return True
        if isinstance(value, float) and pd.isna(value):
            return True
        s = str(value).strip()
        if not s or s.lower() in ("nan", "none", "null"):
            return True
        return False

    def attribute_error(
        self,
        annotation: AnnotationRecord,
        eval_log: Optional[EvaluationLog] = None,
    ) -> AttributionResult:
        error_word = annotation.error_word
        correct_word = annotation.correct_word
        model_version = eval_log.model_version if eval_log else "unknown"

        if self._is_empty(error_word) or self._is_empty(correct_word):
            missing_parts = []
            if self._is_empty(error_word):
                missing_parts.append("error_word")
            if self._is_empty(correct_word):
                missing_parts.append("correct_word")
            evidence = [f"空值: 缺失字段 {', '.join(missing_parts)} (标注来源: {annotation.annotation_id})"]
            return AttributionResult(
                attribution_id=str(uuid.uuid4()),
                log_id=annotation.log_id,
                annotation_id=annotation.annotation_id,
                error_type=ErrorType.UNKNOWN.value,
                confidence=0.0,
                evidence=evidence,
                status=AttributionStatus.PENDING,
                threshold_version=self.threshold.version,
                model_version=model_version,
                created_at=datetime.now(),
            )

        detectors = [
            (ErrorType.HOMOPHONE, self._detect_homophone),
            (ErrorType.ACRONYM, self._detect_acronym),
            (ErrorType.PROPER_NOUN, self._detect_proper_noun),
        ]

        best_type = ErrorType.UNKNOWN
        best_confidence = 0.0
        best_evidence = ["未匹配到明确错误类型"]

        for error_type, detector in detectors:
            is_match, confidence, evidence = detector(error_word, correct_word)
            if is_match and confidence > best_confidence:
                best_type = error_type
                best_confidence = confidence
                best_evidence = evidence

        if best_confidence >= self.threshold.confidence_high:
            status = AttributionStatus.AUTO_ATTRIBUTED
        elif best_confidence >= self.threshold.confidence_low:
            status = AttributionStatus.PENDING
        else:
            status = AttributionStatus.PENDING
            best_evidence.append(f"置信度 {best_confidence:.2f} 低于阈值 {self.threshold.confidence_low}")

        return AttributionResult(
            attribution_id=str(uuid.uuid4()),
            log_id=annotation.log_id,
            annotation_id=annotation.annotation_id,
            error_type=best_type.value,
            confidence=best_confidence,
            evidence=best_evidence,
            status=status,
            threshold_version=self.threshold.version,
            model_version=model_version,
            created_at=datetime.now(),
        )

    def batch_attribute(
        self,
        annotations: List[AnnotationRecord],
        eval_logs: Optional[Dict[str, EvaluationLog]] = None,
    ) -> List[AttributionResult]:
        results = []
        seen_annotation_ids = set()
        triple_groups: Dict[Tuple[str, str, str], List[str]] = {}

        for annotation in annotations:
            if annotation.annotation_id in seen_annotation_ids:
                continue
            seen_annotation_ids.add(annotation.annotation_id)

            ew_norm = "" if self._is_empty(annotation.error_word) else annotation.error_word
            cw_norm = "" if self._is_empty(annotation.correct_word) else annotation.correct_word
            triple_key = (annotation.log_id, ew_norm, cw_norm)
            triple_groups.setdefault(triple_key, []).append(annotation.annotation_id)

            eval_log = None
            if eval_logs and annotation.log_id in eval_logs:
                eval_log = eval_logs[annotation.log_id]

            result = self.attribute_error(annotation, eval_log)
            results.append(result)

        for result in results:
            ew_norm = "" if self._is_empty(result.error_type) else ""
            key = None
            for triple_key, ann_ids in triple_groups.items():
                if result.annotation_id in ann_ids:
                    key = triple_key
                    break
            if key and len(triple_groups[key]) > 1:
                other_ids = [aid for aid in triple_groups[key] if aid != result.annotation_id]
                result.evidence.append(
                    f"重复三元组可复核: 同 log_id+错词+正确词 的其他标注 {', '.join(other_ids)} (本记录: {result.annotation_id})"
                )

        return results


class DataProcessor:
    def __init__(self, project_root: Optional[Path] = None):
        self.project_root = project_root or PROJECT_ROOT
        self.raw_dir = self.project_root / "data" / "raw"
        self.processed_dir = self.project_root / "data" / "processed"
        self.processed_dir.mkdir(parents=True, exist_ok=True)

    def load_evaluation_logs(self, filename: str) -> List[EvaluationLog]:
        file_path = self.raw_dir / filename
        if not file_path.exists():
            raise FileNotFoundError(f"Evaluation log file not found: {file_path}")

        if filename.endswith(".csv"):
            df = pd.read_csv(file_path)
        elif filename.endswith(".json"):
            df = pd.read_json(file_path)
        elif filename.endswith(".xlsx"):
            df = pd.read_excel(file_path)
        else:
            raise ValueError(f"Unsupported file format: {filename}")

        logs = []
        for _, row in df.iterrows():
            log = EvaluationLog.from_dict(
                {
                    "log_id": str(row.get("log_id", row.get("id", uuid.uuid4()))),
                    "audio_id": str(row.get("audio_id", "")),
                    "reference_text": str(row.get("reference_text", "")),
                    "asr_output": str(row.get("asr_output", "")),
                    "model_version": str(row.get("model_version", "")),
                    "wer": float(row.get("wer", 0.0)),
                    "cer": float(row.get("cer", 0.0)),
                    "created_at": row.get("created_at", datetime.now().isoformat()),
                    "source_file": filename,
                    "raw_data": row.to_dict(),
                }
            )
            logs.append(log)

        return logs

    def load_annotations(self, filename: str) -> List[AnnotationRecord]:
        file_path = self.raw_dir / filename
        if not file_path.exists():
            raise FileNotFoundError(f"Annotation file not found: {file_path}")

        if filename.endswith(".csv"):
            df = pd.read_csv(file_path)
        elif filename.endswith(".json"):
            df = pd.read_json(file_path)
        elif filename.endswith(".xlsx"):
            df = pd.read_excel(file_path)
        else:
            raise ValueError(f"Unsupported file format: {filename}")

        annotations = []
        for _, row in df.iterrows():
            annotation = AnnotationRecord.from_dict(
                {
                    "annotation_id": str(row.get("annotation_id", row.get("id", uuid.uuid4()))),
                    "log_id": str(row.get("log_id", "")),
                    "error_word": str(row.get("error_word", "")),
                    "correct_word": str(row.get("correct_word", "")),
                    "error_type": str(row.get("error_type", "unknown")),
                    "confidence": float(row.get("confidence", 0.0)),
                    "annotated_by": str(row.get("annotated_by", "system")),
                    "annotated_at": row.get("annotated_at", datetime.now().isoformat()),
                    "notes": str(row.get("notes", "")),
                    "is_valid": bool(row.get("is_valid", True)),
                }
            )
            annotations.append(annotation)

        return annotations

    def load_threshold_config(self, filename: str) -> ThresholdConfig:
        file_path = self.project_root / "data" / "thresholds" / filename
        if not file_path.exists():
            raise FileNotFoundError(f"Threshold config file not found: {file_path}")

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        return ThresholdConfig(
            version=data.get("version", "unknown"),
            confidence_high=float(data.get("confidence_high", 0.9)),
            confidence_medium=float(data.get("confidence_medium", 0.7)),
            confidence_low=float(data.get("confidence_low", 0.5)),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now(),
            created_by=data.get("created_by", "system"),
            description=data.get("description", ""),
        )

    def save_processed_data(
        self,
        data: List[Dict[str, Any]],
        filename: str,
        data_type: str = "attributions",
    ) -> Path:
        output_path = self.processed_dir / filename
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(
                {"type": data_type, "count": len(data), "records": data},
                f,
                ensure_ascii=False,
                indent=2,
            )
        return output_path
