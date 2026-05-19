import csv
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

from .models import (
    SuppressionRule,
    EvidenceSample,
    BadRow,
    SuppressionSource,
    ProcessedData,
    ReviewStatus,
)


class InputParser:
    def __init__(self):
        self.seen_rule_ids = set()

    def parse_file(self, file_path: str) -> ProcessedData:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        suffix = path.suffix.lower()
        if suffix == ".csv":
            return self._parse_csv(file_path)
        elif suffix == ".json":
            return self._parse_json(file_path)
        else:
            raise ValueError(f"Unsupported file format: {suffix}")

    def _parse_csv(self, file_path: str) -> ProcessedData:
        valid_rules: List[SuppressionRule] = []
        bad_rows: List[BadRow] = []

        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    rule = self._row_to_rule(row, file_path, row_num)
                    if rule.rule_id in self.seen_rule_ids:
                        bad_rows.append(
                            BadRow(
                                file_path=file_path,
                                row_number=row_num,
                                raw_content=json.dumps(row, ensure_ascii=False),
                                error_message=f"Duplicate rule_id: {rule.rule_id}",
                            )
                        )
                    else:
                        self.seen_rule_ids.add(rule.rule_id)
                        valid_rules.append(rule)
                except Exception as e:
                    bad_rows.append(
                        BadRow(
                            file_path=file_path,
                            row_number=row_num,
                            raw_content=json.dumps(row, ensure_ascii=False),
                            error_message=str(e),
                        )
                    )

        return ProcessedData(valid_rules=valid_rules, bad_rows=bad_rows)

    def _parse_json(self, file_path: str) -> ProcessedData:
        valid_rules: List[SuppressionRule] = []
        bad_rows: List[BadRow] = []

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if not isinstance(data, list):
            raise ValueError("JSON root must be a list of rules")

        for idx, item in enumerate(data):
            try:
                rule = self._dict_to_rule(item, file_path, idx + 1)
                if rule.rule_id in self.seen_rule_ids:
                    bad_rows.append(
                        BadRow(
                            file_path=file_path,
                            row_number=idx + 1,
                            raw_content=json.dumps(item, ensure_ascii=False),
                            error_message=f"Duplicate rule_id: {rule.rule_id}",
                        )
                    )
                else:
                    self.seen_rule_ids.add(rule.rule_id)
                    valid_rules.append(rule)
            except Exception as e:
                bad_rows.append(
                    BadRow(
                        file_path=file_path,
                        row_number=idx + 1,
                        raw_content=json.dumps(item, ensure_ascii=False),
                        error_message=str(e),
                    )
                )

        return ProcessedData(valid_rules=valid_rules, bad_rows=bad_rows)

    def _row_to_rule(
        self, row: Dict[str, str], file_path: str, row_num: int
    ) -> SuppressionRule:
        source = SuppressionSource(
            file_path=file_path,
            line_number=row_num,
            raw_content=json.dumps(row, ensure_ascii=False),
        )

        samples = self._parse_samples_from_row(row)

        def get_date(key: str) -> Optional[datetime]:
            val = row.get(key, "").strip()
            if not val:
                return None
            for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y/%m/%d"]:
                try:
                    return datetime.strptime(val, fmt)
                except ValueError:
                    continue
            raise ValueError(f"Invalid date format for {key}: {val}")

        status = ReviewStatus(row.get("review_status", "pending"))

        return SuppressionRule(
            rule_id=row["rule_id"].strip(),
            scan_rule_id=row["scan_rule_id"].strip(),
            reason=row.get("reason", "").strip(),
            created_at=get_date("created_at") or datetime.now(),
            expires_at=get_date("expires_at") or datetime.now(),
            created_by=row.get("created_by", "").strip(),
            reviewer=row.get("reviewer", "").strip() or None,
            review_status=status,
            reviewed_at=get_date("reviewed_at"),
            review_comment=row.get("review_comment", "").strip() or None,
            samples=samples,
            source=source,
        )

    def _dict_to_rule(
        self, item: Dict[str, Any], file_path: str, row_num: int
    ) -> SuppressionRule:
        source = SuppressionSource(
            file_path=file_path,
            line_number=row_num,
            raw_content=json.dumps(item, ensure_ascii=False),
        )

        samples_data = item.get("samples", [])
        samples = [EvidenceSample(**s) for s in samples_data]

        return SuppressionRule(
            rule_id=item["rule_id"],
            scan_rule_id=item["scan_rule_id"],
            reason=item.get("reason", ""),
            created_at=datetime.fromisoformat(item["created_at"])
            if isinstance(item.get("created_at"), str)
            else item.get("created_at", datetime.now()),
            expires_at=datetime.fromisoformat(item["expires_at"])
            if isinstance(item.get("expires_at"), str)
            else item.get("expires_at", datetime.now()),
            created_by=item.get("created_by", ""),
            reviewer=item.get("reviewer"),
            review_status=ReviewStatus(item.get("review_status", "pending")),
            reviewed_at=datetime.fromisoformat(item["reviewed_at"])
            if item.get("reviewed_at")
            else None,
            review_comment=item.get("review_comment"),
            samples=samples,
            source=source,
            metadata=item.get("metadata", {}),
        )

    def _parse_samples_from_row(self, row: Dict[str, str]) -> List[EvidenceSample]:
        samples = []
        sample_id = row.get("sample_id", "").strip()
        if sample_id:
            samples.append(
                EvidenceSample(
                    sample_id=sample_id,
                    scan_rule_id=row.get("scan_rule_id", "").strip(),
                    file_path=row.get("sample_file_path", "").strip(),
                    line_number=int(row.get("sample_line", 0) or 0)
                    if row.get("sample_line")
                    else None,
                    evidence_content=row.get("evidence_content", "").strip(),
                    scan_tool=row.get("scan_tool", "").strip() or None,
                    severity=row.get("severity", "").strip() or None,
                )
            )
        return samples
