import re
import os
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Optional, Tuple
import pathspec

from .constants import DEFAULT_CODEOWNERS_PATHS


@dataclass
class CodeOwnerRule:
    pattern: str
    owners: List[str] = field(default_factory=list)
    line_number: int = 0
    is_negative: bool = False
    raw_line: str = ""

    def __post_init__(self):
        if self.pattern.startswith("!"):
            self.is_negative = True
            self.pattern = self.pattern[1:]


class CodeOwnersParser:
    COMMENT_PATTERN = re.compile(r"#.*$")
    WHITESPACE_PATTERN = re.compile(r"\s+")

    def __init__(self, codeowners_path: Optional[str] = None, repo_root: str = "."):
        self.repo_root = Path(repo_root).resolve()
        self.codeowners_path = self._find_codeowners(codeowners_path)
        self.rules: List[CodeOwnerRule] = []

    def _find_codeowners(self, explicit_path: Optional[str]) -> Optional[Path]:
        if explicit_path:
            path = Path(explicit_path)
            if path.is_absolute():
                return path if path.exists() else None
            return self.repo_root / path if (self.repo_root / path).exists() else None

        for rel_path in DEFAULT_CODEOWNERS_PATHS:
            full_path = self.repo_root / rel_path
            if full_path.exists():
                return full_path

        return None

    def parse(self) -> List[CodeOwnerRule]:
        if not self.codeowners_path or not self.codeowners_path.exists():
            raise FileNotFoundError(
                f"CODEOWNERS file not found. Searched: {self.codeowners_path}"
            )

        self.rules = []
        with open(self.codeowners_path, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, start=1):
                rule = self._parse_line(line, line_num)
                if rule:
                    self.rules.append(rule)

        return self.rules

    def _parse_line(self, line: str, line_num: int) -> Optional[CodeOwnerRule]:
        original_line = line.rstrip("\n")
        line = self.COMMENT_PATTERN.sub("", line).strip()

        if not line:
            return None

        parts = self.WHITESPACE_PATTERN.split(line)

        if not parts:
            return None

        pattern = parts[0]
        owners = parts[1:] if len(parts) > 1 else []

        normalized_pattern = self._normalize_pattern(pattern)

        return CodeOwnerRule(
            pattern=normalized_pattern,
            owners=owners,
            line_number=line_num,
            raw_line=original_line,
        )

    def _normalize_pattern(self, pattern: str) -> str:
        is_negative = pattern.startswith("!")
        if is_negative:
            pattern = pattern[1:]

        if pattern.startswith("/"):
            pattern = pattern[1:]

        if pattern.endswith("/"):
            pattern = pattern + "**"

        if is_negative:
            pattern = "!" + pattern

        return pattern

    def match_file(self, file_path: str) -> Tuple[List[str], Optional[CodeOwnerRule]]:
        rel_path = Path(file_path).relative_to(self.repo_root) if Path(file_path).is_absolute() else Path(file_path)
        rel_path_str = str(rel_path).replace(os.sep, "/")

        matched_owners = []
        last_matched_rule = None

        for rule in self.rules:
            if self._match_pattern(rule.pattern, rel_path_str):
                if rule.is_negative:
                    matched_owners = []
                    last_matched_rule = None
                else:
                    matched_owners = rule.owners.copy()
                    last_matched_rule = rule

        return matched_owners, last_matched_rule

    def _match_pattern(self, pattern: str, path: str) -> bool:
        try:
            spec = pathspec.PathSpec.from_lines("gitwildmatch", [pattern])
            return spec.match_file(path)
        except Exception:
            return False

    def get_all_owners(self) -> List[str]:
        owners = set()
        for rule in self.rules:
            owners.update(rule.owners)
        return sorted(owners)
