import re
import os
from typing import Dict, List, Set, Optional
from .models import MakefileTarget, BadLine, ParseResult

SIDE_EFFECT_PATTERNS = [
    (r'rm\s+-', '删除文件/目录'),
]

class MakefileParser:
    def __init__(self):
        self.result = ParseResult()
        self.current_target = None
        self.pending_comments = []
        self.target_pattern = re.compile(r'^([A-Za-z0-9_%.\-/]+)\s*:(?!=)\s*(.*)$')

    def parse(self, filepath):
        self.result = ParseResult()
        self.current_target = None
        self.pending_comments = []
        with open(filepath, 'r') as f:
            lines = f.readlines()
        for line_num, line in enumerate(lines, 1):
            self._parse_line(line.rstrip('\n'), line_num)
        self._finish_current_target()
        return self.result

    def _parse_line(self, line, line_num):
        stripped = line.strip()
        if not stripped:
            return
        if stripped.startswith('#'):
            self.pending_comments.append(stripped[1:].strip())
            return
        target_match = self.target_pattern.match(stripped)
        if target_match:
            self._finish_current_target()
            target_name = target_match.group(1)
            deps = target_match.group(2).strip().split()
            self.current_target = MakefileTarget(
                name=target_name, dependencies=deps,
                comments=self.pending_comments.copy(), line_number=line_num
            )
            self.pending_comments = []
            return
        if (line.startswith('\t') or line.startswith(' ')) and self.current_target:
            self.current_target.recipe.append(line.strip())
            return
        self.result.bad_lines.append(BadLine(line_num, stripped, 'unknown', 'UNKNOWN'))

    def _finish_current_target(self):
        if self.current_target:
            self.result.targets[self.current_target.name] = self.current_target
            self.current_target = None

    def _expand_all_dependencies(self):
        for target in self.result.targets.values():
            target.expanded_deps = []

    def _detect_side_effects(self):
        for target in self.result.targets.values():
            for recipe_line in target.recipe:
                for pattern, reason in SIDE_EFFECT_PATTERNS:
                    if re.search(pattern, recipe_line):
                        target.has_side_effect = True
                        target.side_effect_reason = reason
                        break
                if target.has_side_effect:
                    break
