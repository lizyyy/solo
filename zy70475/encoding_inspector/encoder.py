import chardet
from pathlib import Path
from typing import Dict, Any, Optional
import hashlib
import shutil
from datetime import datetime
from .config import ANOMALY_DIR, MIN_CONFIDENCE, SUPPORTED_ENCODINGS


class EncodingDetector:
    def __init__(self):
        self.detection_history = []

    def detect_file(self, file_path: Path) -> Dict[str, Any]:
        result = {
            "file_path": str(file_path),
            "file_name": file_path.name,
            "file_size": file_path.stat().st_size,
            "detected_at": datetime.now().isoformat(),
            "encoding": None,
            "confidence": 0.0,
            "language": None,
            "is_valid": False,
            "has_bom": False,
            "error": None
        }

        try:
            with open(file_path, "rb") as f:
                raw_data = f.read(100000)
                if len(raw_data) >= 3 and raw_data[:3] == b"\xef\xbb\xbf":
                    result["has_bom"] = True

            if not raw_data:
                result["error"] = "empty_file"
                return result

            detection = chardet.detect(raw_data)
            result["encoding"] = detection.get("encoding")
            result["confidence"] = detection.get("confidence", 0.0)
            result["language"] = detection.get("language")

            normalized_encoding = (result["encoding"] or "").lower()
            result["is_valid"] = (
                result["confidence"] >= MIN_CONFIDENCE and
                normalized_encoding in [e.lower() for e in SUPPORTED_ENCODINGS]
            )

            if not result["is_valid"]:
                self._save_anomaly_sample(file_path, result)

        except Exception as e:
            result["error"] = str(e)

        self.detection_history.append(result)
        return result

    def _save_anomaly_sample(self, file_path: Path, detection_result: Dict[str, Any]):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_hash = hashlib.md5(str(file_path).encode()).hexdigest()[:8]
        anomaly_id = f"{timestamp}_{file_hash}"

        anomaly_dir = ANOMALY_DIR / anomaly_id
        anomaly_dir.mkdir(parents=True, exist_ok=True)

        shutil.copy2(file_path, anomaly_dir / file_path.name)

        meta = {
            "anomaly_id": anomaly_id,
            "original_path": str(file_path),
            "detection_result": detection_result,
            "saved_at": datetime.now().isoformat()
        }

        import json
        with open(anomaly_dir / "meta.json", "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

    def batch_detect(self, directory: Path, pattern: str = "*.txt") -> list:
        results = []
        for file_path in directory.rglob(pattern):
            if file_path.is_file():
                results.append(self.detect_file(file_path))
        return results

    def verify_encoding(self, file_path: Path, expected_encoding: str) -> Dict[str, Any]:
        result = {
            "file_path": str(file_path),
            "expected_encoding": expected_encoding,
            "actual_encoding": None,
            "is_match": False,
            "can_decode": False,
            "error": None
        }

        try:
            with open(file_path, "rb") as f:
                raw_data = f.read()

            detection = chardet.detect(raw_data)
            result["actual_encoding"] = detection.get("encoding")

            result["is_match"] = (
                result["actual_encoding"] and
                result["actual_encoding"].lower() == expected_encoding.lower()
            )

            try:
                raw_data.decode(expected_encoding)
                result["can_decode"] = True
            except UnicodeDecodeError:
                result["can_decode"] = False

        except Exception as e:
            result["error"] = str(e)

        return result
