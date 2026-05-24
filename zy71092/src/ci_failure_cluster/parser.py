import os
import re
import json
from datetime import datetime
from typing import List, Optional, TextIO, Dict, Any
from pathlib import Path

from .types import FailureRecord, MatrixParams


class LogParser:
    def __init__(self):
        self.commit_pattern = re.compile(
            r"(?:commit|sha|hash)[:\s]+([a-f0-9]{7,40})", re.IGNORECASE
        )
        self.job_name_pattern = re.compile(
            r"(?:job|build|run)[_\s]*name[:\s]+([^\n]+)", re.IGNORECASE
        )
        self.rerun_pattern = re.compile(
            r"(?:rerun|retry|attempt)[:\s]*(\d+)", re.IGNORECASE
        )
        self.matrix_pattern = re.compile(
            r"matrix[\s:{]+([^}]+)", re.IGNORECASE | re.DOTALL
        )
        self.error_start_patterns = [
            re.compile(r"^(Error|ERROR|error):", re.MULTILINE),
            re.compile(r"^(Traceback|TRACEBACK|traceback):", re.MULTILINE),
            re.compile(r"^(Exception|EXCEPTION|exception):", re.MULTILINE),
            re.compile(r"^(AssertionError|FAILED|FAIL):", re.MULTILINE),
            re.compile(r"^\s+File \".+\", line \d+, in", re.MULTILINE),
            re.compile(r"^.*(ModuleNotFoundError|ImportError):", re.MULTILINE),
            re.compile(r"^.*(TimeoutError|ConnectionError|NetworkError):", re.MULTILINE),
            re.compile(r"^.*(ValueError|TypeError|KeyError|IndexError|AttributeError):", re.MULTILINE),
            re.compile(r"^.*(SyntaxError|RuntimeError|NotImplementedError):", re.MULTILINE),
            re.compile(r"^.*(ReferenceError|TypeError|SyntaxError):\s", re.MULTILINE | re.IGNORECASE),
        ]
        self.timestamp_patterns = [
            re.compile(r"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)"),
            re.compile(r"(\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2})"),
            re.compile(r"\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]"),
        ]

    def parse_file(self, filepath: str) -> List[FailureRecord]:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"File not found: {filepath}")

        _, ext = os.path.splitext(filepath)
        if ext.lower() == ".json":
            return self._parse_json_file(filepath)
        elif ext.lower() in (".yaml", ".yml"):
            return self._parse_yaml_file(filepath)
        else:
            return self._parse_text_log(filepath)

    def parse_directory(self, dirpath: str, recursive: bool = True) -> List[FailureRecord]:
        records = []
        path = Path(dirpath)
        if not path.is_dir():
            raise NotADirectoryError(f"Not a directory: {dirpath}")

        pattern = "**/*" if recursive else "*"
        for file_path in path.glob(pattern):
            if file_path.is_file():
                try:
                    records.extend(self.parse_file(str(file_path)))
                except Exception:
                    continue
        return records

    def _parse_text_log(self, filepath: str) -> List[FailureRecord]:
        with open(filepath, "r", errors="replace") as f:
            content = f.read()

        return self._extract_failures_from_text(content, source=filepath)

    def _parse_json_file(self, filepath: str) -> List[FailureRecord]:
        with open(filepath, "r") as f:
            data = json.load(f)

        if isinstance(data, list):
            return [self._record_from_dict(item, source=filepath) for item in data]
        elif isinstance(data, dict):
            if "failures" in data and isinstance(data["failures"], list):
                return [self._record_from_dict(item, source=filepath) for item in data["failures"]]
            return [self._record_from_dict(data, source=filepath)]
        return []

    def _parse_yaml_file(self, filepath: str) -> List[FailureRecord]:
        try:
            import yaml
        except ImportError:
            return self._parse_text_log(filepath)

        with open(filepath, "r") as f:
            data = yaml.safe_load(f)

        if isinstance(data, list):
            return [self._record_from_dict(item, source=filepath) for item in data]
        elif isinstance(data, dict):
            if "failures" in data and isinstance(data["failures"], list):
                return [self._record_from_dict(item, source=filepath) for item in data["failures"]]
            return [self._record_from_dict(data, source=filepath)]
        return []

    def _extract_failures_from_text(self, content: str, source: str = "") -> List[FailureRecord]:
        records = []
        commit_sha = self._extract_commit(content) or "unknown"
        job_name = self._extract_job_name(content) or Path(source).stem
        matrix_params = self._extract_matrix_params(content)
        timestamp = self._extract_timestamp(content)
        rerun_count = self._extract_rerun_count(content)

        error_sections = self._extract_error_sections(content)

        for i, (error_msg, stack_trace) in enumerate(error_sections):
            record = FailureRecord(
                id=f"{Path(source).stem}_{i}",
                commit_sha=commit_sha,
                job_name=job_name,
                matrix_params=matrix_params,
                error_message=error_msg,
                stack_trace=stack_trace,
                full_log=content,
                timestamp=timestamp,
                rerun_count=rerun_count,
                raw_source=source,
            )
            if not record.id or record.id == f"{Path(source).stem}_":
                record.id = record.generate_id()
            records.append(record)

        if not records and content.strip():
            record = FailureRecord(
                id=Path(source).stem or "unknown",
                commit_sha=commit_sha,
                job_name=job_name,
                matrix_params=matrix_params,
                error_message=content[:500],
                stack_trace=None,
                full_log=content,
                timestamp=timestamp,
                rerun_count=rerun_count,
                raw_source=source,
            )
            record.id = record.generate_id()
            records.append(record)

        return records

    def _extract_error_sections(self, content: str) -> List[tuple]:
        sections = []
        lines = content.splitlines()
        i = 0
        n = len(lines)

        while i < n:
            line = lines[i]
            is_error_start = any(p.search(line) for p in self.error_start_patterns)

            if is_error_start:
                error_start = i
                error_msg = line.strip()
                j = i + 1
                stack_lines = []

                while j < n and j - error_start < 100:
                    next_line = lines[j]
                    if any(p.search(next_line) for p in self.error_start_patterns) and j > error_start + 5:
                        break
                    if re.match(r"^\s*$", next_line) and len(stack_lines) > 10:
                        pass
                    stack_lines.append(next_line)
                    j += 1

                stack_trace = "\n".join(stack_lines).strip() if stack_lines else None
                sections.append((error_msg, stack_trace))
                i = j
            else:
                i += 1

        return sections

    def _extract_commit(self, content: str) -> Optional[str]:
        match = self.commit_pattern.search(content)
        return match.group(1) if match else None

    def _extract_job_name(self, content: str) -> Optional[str]:
        match = self.job_name_pattern.search(content)
        return match.group(1).strip() if match else None

    def _extract_rerun_count(self, content: str) -> int:
        match = self.rerun_pattern.search(content)
        return int(match.group(1)) if match else 0

    def _extract_timestamp(self, content: str) -> Optional[datetime]:
        for pattern in self.timestamp_patterns:
            match = pattern.search(content)
            if match:
                ts_str = match.group(1)
                for fmt in [
                    "%Y-%m-%dT%H:%M:%S%z",
                    "%Y-%m-%dT%H:%M:%S",
                    "%Y/%m/%d %H:%M:%S",
                    "%Y-%m-%d %H:%M:%S",
                ]:
                    try:
                        return datetime.strptime(ts_str.replace("Z", "+0000"), fmt)
                    except ValueError:
                        continue
        return None

    def _extract_matrix_params(self, content: str) -> MatrixParams:
        params = MatrixParams()
        match = self.matrix_pattern.search(content)
        if match:
            matrix_content = match.group(1)
            os_match = re.search(r"(?:os|OS|operating)[_\s]*[:=]\s*([^\s,}]+)", matrix_content, re.IGNORECASE)
            if os_match:
                params.os = os_match.group(1)
            py_match = re.search(r"(?:python|py)[_\s]*[:=]\s*([^\s,}]+)", matrix_content, re.IGNORECASE)
            if py_match:
                params.python_version = py_match.group(1)
            node_match = re.search(r"(?:node|nodejs)[_\s]*[:=]\s*([^\s,}]+)", matrix_content, re.IGNORECASE)
            if node_match:
                params.node_version = node_match.group(1)
            browser_match = re.search(r"(?:browser)[_\s]*[:=]\s*([^\s,}]+)", matrix_content, re.IGNORECASE)
            if browser_match:
                params.browser = browser_match.group(1)
            arch_match = re.search(r"(?:arch|architecture)[_\s]*[:=]\s*([^\s,}]+)", matrix_content, re.IGNORECASE)
            if arch_match:
                params.arch = arch_match.group(1)
        return params

    def _record_from_dict(self, data: Dict[str, Any], source: str = "") -> FailureRecord:
        matrix_data = data.get("matrix", data.get("matrix_params", {}))
        if isinstance(matrix_data, dict):
            matrix_params = MatrixParams(
                os=matrix_data.get("os"),
                python_version=matrix_data.get("python_version") or matrix_data.get("python"),
                node_version=matrix_data.get("node_version") or matrix_data.get("node"),
                browser=matrix_data.get("browser"),
                arch=matrix_data.get("arch"),
                custom={k: v for k, v in matrix_data.items() if k not in ["os", "python_version", "python", "node_version", "node", "browser", "arch"]},
            )
        else:
            matrix_params = MatrixParams()

        record = FailureRecord(
            id=data.get("id", ""),
            commit_sha=data.get("commit_sha") or data.get("commit") or data.get("sha", "unknown"),
            job_name=data.get("job_name") or data.get("job") or "unknown",
            matrix_params=matrix_params,
            error_message=data.get("error_message") or data.get("error") or data.get("message", ""),
            stack_trace=data.get("stack_trace") or data.get("stack"),
            full_log=data.get("full_log") or data.get("log"),
            timestamp=None,
            rerun_count=data.get("rerun_count") or data.get("attempts", 0),
            rerun_success=data.get("rerun_success", False),
            raw_source=source,
        )
        if not record.id:
            record.id = record.generate_id()
        return record
