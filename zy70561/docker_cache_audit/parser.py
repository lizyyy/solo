import re
import os
from typing import List, Optional, Tuple
from .models import (
    DockerfileInstruction, LayerInfo, CacheStatus, FileChange,
    ChangeType, ParseError
)


class DockerfileParser:
    def __init__(self):
        self.instructions: List[DockerfileInstruction] = []
        self.errors: List[ParseError] = []
        self.valid_instructions = {
            'FROM', 'RUN', 'CMD', 'LABEL', 'MAINTAINER', 'EXPOSE',
            'ENV', 'ADD', 'COPY', 'ENTRYPOINT', 'VOLUME', 'USER',
            'WORKDIR', 'ARG', 'ONBUILD', 'STOPSIGNAL', 'HEALTHCHECK',
            'SHELL'
        }

    def parse(self, content: str, filename: str = "Dockerfile") -> List[DockerfileInstruction]:
        self.instructions = []
        self.errors = []
        lines = content.splitlines()
        line_buffer = []
        start_line = 0

        for line_num, line in enumerate(lines, 1):
            stripped = line.strip()
            
            if not stripped or stripped.startswith('#'):
                continue

            if line.endswith('\\'):
                if not line_buffer:
                    start_line = line_num
                line_buffer.append(line[:-1])
                continue

            if line_buffer:
                line_buffer.append(line)
                full_line = ' '.join(line_buffer)
                line_buffer = []
            else:
                full_line = line
                start_line = line_num

            self._parse_instruction(full_line, start_line, filename)

        return self.instructions

    def _parse_instruction(self, line: str, line_num: int, filename: str):
        parts = line.split(None, 1)
        if not parts:
            return

        instruction = parts[0].upper()
        args = parts[1] if len(parts) > 1 else ''

        if instruction not in self.valid_instructions:
            self.errors.append(ParseError(
                line_number=line_num,
                line_content=line,
                error_type="invalid_instruction",
                message=f"Unknown Dockerfile instruction: {instruction}",
                source_file=filename
            ))

        self.instructions.append(DockerfileInstruction(
            line_number=line_num,
            instruction=instruction,
            arguments=args,
            raw_content=line
        ))


class BuildLogParser:
    def __init__(self):
        self.layers: List[LayerInfo] = []
        self.errors: List[ParseError] = []

    def parse(self, content: str, filename: str = "build.log") -> List[LayerInfo]:
        self.layers = []
        self.errors = []
        lines = content.splitlines()
        
        current_layer = None

        for line_num, line in enumerate(lines, 1):
            self._parse_line(line, line_num, filename)

        return self.layers

    def _parse_line(self, line: str, line_num: int, filename: str):
        if 'Step' in line and ':' in line:
            match = re.match(r'^Step\s+(\d+)/(\d+)\s+:\s+(.+)$', line)
            if match:
                step_num = int(match.group(1))
                instruction = match.group(3)
                layer = LayerInfo(
                    index=step_num,
                    instruction=instruction,
                    cache_status=CacheStatus.UNKNOWN,
                    layer_hash="",
                    build_time_ms=0,
                    size_bytes=0
                )
                self.layers.append(layer)
                return

        if 'Using cache' in line:
            if self.layers:
                self.layers[-1].cache_status = CacheStatus.HIT
            return

        if '--->' in line and 'Running in' not in line and 'Using cache' not in line:
            match = re.search(r'--->\s+([a-f0-9]{12})', line)
            if match and self.layers:
                self.layers[-1].layer_hash = match.group(1)
                if self.layers[-1].cache_status == CacheStatus.UNKNOWN:
                    self.layers[-1].cache_status = CacheStatus.MISS
            return


class FileChangeParser:
    def parse_diff(self, content: str) -> List[FileChange]:
        changes = []
        lines = content.splitlines()
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            if line.startswith('M '):
                changes.append(FileChange(
                    filepath=line[2:].strip(),
                    change_type=ChangeType.FILE_MODIFIED
                ))
            elif line.startswith('A '):
                changes.append(FileChange(
                    filepath=line[2:].strip(),
                    change_type=ChangeType.FILE_ADDED
                ))
            elif line.startswith('D '):
                changes.append(FileChange(
                    filepath=line[2:].strip(),
                    change_type=ChangeType.FILE_DELETED
                ))
            elif line.startswith('R '):
                parts = line[2:].strip().split(' -> ', 1)
                if len(parts) == 2:
                    changes.append(FileChange(
                        filepath=parts[1].strip(),
                        change_type=ChangeType.FILE_RENAMED,
                        old_filepath=parts[0].strip()
                    ))
                else:
                    changes.append(FileChange(
                        filepath=line[2:].strip(),
                        change_type=ChangeType.FILE_RENAMED
                    ))
        
        return changes
