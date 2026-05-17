import os
from typing import List, Dict, Optional
from collections import defaultdict
from .models import (
    DockerfileInstruction, LayerInfo, CacheStatus, FileChange,
    ChangeType, AnalysisResult, ParseError
)
from .parser import DockerfileParser, BuildLogParser, FileChangeParser


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
        build_log_content = self._read_file(build_log_path, errors, "build_log")
        
        instructions = self.dockerfile_parser.parse(dockerfile_content, os.path.basename(dockerfile_path))
        errors.extend(self.dockerfile_parser.errors)
        
        layers = self.log_parser.parse(build_log_content, os.path.basename(build_log_path))
        errors.extend(self.log_parser.errors)
        
        file_changes = []
        if file_changes_path and os.path.exists(file_changes_path):
            file_change_content = self._read_file(file_changes_path, errors, "file_changes")
            file_changes = self.file_change_parser.parse_diff(file_change_content)
        
        self._associate_layers_with_instructions(instructions, layers)
        self._analyze_cache_miss_causes(layers, instructions, file_changes)
        
        hit_count = sum(1 for l in layers if l.cache_status == CacheStatus.HIT)
        miss_count = sum(1 for l in layers if l.cache_status == CacheStatus.MISS)
        
        total_time = sum(l.build_time_ms for l in layers)
        
        recommendations = self._generate_recommendations(layers, instructions, file_changes)
        
        return AnalysisResult(
            dockerfile_instructions=instructions,
            layers=layers,
            parse_errors=errors,
            total_build_time_ms=total_time,
            cache_hit_count=hit_count,
            cache_miss_count=miss_count,
            recommendations=recommendations,
            metadata={
                'dockerfile_path': dockerfile_path,
                'build_log_path': build_log_path,
                'file_changes_path': file_changes_path
            }
        )

    def _read_file(self, path: str, errors: List[ParseError], file_type: str) -> str:
        try:
            with open(path, 'r', encoding='utf-8', errors='replace') as f:
                return f.read()
        except Exception as e:
            errors.append(ParseError(
                line_number=0,
                line_content="",
                error_type="file_read_error",
                message=f"Failed to read {file_type} file: {str(e)}",
                source_file=path
            ))
            return ""

    def _associate_layers_with_instructions(
        self,
        instructions: List[DockerfileInstruction],
        layers: List[LayerInfo]
    ):
        layerable_instructions = [
            i for i in instructions 
            if i.instruction in {'FROM', 'RUN', 'ADD', 'COPY', 'ENV', 'WORKDIR', 'USER', 'ARG'}
        ]
        
        for idx, layer in enumerate(layers):
            if idx < len(layerable_instructions):
                inst = layerable_instructions[idx]
                layer.dockerfile_line = inst.line_number
                inst.layer_index = layer.index

    def _analyze_cache_miss_causes(
        self,
        layers: List[LayerInfo],
        instructions: List[DockerfileInstruction],
        file_changes: List[FileChange]
    ):
        for i, layer in enumerate(layers):
            if layer.cache_status == CacheStatus.MISS:
                if i > 0 and layers[i-1].cache_status == CacheStatus.MISS:
                    layer.cause_of_miss = "上层缓存失效导致连锁反应"
                else:
                    layer.cause_of_miss = self._determine_miss_cause(layer, instructions, file_changes)

    def _determine_miss_cause(
        self,
        layer: LayerInfo,
        instructions: List[DockerfileInstruction],
        file_changes: List[FileChange]
    ) -> str:
        instruction_lower = layer.instruction.lower()
        
        if 'copy' in instruction_lower or 'add' in instruction_lower:
            relevant_changes = [
                fc for fc in file_changes
                if self._file_matches_instruction(fc.filepath, layer.instruction)
            ]
            if relevant_changes:
                change_descs = []
                for fc in relevant_changes[:3]:
                    change_descs.append(f"{fc.change_type.value}: {fc.filepath}")
                if len(relevant_changes) > 3:
                    change_descs.append(f"...以及 {len(relevant_changes) - 3} 个其他文件")
                return "源文件变更: " + "; ".join(change_descs)
            return "COPY/ADD 源文件变更或命令修改"
        
        if 'run' in instruction_lower:
            return "RUN 命令内容变更或依赖环境变化"
        
        if 'env' in instruction_lower:
            return "环境变量值变更"
        
        if 'from' in instruction_lower:
            return "基础镜像更新或标签变更"
        
        return "指令内容变更"

    def _file_matches_instruction(self, filepath: str, instruction: str) -> bool:
        parts = instruction.split()
        for part in parts[1:]:
            if part in filepath or part.replace('.', '') in filepath:
                return True
        return False

    def _generate_recommendations(
        self,
        layers: List[LayerInfo],
        instructions: List[DockerfileInstruction],
        file_changes: List[FileChange]
    ) -> List[str]:
        recommendations = []
        
        miss_layers = [l for l in layers if l.cache_status == CacheStatus.MISS]
        
        if len(miss_layers) > 3:
            first_miss = miss_layers[0]
            recommendations.append(
                f"建议优化: 第 {first_miss.index} 层({first_miss.instruction[:30]}...) 缓存失效导致后续 {len(miss_layers) - 1} 层全部重新构建"
            )
        
        copy_misses = [l for l in miss_layers if 'copy' in l.instruction.lower() or 'add' in l.instruction.lower()]
        if copy_misses:
            recommendations.append(
                "建议优化: COPY/ADD 命令建议将不常变更的文件放在前面复制，利用缓存"
            )
        
        run_misses = [l for l in miss_layers if 'run' in l.instruction.lower()]
        if len(run_misses) > 2:
            recommendations.append(
                "建议优化: 考虑合并相关的 RUN 命令以减少层数，或按变更频率排序 RUN 命令"
            )
        
        if file_changes:
            modified = [fc for fc in file_changes if fc.change_type == ChangeType.FILE_MODIFIED]
            if len(modified) > 5:
                recommendations.append(
                    f"检测到大量文件变更({len(modified)}个文件)，建议使用 .dockerignore 排除不必要文件"
                )
        
        return recommendations
