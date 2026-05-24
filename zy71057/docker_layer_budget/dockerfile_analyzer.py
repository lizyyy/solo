import os
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from .layer_parser import ImageLayer, ImageMetadata
from .utils import format_size


@dataclass
class DockerfileInstruction:
    line_number: int
    command: str
    arguments: str = ""
    raw: str = ""

    def to_dict(self) -> dict:
        return {
            "line_number": self.line_number,
            "command": self.command,
            "arguments": self.arguments,
            "raw": self.raw,
        }


@dataclass
class DockerfileAnalysis:
    instructions: List[DockerfileInstruction] = field(default_factory=list)
    base_image: str = ""
    layer_mapping: Dict[int, List[int]] = field(default_factory=dict)
    issues: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "instructions_count": len(self.instructions),
            "base_image": self.base_image,
            "instructions": [i.to_dict() for i in self.instructions],
            "layer_mapping": {str(k): v for k, v in self.layer_mapping.items()},
            "issues": self.issues,
        }


class DockerfileAnalyzer:
    def __init__(self):
        self.instruction_pattern = re.compile(
            r"^\s*(FROM|RUN|CMD|ENTRYPOINT|COPY|ADD|ENV|ARG|WORKDIR|EXPOSE|VOLUME|USER|SHELL|HEALTHCHECK|MAINTAINER|LABEL)\s+",
            re.IGNORECASE,
        )
        self.continuation_pattern = re.compile(r"\\\s*$")

    def analyze(self, dockerfile_path: str) -> DockerfileAnalysis:
        if not os.path.exists(dockerfile_path):
            raise FileNotFoundError(f"Dockerfile 不存在: {dockerfile_path}")

        analysis = DockerfileAnalysis()
        raw_instructions = self._parse_raw_instructions(dockerfile_path)

        for line_num, raw_content in raw_instructions:
            instruction = self._parse_instruction(line_num, raw_content)
            if instruction:
                analysis.instructions.append(instruction)

                if instruction.command.upper() == "FROM":
                    analysis.base_image = self._extract_base_image(instruction.arguments)

        self._detect_issues(analysis)
        return analysis

    def _parse_raw_instructions(self, filepath: str) -> List[Tuple[int, str]]:
        instructions = []
        current_line = ""
        current_line_num = 0

        with open(filepath, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                stripped = line.rstrip("\n")

                if not current_line and (stripped.startswith("#") or stripped.strip() == ""):
                    continue

                if self.continuation_pattern.search(stripped):
                    if not current_line:
                        current_line_num = line_num
                    current_line += stripped[:-1].rstrip() + " "
                else:
                    if current_line:
                        current_line += stripped
                        instructions.append((current_line_num, current_line))
                        current_line = ""
                    else:
                        instructions.append((line_num, stripped))

        if current_line:
            instructions.append((current_line_num, current_line))

        return instructions

    def _parse_instruction(self, line_num: int, raw: str) -> Optional[DockerfileInstruction]:
        match = self.instruction_pattern.match(raw)
        if not match:
            return None

        command = match.group(1).upper()
        arguments = raw[match.end() :].strip()

        return DockerfileInstruction(
            line_number=line_num,
            command=command,
            arguments=arguments,
            raw=raw.strip(),
        )

    def _extract_base_image(self, arguments: str) -> str:
        parts = arguments.split()
        if parts:
            image_part = parts[0]
            if " AS " in image_part.upper():
                image_part = image_part.split()[0]
            return image_part
        return ""

    def _detect_issues(self, analysis: DockerfileAnalysis):
        run_instructions = [i for i in analysis.instructions if i.command == "RUN"]

        for idx, instruction in enumerate(run_instructions):
            args_lower = instruction.arguments.lower()

            if "apt-get install" in args_lower and "apt-get clean" not in args_lower:
                analysis.issues.append(
                    {
                        "type": "missing_cleanup",
                        "severity": "warning",
                        "line_number": instruction.line_number,
                        "message": "apt-get install 后缺少 apt-get clean 和缓存清理",
                        "suggestion": "在 apt-get install 后添加: && apt-get clean && rm -rf /var/lib/apt/lists/*",
                    }
                )

            if "pip install" in args_lower and "--no-cache-dir" not in args_lower:
                analysis.issues.append(
                    {
                        "type": "pip_cache",
                        "severity": "warning",
                        "line_number": instruction.line_number,
                        "message": "pip install 未使用 --no-cache-dir 参数",
                        "suggestion": "使用: pip install --no-cache-dir",
                    }
                )

            if "npm install" in args_lower and "npm cache clean" not in args_lower:
                analysis.issues.append(
                    {
                        "type": "npm_cache",
                        "severity": "warning",
                        "line_number": instruction.line_number,
                        "message": "npm install 后未清理 npm 缓存",
                        "suggestion": "在 npm install 后添加: && npm cache clean --force",
                    }
                )

        copy_before_run = False
        for instruction in analysis.instructions:
            if instruction.command in ["COPY", "ADD"]:
                copy_before_run = True
            elif instruction.command == "RUN":
                if "pip install" in instruction.arguments.lower() and not copy_before_run:
                    pass
                copy_before_run = False

    def map_layers_to_dockerfile(
        self, analysis: DockerfileAnalysis, metadata: ImageMetadata
    ) -> Dict[int, List[int]]:
        mapping: Dict[int, List[int]] = {}
        layer_creators = ["RUN", "COPY", "ADD"]

        creator_instructions = [
            (idx, i)
            for idx, i in enumerate(analysis.instructions)
            if i.command in layer_creators
        ]

        non_base_layers = [l for l in metadata.layers if not l.is_base_image]

        for layer_idx, layer in enumerate(non_base_layers):
            if layer_idx < len(creator_instructions):
                inst_idx, instruction = creator_instructions[layer_idx]
                mapping[layer.index] = [instruction.line_number]

        return mapping

    def suggest_optimizations(self, analysis: DockerfileAnalysis) -> List[Dict[str, Any]]:
        suggestions = []

        run_count = len([i for i in analysis.instructions if i.command == "RUN"])
        if run_count > 10:
            suggestions.append(
                {
                    "type": "too_many_layers",
                    "priority": "medium",
                    "message": f"发现 {run_count} 个 RUN 指令，考虑合并相关操作以减少层数",
                    "impact": "减少镜像层数，提高构建缓存效率",
                }
            )

        from_count = len([i for i in analysis.instructions if i.command == "FROM"])
        if from_count == 1:
            suggestions.append(
                {
                    "type": "single_stage",
                    "priority": "medium",
                    "message": "当前使用单阶段构建，考虑使用多阶段构建减少最终镜像大小",
                    "impact": "显著减少最终镜像大小，排除构建依赖",
                }
            )

        copy_count = len([i for i in analysis.instructions if i.command == "COPY"])
        add_count = len([i for i in analysis.instructions if i.command == "ADD"])
        if add_count > 0 and copy_count == 0:
            suggestions.append(
                {
                    "type": "use_copy_instead_of_add",
                    "priority": "low",
                    "message": "建议优先使用 COPY 而非 ADD（除非需要自动解压或远程 URL 功能）",
                    "impact": "更清晰的语义，避免意外的文件解压",
                }
            )

        return suggestions
