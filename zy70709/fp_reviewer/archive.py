import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .models import SuppressionRule, EvidenceSample, ProcessedData


class ArchiveManager:
    def __init__(self, archive_dir: str = "./archive"):
        self.archive_dir = Path(archive_dir)
        self.archive_dir.mkdir(parents=True, exist_ok=True)
        self.sample_index: Dict[str, str] = {}

    def archive_samples(
        self, processed_data: ProcessedData, batch_id: Optional[str] = None
    ) -> str:
        if batch_id is None:
            batch_id = datetime.now().strftime("%Y%m%d_%H%M%S")

        batch_dir = self.archive_dir / batch_id
        batch_dir.mkdir(parents=True, exist_ok=True)

        for rule in processed_data.valid_rules:
            if rule.samples:
                for sample in rule.samples:
                    sample_hash = self._hash_sample(sample)
                    sample_file = batch_dir / f"sample_{sample_hash}.json"
                    if not sample_file.exists():
                        with open(sample_file, "w", encoding="utf-8") as f:
                            json.dump(
                                sample.dict(),
                                f,
                                ensure_ascii=False,
                                indent=2,
                                default=str,
                            )
                    self.sample_index[sample.sample_id] = str(sample_file)

        index_file = batch_dir / "sample_index.json"
        with open(index_file, "w", encoding="utf-8") as f:
            json.dump(self.sample_index, f, ensure_ascii=False, indent=2)

        return batch_id

    def _hash_sample(self, sample: EvidenceSample) -> str:
        content = f"{sample.scan_rule_id}:{sample.file_path}:{sample.evidence_content}"
        return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]

    def save_source_trail(
        self, processed_data: ProcessedData, batch_id: str
    ) -> None:
        batch_dir = self.archive_dir / batch_id
        source_trail_file = batch_dir / "source_trail.json"

        trail_data = []
        for rule in processed_data.valid_rules:
            if rule.source:
                trail_data.append(
                    {
                        "rule_id": rule.rule_id,
                        "source_file": rule.source.file_path,
                        "line_number": rule.source.line_number,
                    }
                )

        for bad_row in processed_data.bad_rows:
            trail_data.append(
                {
                    "error": bad_row.error_message,
                    "source_file": bad_row.file_path,
                    "line_number": bad_row.row_number,
                }
            )

        with open(source_trail_file, "w", encoding="utf-8") as f:
            json.dump(trail_data, f, ensure_ascii=False, indent=2)

    def get_archived_sample(self, sample_id: str) -> Optional[dict]:
        if sample_id not in self.sample_index:
            return None

        sample_file = Path(self.sample_index[sample_id])
        if sample_file.exists():
            with open(sample_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return None

    def list_archives(self) -> List[str]:
        return sorted([d.name for d in self.archive_dir.iterdir() if d.is_dir()])
