import json
import yaml
from datetime import datetime
from typing import List, Any, Optional, Tuple
from pathlib import Path

from .models import Silence, Alert, LabelMatcher, ParseResult


class BaseParser:
    def __init__(self):
        self.invalid_items = []

    def _parse_datetime(self, dt_str: str) -> Optional[datetime]:
        formats = [
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S%z",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(dt_str, fmt)
            except (ValueError, TypeError):
                continue
        return None

    def _record_invalid(self, raw_content: str, source_file: str,
                        source_line: int, error: str, item_type: str):
        item = {
            "type": item_type,
            "raw_content": raw_content,
            "source_file": source_file,
            "source_line": source_line,
            "parse_error": error,
        }
        self.invalid_items.append(item)


class SilenceParser(BaseParser):
    def __init__(self):
        super().__init__()

    def parse_file(self, file_path: str) -> ParseResult:
        path = Path(file_path)
        valid_silences = []
        self.invalid_items = []

        if path.suffix in [".yaml", ".yml"]:
            result = self._parse_yaml_file(path)
        elif path.suffix == ".json":
            result = self._parse_json_file(path)
        else:
            raise ValueError(f"Unsupported file format: {path.suffix}")

        return ParseResult(
            valid_items=valid_silences + result["valid"],
            invalid_items=self.invalid_items + result["invalid"],
            total_count=result["total"],
            valid_count=len(valid_silences) + len(result["valid"]),
            invalid_count=len(self.invalid_items) + len(result["invalid"]),
        )

    def _parse_yaml_file(self, path: Path) -> dict:
        valid = []
        invalid = []
        total = 0

        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        raw_content = "".join(lines)
        try:
            data = yaml.safe_load(raw_content)
        except yaml.YAMLError as e:
            self._record_invalid(
                raw_content, str(path), 1, f"YAML parse error: {str(e)}", "silence"
            )
            return {"valid": [], "invalid": self.invalid_items, "total": 0}

        if isinstance(data, list):
            for idx, item in enumerate(data):
                total += 1
                silence = self._parse_silence_item(
                    item, str(path), idx + 1, lines[idx] if idx < len(lines) else ""
                )
                if silence and not silence.parse_error:
                    valid.append(silence)
                elif silence:
                    invalid.append(silence)
        elif isinstance(data, dict):
            total += 1
            silence = self._parse_silence_item(data, str(path), 1, raw_content)
            if silence and not silence.parse_error:
                valid.append(silence)
            elif silence:
                invalid.append(silence)

        return {"valid": valid, "invalid": invalid, "total": total}

    def _parse_json_file(self, path: Path) -> dict:
        valid = []
        invalid = []
        total = 0

        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        raw_content = "".join(lines)
        try:
            data = json.loads(raw_content)
        except json.JSONDecodeError as e:
            self._record_invalid(
                raw_content, str(path), e.lineno, f"JSON parse error: {str(e)}", "silence"
            )
            return {"valid": [], "invalid": self.invalid_items, "total": 0}

        if isinstance(data, list):
            for idx, item in enumerate(data):
                total += 1
                silence = self._parse_silence_item(
                    item, str(path), idx + 1, lines[idx] if idx < len(lines) else ""
                )
                if silence and not silence.parse_error:
                    valid.append(silence)
                elif silence:
                    invalid.append(silence)
        elif isinstance(data, dict):
            total += 1
            silence = self._parse_silence_item(data, str(path), 1, raw_content)
            if silence and not silence.parse_error:
                valid.append(silence)
            elif silence:
                invalid.append(silence)

        return {"valid": valid, "invalid": invalid, "total": total}

    def _parse_silence_item(self, item: dict, source_file: str,
                            source_line: int, raw_line: str) -> Optional[Silence]:
        try:
            matchers = []
            for m in item.get("matchers", []):
                matchers.append(LabelMatcher(
                    name=m.get("name", ""),
                    value=m.get("value", ""),
                    is_regex=m.get("isRegex", False),
                ))

            starts_at = self._parse_datetime(item.get("startsAt", ""))
            ends_at = self._parse_datetime(item.get("endsAt", ""))

            silence = Silence(
                id=item.get("id", ""),
                matchers=matchers,
                starts_at=starts_at,
                ends_at=ends_at,
                created_by=item.get("createdBy", ""),
                comment=item.get("comment", ""),
                status=item.get("status", {}).get("state", "active") if isinstance(item.get("status"), dict) else item.get("status", "active"),
                source_file=source_file,
                source_line=source_line,
                raw_content=raw_line.strip(),
                parse_error=None,
            )
            return silence
        except Exception as e:
            self._record_invalid(
                raw_line, source_file, source_line, f"Item parse error: {str(e)}", "silence"
            )
            return Silence(
                id="",
                matchers=[],
                starts_at=None,
                ends_at=None,
                created_by="",
                comment="",
                source_file=source_file,
                source_line=source_line,
                raw_content=raw_line.strip(),
                parse_error=str(e),
            )


class AlertParser(BaseParser):
    def __init__(self):
        super().__init__()

    def parse_file(self, file_path: str) -> ParseResult:
        path = Path(file_path)
        valid_alerts = []
        self.invalid_items = []

        if path.suffix in [".yaml", ".yml"]:
            result = self._parse_yaml_file(path)
        elif path.suffix == ".json":
            result = self._parse_json_file(path)
        else:
            raise ValueError(f"Unsupported file format: {path.suffix}")

        return ParseResult(
            valid_items=valid_alerts + result["valid"],
            invalid_items=self.invalid_items + result["invalid"],
            total_count=result["total"],
            valid_count=len(valid_alerts) + len(result["valid"]),
            invalid_count=len(self.invalid_items) + len(result["invalid"]),
        )

    def _parse_yaml_file(self, path: Path) -> dict:
        valid = []
        invalid = []
        total = 0

        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        raw_content = "".join(lines)
        try:
            data = yaml.safe_load(raw_content)
        except yaml.YAMLError as e:
            self._record_invalid(
                raw_content, str(path), 1, f"YAML parse error: {str(e)}", "alert"
            )
            return {"valid": [], "invalid": self.invalid_items, "total": 0}

        alerts_data = data.get("alerts", []) if isinstance(data, dict) else data
        if isinstance(alerts_data, list):
            for idx, item in enumerate(alerts_data):
                total += 1
                alert = self._parse_alert_item(
                    item, str(path), idx + 1, lines[idx] if idx < len(lines) else ""
                )
                if alert and not alert.parse_error:
                    valid.append(alert)
                elif alert:
                    invalid.append(alert)
        elif isinstance(alerts_data, dict):
            total += 1
            alert = self._parse_alert_item(alerts_data, str(path), 1, raw_content)
            if alert and not alert.parse_error:
                valid.append(alert)
            elif alert:
                invalid.append(alert)

        return {"valid": valid, "invalid": invalid, "total": total}

    def _parse_json_file(self, path: Path) -> dict:
        valid = []
        invalid = []
        total = 0

        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        raw_content = "".join(lines)
        try:
            data = json.loads(raw_content)
        except json.JSONDecodeError as e:
            self._record_invalid(
                raw_content, str(path), e.lineno, f"JSON parse error: {str(e)}", "alert"
            )
            return {"valid": [], "invalid": self.invalid_items, "total": 0}

        alerts_data = data.get("alerts", []) if isinstance(data, dict) else data
        if isinstance(alerts_data, list):
            for idx, item in enumerate(alerts_data):
                total += 1
                alert = self._parse_alert_item(
                    item, str(path), idx + 1, lines[idx] if idx < len(lines) else ""
                )
                if alert and not alert.parse_error:
                    valid.append(alert)
                elif alert:
                    invalid.append(alert)
        elif isinstance(alerts_data, dict):
            total += 1
            alert = self._parse_alert_item(alerts_data, str(path), 1, raw_content)
            if alert and not alert.parse_error:
                valid.append(alert)
            elif alert:
                invalid.append(alert)

        return {"valid": valid, "invalid": invalid, "total": total}

    def _parse_alert_item(self, item: dict, source_file: str,
                          source_line: int, raw_line: str) -> Optional[Alert]:
        try:
            labels = item.get("labels", {})
            annotations = item.get("annotations", {})
            starts_at = self._parse_datetime(item.get("startsAt", ""))

            alert = Alert(
                labels=labels if isinstance(labels, dict) else {},
                annotations=annotations if isinstance(annotations, dict) else {},
                starts_at=starts_at,
                source_file=source_file,
                source_line=source_line,
                raw_content=raw_line.strip(),
                parse_error=None,
            )
            return alert
        except Exception as e:
            self._record_invalid(
                raw_line, source_file, source_line, f"Item parse error: {str(e)}", "alert"
            )
            return Alert(
                labels={},
                annotations={},
                starts_at=None,
                source_file=source_file,
                source_line=source_line,
                raw_content=raw_line.strip(),
                parse_error=str(e),
            )
