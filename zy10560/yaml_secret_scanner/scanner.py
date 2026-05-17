from pathlib import Path
from typing import List

from .config import ScannerConfig
from .detector import SecretDetector
from .models import FileResult, Finding, ScanResult
from .parser import YAMLParser


class YAMLSecretScanner:
    def __init__(self, config: ScannerConfig):
        self.config = config
        self.parser = YAMLParser()
        self.detector = SecretDetector(config.custom_patterns)
        self.risk_weight = SecretDetector.RISK_WEIGHTS

    def scan(self, path: Path) -> List[FileResult]:
        results: List[FileResult] = []

        if path.is_file():
            file_result = self._scan_file(path)
            results.append(file_result)
        else:
            yaml_files = list(path.rglob("*.yaml")) + list(path.rglob("*.yml"))
            for yaml_file in yaml_files:
                if not self._is_excluded(yaml_file):
                    file_result = self._scan_file(yaml_file)
                    results.append(file_result)

        return results

    def _is_excluded(self, file_path: Path) -> bool:
        for pattern in self.config.exclude_patterns:
            if pattern in str(file_path):
                return True
        return False

    def _scan_file(self, file_path: Path) -> FileResult:
        findings: List[Finding] = []
        data, errors = self.parser.parse(file_path)

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
        except Exception:
            lines = []

        for field_path, value, line, column in self.parser.iter_fields(data):
            if self.config.is_whitelisted(field_path):
                continue

            if isinstance(value, str) and self.config.is_value_whitelisted(value):
                continue

            detections = self.detector.detect(str(value))
            for pattern, matched_value in detections:
                if self._meets_risk_threshold(pattern.risk_level):
                    raw_line = lines[line - 1].strip() if 0 < line <= len(lines) else None
                    findings.append(Finding(
                        file_path=file_path,
                        field_path=field_path,
                        line=line,
                        column=column,
                        value=matched_value,
                        pattern_name=pattern.name,
                        risk_level=pattern.risk_level,
                        description=pattern.description,
                        raw_line=raw_line
                    ))

        return FileResult(
            file_path=file_path,
            findings=findings,
            errors=errors
        )

    def _meets_risk_threshold(self, risk_level: str) -> bool:
        min_weight = self.risk_weight.get(self.config.min_risk_level, 0)
        current_weight = self.risk_weight.get(risk_level, 0)
        return current_weight >= min_weight
