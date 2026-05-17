import os
from typing import List, Optional
from collections import defaultdict
from .models import DockerfileInstruction
from .models import LayerInfo
from .models import CacheStatus
from .models import FileChange
from .models import ChangeType
from .models import AnalysisResult
from .models import ParseError
from .parser import DockerfileParser
from .parser import BuildLogParser
from .parser import FileChangeParser


class CacheAnalyzer:
    def __init__(self):
        self.dockerfile_parser = DockerfileParser()
        self.log_parser = BuildLogParser()
        self.file_change_parser = FileChangeParser()

    def analyze(
        self,
        dockerfile_path: str,
        build_log_path: str,
        file_changes_path: Optional[str] = None
    ) -> AnalysisResult:
        errors: List[ParseError] = []

        dockerfile_content = self._read_file(dockerfile_path, errors, "Dockerfile")
        build_log_content = self._read_file(build_log_path, errors, "build.log")

        file_changes: List[FileChange] = []
        if file_changes_path and os.path.exists(file_changes_path):
            file_change_content = self._read_file(file_changes_path, errors, "file_changes")
            if file_change_content:
                file_changes = self.file_change_parser.parse_diff(file_change_content)

        dockerfile_instructions = self.dockerfile_parser.parse(dockerfile_content, os.path.basename(dockerfile_path))
        errors.extend(self.dockerfile_parser.errors)

        layers = self.log_parser.parse(build_log_content, os.path.basename(build_log_path))
        errors.extend(self.log_parser.errors)

        self._associate_layers_with_instructions(layers, dockerfile_instructions)

        self._analyze_cache_miss_causes(layers, dockerfile_instructions, file_changes)

        self._detect_chain_reactions(layers)

        recommendations = self._generate_recommendations(layers, dockerfile_instructions, file_changes)

        total_build_time = sum(layer.build_time_ms for layer in layers)
        cache_hit_count = sum(1 for layer in layers if layer.cache_status == CacheStatus.HIT)
        cache_miss_count = sum(1 for layer in layers if layer.cache_status == CacheStatus.MISS)

        return AnalysisResult(
            dockerfile_instructions=dockerfile_instructions,
            layers=layers,
            file_changes=file_changes,
            parse_errors=errors,
            total_build_time_ms=total_build_time,
            cache_hit_count=cache_hit_count,
            cache_miss_count=cache_miss_count,
            recommendations=recommendations
        )

    def _read_file(self, filepath: str, errors: List[ParseError], file_type: str) -> str:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            errors.append(ParseError(
                line_number=0,
                line_content="",
                error_type="file_not_found",
                message=f"{file_type} file not found: {filepath}",
                source_file=filepath
            ))
            return ""
        except Exception as e:
            errors.append(ParseError(
                line_number=0,
                line_content="",
                error_type="read_error",
                message=f"Failed to read {file_type}: {str(e)}",
                source_file=filepath
            ))
            return ""

    def _associate_layers_with_instructions(self, layers: List[LayerInfo], instructions: List[DockerfileInstruction]) -> None:
        for layer in layers:
            layer_instruction = layer.instruction.strip()
            for instruction in instructions:
                instruction_text = f"{instruction.instruction} {instruction.arguments}".strip()
                if layer_instruction == instruction_text or layer_instruction.startswith(f"{instruction.instruction} "):
                    layer.dockerfile_line = instruction.line_number
                    instruction.layer_index = layer.index
                    break

    def _analyze_cache_miss_causes(self, layers: List[LayerInfo], instructions: List[DockerfileInstruction], file_changes: List[FileChange]) -> None:
        for layer in layers:
            if layer.cache_status != CacheStatus.MISS:
                continue

            instruction = layer.instruction.upper()

            if instruction.startswith('COPY') or instruction.startswith('ADD'):
                relevant_changes = self._get_relevant_file_changes(layer.instruction, file_changes)
                if relevant_changes:
                    change_descriptions = []
                    for fc in relevant_changes[:3]:
                        change_descriptions.append(f"{fc.change_type.value}: {os.path.basename(fc.filepath)}")
                    if len(relevant_changes) > 3:
                        change_descriptions.append(f"and {len(relevant_changes) - 3} more")
                    layer.cause_of_miss = f"Source file changes: {', '.join(change_descriptions)}"
                else:
                    layer.cause_of_miss = "Source files changed or cache invalidated"

            elif instruction.startswith('RUN'):
                prev_miss = self._find_previous_miss_layer(layer.index, layers)
                if prev_miss:
                    layer.cause_of_miss = f"Chain reaction from layer {prev_miss.index} miss"
                else:
                    layer.cause_of_miss = "Command or arguments changed"

            elif instruction.startswith('FROM'):
                layer.cause_of_miss = "Base image updated or pulled with --no-cache"

            elif instruction.startswith('ENV') or instruction.startswith('ARG'):
                layer.cause_of_miss = "Environment variable or build argument changed"

            else:
                prev_miss = self._find_previous_miss_layer(layer.index, layers)
                if prev_miss:
                    layer.cause_of_miss = f"Chain reaction from layer {prev_miss.index} miss"
                else:
                    layer.cause_of_miss = "Instruction or context changed"

    def _get_relevant_file_changes(self, instruction: str, file_changes: List[FileChange]) -> List[FileChange]:
        relevant = []
        parts = instruction.split()

        for fc in file_changes:
            filepath = fc.filepath
            for part in parts[1:]:
                part = part.strip('"\'')
                if part == '.' or part == './' or part == '*':
                    relevant.append(fc)
                    break
                if part in filepath or filepath.startswith(part.rstrip('/')):
                    relevant.append(fc)
                    break

        return relevant

    def _find_previous_miss_layer(self, current_index: int, layers: List[LayerInfo]) -> Optional[LayerInfo]:
        for layer in reversed(layers):
            if layer.index < current_index and layer.cache_status == CacheStatus.MISS:
                return layer
        return None

    def _detect_chain_reactions(self, layers: List[LayerInfo]) -> None:
        first_miss_index = None
        for i, layer in enumerate(layers):
            if layer.cache_status == CacheStatus.MISS:
                if first_miss_index is None:
                    first_miss_index = i
                elif first_miss_index is not None and i > first_miss_index:
                    if not layer.cause_of_miss or "Chain reaction" not in layer.cause_of_miss:
                        first_miss_layer = layers[first_miss_index]
                        layer.cause_of_miss = f"Chain reaction from layer {first_miss_layer.index} miss"

    def _generate_recommendations(self, layers: List[LayerInfo], instructions: List[DockerfileInstruction], file_changes: List[FileChange]) -> List[str]:
        recommendations = []

        miss_layers = [l for l in layers if l.cache_status == CacheStatus.MISS]
        if not miss_layers:
            recommendations.append("Excellent! All layers used cache successfully.")
            return recommendations

        first_miss = miss_layers[0]

        if first_miss.instruction.upper().startswith(('COPY', 'ADD')):
            recommendations.append(f"Layer {first_miss.index}: Consider using .dockerignore to exclude unnecessary files from build context")
            recommendations.append(f"Layer {first_miss.index}: Order COPY/ADD instructions from least to most frequently changed files")

        if any('Chain reaction' in l.cause_of_miss for l in miss_layers):
            chain_count = sum(1 for l in miss_layers if 'Chain reaction' in l.cause_of_miss)
            recommendations.append(f"Detected chain reaction affecting {chain_count} layers. Restructure Dockerfile to minimize impact.")

        run_misses = [l for l in miss_layers if l.instruction.upper().startswith('RUN') and 'Chain reaction' not in l.cause_of_miss]
        if run_misses:
            recommendations.append("Combine related RUN commands to reduce the number of layers")
            recommendations.append("Consider using multi-stage builds for better cache utilization")

        if len(miss_layers) > len(layers) * 0.5:
            recommendations.append(f"High cache miss rate ({len(miss_layers)}/{len(layers)} layers). Review Dockerfile structure.")

        if file_changes:
            change_count = len(file_changes)
            if change_count > 10:
                recommendations.append(f"Large number of file changes ({change_count}) may cause frequent cache invalidation")

        env_misses = [l for l in miss_layers if l.instruction.upper().startswith(('ENV', 'ARG'))]
        if env_misses:
            recommendations.append("Place ENV/ARG instructions later in Dockerfile if possible to maximize cache hits")

        return recommendations
