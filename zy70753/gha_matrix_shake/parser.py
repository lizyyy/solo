import re
import os
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from pathlib import Path


@dataclass
class LogLine:
    file_path: str
    line_number: int
    raw_content: str
    timestamp: Optional[str] = None
    workflow_step: Optional[str] = None


@dataclass
class MatrixConfig:
    parameters: Dict[str, str] = field(default_factory=dict)
    
    def key(self) -> str:
        sorted_items = sorted(self.parameters.items())
        return "|".join(f"{k}={v}" for k, v in sorted_items)
    
    def __hash__(self):
        return hash(self.key())
    
    def __eq__(self, other):
        if not isinstance(other, MatrixConfig):
            return False
        return self.key() == other.key()


@dataclass
class FailureInfo:
    error_message: str
    context_lines: List[str] = field(default_factory=list)
    step_name: Optional[str] = None
    exit_code: Optional[str] = None


@dataclass
class JobResult:
    job_name: str
    run_id: str
    attempt: int
    matrix: MatrixConfig
    status: str  # success, failure, cancelled
    log_lines: List[LogLine] = field(default_factory=list)
    failure: Optional[FailureInfo] = None
    duration_seconds: Optional[int] = None


class GitHubActionsLogParser:
    MATRIX_LINE_PATTERN = re.compile(r'matrix:\s*(.+)')
    MATRIX_PARAM_PATTERNS = [
        re.compile(r'##\[set-output\s+name=matrix\.(\w+)\]\s*(\S+)'),
        re.compile(r'::set-env::MATRIX_(\w+)=(\S+)'),
        re.compile(r'MATRIX_(\w+)=(\S+)'),
    ]
    
    JOB_NAME_PATTERNS = [
        re.compile(r'^##\[group\](.+)'),
        re.compile(r'Job name:\s*(.+)'),
        re.compile(r'Running job:\s*(.+)'),
    ]
    
    STATUS_PATTERNS = [
        re.compile(r'Job completed with result:?\s*(\w+)', re.IGNORECASE),
        re.compile(r'##\[error\]'),
        re.compile(r'Process completed with (exit code \d+|error)'),
    ]
    
    TIMESTAMP_PATTERN = re.compile(r'^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d+Z)\s+(.+)')
    
    def __init__(self):
        self.results: List[JobResult] = []
    
    def parse_file(self, file_path: str) -> List[JobResult]:
        path = Path(file_path)
        if path.is_dir():
            return self.parse_directory(file_path)
        return [self._parse_single_file(file_path)]
    
    def parse_directory(self, dir_path: str) -> List[JobResult]:
        results = []
        path = Path(dir_path)
        for log_file in sorted(path.glob("**/*.log")):
            try:
                result = self._parse_single_file(str(log_file))
                results.append(result)
            except Exception as e:
                print(f"Warning: Failed to parse {log_file}: {e}")
        return results
    
    def _parse_single_file(self, file_path: str) -> JobResult:
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            lines = f.readlines()
        
        log_lines = []
        matrix_params = {}
        job_name = Path(file_path).stem
        run_id = self._extract_run_id(file_path)
        attempt = self._extract_attempt(file_path)
        status = "success"
        failure_info = None
        
        error_lines = []
        current_step = None
        in_error_context = False
        
        for idx, raw_line in enumerate(lines, 1):
            raw_line = raw_line.rstrip('\n')
            log_line = self._parse_log_line(file_path, idx, raw_line)
            log_lines.append(log_line)
            
            if log_line.workflow_step:
                current_step = log_line.workflow_step
            
            match = self.MATRIX_LINE_PATTERN.search(raw_line)
            if match:
                param_str = match.group(1)
                for param in param_str.split(','):
                    param = param.strip()
                    if '=' in param:
                        key, value = param.split('=', 1)
                        matrix_params[key.strip()] = value.strip()
            
            for pattern in self.MATRIX_PARAM_PATTERNS:
                match = pattern.search(raw_line)
                if match:
                    matrix_params[match.group(1)] = match.group(2)
            
            explicit_status = self._check_explicit_status(raw_line)
            if explicit_status:
                status = explicit_status
            
            if self._is_error_line(raw_line):
                in_error_context = True
                error_lines.append((idx, raw_line))
                if explicit_status is None:
                    status = "failure"
            elif in_error_context and len(error_lines) < 20:
                error_lines.append((idx, raw_line))
            else:
                in_error_context = False
        
        if error_lines:
            failure_info = FailureInfo(
                error_message=error_lines[0][1],
                context_lines=[f"L{line_num}: {line}" for line_num, line in error_lines],
                step_name=current_step
            )
        
        return JobResult(
            job_name=job_name,
            run_id=run_id,
            attempt=attempt,
            matrix=MatrixConfig(parameters=matrix_params),
            status=status,
            log_lines=log_lines,
            failure=failure_info
        )
    
    def _parse_log_line(self, file_path: str, line_number: int, raw_content: str) -> LogLine:
        timestamp = None
        workflow_step = None
        
        match = self.TIMESTAMP_PATTERN.match(raw_content)
        if match:
            timestamp = match.group(1)
            raw_content = match.group(2)
        
        for pattern in self.JOB_NAME_PATTERNS:
            match = pattern.match(raw_content)
            if match:
                workflow_step = match.group(1).strip()
        
        return LogLine(
            file_path=file_path,
            line_number=line_number,
            raw_content=raw_content,
            timestamp=timestamp,
            workflow_step=workflow_step
        )
    
    def _check_explicit_status(self, line: str) -> Optional[str]:
        for pattern in self.STATUS_PATTERNS:
            match = pattern.search(line)
            if match:
                if match.groups():
                    status = match.group(1).lower()
                    if status in ['success', 'failure', 'cancelled', 'canceled']:
                        return status if status != 'canceled' else 'cancelled'
                else:
                    return 'failure'
        return None
    
    def _is_error_line(self, line: str) -> bool:
        error_indicators = [
            '##[error]',
            'Error:',
            'error:',
            'FAILED',
            'failed',
            'AssertionError',
            'Exception:',
            'exit code 1',
            'Process completed with exit code 1',
        ]
        return any(indicator in line for indicator in error_indicators)
    
    def _extract_run_id(self, file_path: str) -> str:
        path = Path(file_path)
        name = path.name
        match = re.search(r'run[_-]?(\d+)', name, re.IGNORECASE)
        if match:
            return match.group(1)
        return path.parent.name or "unknown"
    
    def _extract_attempt(self, file_path: str) -> int:
        name = Path(file_path).name
        match = re.search(r'(?:attempt|retry)[_-]?(\d+)', name, re.IGNORECASE)
        if match:
            return int(match.group(1))
        return 1
