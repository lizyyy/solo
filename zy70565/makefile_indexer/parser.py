import re
import os
from typing import Dict, List, Set, Optional
from .models import MakefileTarget, BadLine, ParseResult

SIDE_EFFECT_PATTERNS = [
    (r'rm\s+-', '删除文件/目录'),
    (r'mv\s+', '移动/重命名文件'),
    (r'cp\s+.*', '复制文件'),
    (r'mkdir\s+', '创建目录'),
    (r'touch\s+', '创建/修改文件'),
    (r'chmod\s+', '修改权限'),
    (r'chown\s+', '修改所有者'),
    (r'wget\s+', '下载文件'),
    (r'curl\s+', '网络请求'),
    (r'apt\s+', '系统包管理'),
    (r'brew\s+', '系统包管理'),
    (r'pip\s+install', '安装 Python 包'),
    (r'npm\s+install', '安装 npm 包'),
    (r'sudo\s+', '使用 sudo 权限'),
    (r'echo\s+.*>\s+', '覆盖写入文件'),
    (r'>\s+', '重定向覆盖文件'),
    (r'\|\s*bash', '管道执行 bash'),
    (r'eval\s+', '执行 eval'),
    (r'docker\s+build', 'Docker 构建镜像'),
    (r'docker\s+push', 'Docker 推送镜像'),
    (r'docker\s+run', 'Docker 运行容器'),
    (r'kubectl\s+', 'Kubernetes 操作'),
    (r'helm\s+', 'Helm 操作'),
    (r'ansible\s+', 'Ansible 自动化'),
]


class MakefileParser:
    def __init__(self):
        self.result = ParseResult()
        self.current_target = None
        self.pending_comments = []
        self.variable_pattern = re.compile(r'^([A-Za-z_][A-Za-z0-9_]*)\s*[:?+]?=\s*(.*)$')
        self.target_pattern = re.compile(r'^([A-Za-z0-9_%/][A-Za-z0-9_%\-.]*)\s*:(?!=)\s*(.*)$')
        self.phony_pattern = re.compile(r'^\.PHONY\s*:\s*(.*)$')
        self.special_target_pattern = re.compile(r'^\.[A-Z_]+:')
        self.include_pattern = re.compile(r'^include\s+(.*)$')
        self.comment_pattern = re.compile(r'^\s*#\s*(.*)$')

    def parse(self, filepath):
        self.result = ParseResult()
        self.current_target = None
        self.pending_comments = []

        if not os.path.exists(filepath):
            self.result.bad_lines.append(BadLine(
                line_number=0,
                content=filepath,
                reason=f"文件不存在: {filepath}",
                error_type="FILE_NOT_FOUND"
            ))
            return self.result

        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                lines = f.readlines()
        except Exception as e:
            self.result.bad_lines.append(BadLine(
                line_number=0,
                content=filepath,
                reason=f"读取文件失败: {str(e)}",
                error_type="FILE_READ_ERROR"
            ))
            return self.result

        for line_num, line in enumerate(lines, 1):
            try:
                self._parse_line(line.rstrip('\n'), line_num)
            except Exception as e:
                self.result.bad_lines.append(BadLine(
                    line_number=line_num,
                    content=line.strip(),
                    reason=f"解析异常: {str(e)}",
                    error_type="PARSE_EXCEPTION"
                ))

        self._finish_current_target()
        self._expand_all_dependencies()
        self._detect_side_effects()

        return self.result

    def _parse_line(self, line, line_num):
        stripped = line.strip()

        if not stripped:
            return

        if stripped.startswith('#'):
            match = self.comment_pattern.match(stripped)
            if match:
                self.pending_comments.append(match.group(1).strip())
            return

        if stripped.endswith('\\'):
            self.result.bad_lines.append(BadLine(
                line_number=line_num,
                content=stripped,
                reason="行续接暂不支持，保留原始行",
                error_type="LINE_CONTINUATION"
            ))
            return

        phony_match = self.phony_pattern.match(stripped)
        if phony_match:
            phony_targets = phony_match.group(1).split()
            for t in phony_targets:
                self.result.phony_targets.add(t)
            return

        if self.special_target_pattern.match(stripped):
            return

        include_match = self.include_pattern.match(stripped)
        if include_match:
            self.result.includes.append(include_match.group(1).strip())
            return

        var_match = self.variable_pattern.match(stripped)
        if var_match:
            var_name = var_match.group(1)
            var_value = var_match.group(2).strip()
            self.result.variables[var_name] = var_value
            return

        target_match = self.target_pattern.match(stripped)
        if target_match:
            self._finish_current_target()

            target_name = target_match.group(1)
            deps_str = target_match.group(2).strip()
            deps = deps_str.split() if deps_str else []

            self.current_target = MakefileTarget(
                name=target_name,
                dependencies=deps,
                comments=self.pending_comments.copy(),
                line_number=line_num
            )
            self.pending_comments = []
            return

        if line.startswith('\t') or (line.startswith(' ') and self.current_target):
            if self.current_target:
                self.current_target.recipe.append(line.strip())
            return

        self.result.bad_lines.append(BadLine(
            line_number=line_num,
            content=stripped,
            reason="无法识别的行格式",
            error_type="UNKNOWN_FORMAT"
        ))

    def _finish_current_target(self):
        if self.current_target:
            self.result.targets[self.current_target.name] = self.current_target
            self.current_target = None

    def _expand_all_dependencies(self):
        for target in self.result.targets.values():
            target.expanded_deps = self._expand_deps(target.name, set())

    def _expand_deps(self, target_name, visited):
        if target_name in visited:
            return []
        visited.add(target_name)

        if target_name not in self.result.targets:
            return [target_name]

        target = self.result.targets[target_name]
        result = list(target.dependencies)

        for dep in target.dependencies:
            sub_deps = self._expand_deps(dep, visited)
            for sub_dep in sub_deps:
                if sub_dep not in result:
                    result.append(sub_dep)

        return result

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
