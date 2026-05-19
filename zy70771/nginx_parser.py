import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from enum import Enum


class LocationModifier(Enum):
    EXACT = "="
    PREFIX = "^~"
    REGEX_CASE_SENSITIVE = "~"
    REGEX_CASE_INSENSITIVE = "~*"
    NONE = ""


@dataclass
class LocationRule:
    modifier: LocationModifier
    pattern: str
    block_content: List[str] = field(default_factory=list)
    line_number: int = 0
    raw_line: str = ""
    priority: int = 0

    def __post_init__(self):
        self._calculate_priority()

    def _calculate_priority(self):
        priority_map = {
            LocationModifier.EXACT: 4,
            LocationModifier.PREFIX: 3,
            LocationModifier.REGEX_CASE_SENSITIVE: 2,
            LocationModifier.REGEX_CASE_INSENSITIVE: 1,
            LocationModifier.NONE: 0,
        }
        self.priority = priority_map[self.modifier]


@dataclass
class ServerBlock:
    listen: str = ""
    server_name: List[str] = field(default_factory=list)
    locations: List[LocationRule] = field(default_factory=list)
    raw_content: List[str] = field(default_factory=list)
    line_number: int = 0


@dataclass
class NginxConfig:
    raw_lines: List[str] = field(default_factory=list)
    servers: List[ServerBlock] = field(default_factory=list)
    parse_errors: List[str] = field(default_factory=list)


class NginxParser:
    def __init__(self):
        self.config = NginxConfig()

    def parse_file(self, file_path: str) -> NginxConfig:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            return self.parse_lines(lines)
        except FileNotFoundError:
            self.config.parse_errors.append(f"文件不存在: {file_path}")
            return self.config
        except Exception as e:
            self.config.parse_errors.append(f"读取文件错误: {str(e)}")
            return self.config

    def parse_lines(self, lines: List[str]) -> NginxConfig:
        self.config.raw_lines = lines
        self._detect_syntax_errors(lines)
        cleaned_lines = self._preprocess_lines(lines)
        self._parse_servers(cleaned_lines)
        return self.config

    def _detect_syntax_errors(self, lines: List[str]):
        for idx, line in enumerate(lines):
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue

            line_num = idx + 1

            if ";" not in stripped and "{" not in stripped and "}" not in stripped:
                if not (stripped.startswith("server") and "{" in stripped):
                    if not stripped.startswith("location"):
                        self.config.parse_errors.append(
                            f"第 {line_num} 行: 缺少分号或大括号"
                        )

            if stripped.startswith("location") and "{" not in stripped:
                self.config.parse_errors.append(
                    f"第 {line_num} 行: location 块缺少开始大括号"
                )

            if stripped.startswith("location ~"):
                try:
                    pattern_match = re.search(r"location\s+~[*]?\s+([^{]+)\{", stripped)
                    if pattern_match:
                        regex_pattern = pattern_match.group(1).strip()
                        if regex_pattern.startswith("[") and "]" not in regex_pattern:
                            self.config.parse_errors.append(
                                f"第 {line_num} 行: 正则表达式字符集不完整: {regex_pattern}"
                            )
                        else:
                            re.compile(regex_pattern)
                except re.error as e:
                    self.config.parse_errors.append(
                        f"第 {line_num} 行: 无效的正则表达式: {str(e)}"
                    )

    def _preprocess_lines(self, lines: List[str]) -> List[Dict[str, Any]]:
        result = []
        for idx, line in enumerate(lines):
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            result.append(
                {"line_number": idx + 1, "content": stripped, "raw": line}
            )
        return result

    def _parse_servers(self, lines: List[Dict[str, Any]]):
        i = 0
        while i < len(lines):
            line_data = lines[i]
            content = line_data["content"]
            line_num = line_data["line_number"]

            if content.startswith("server") and "{" in content:
                server = ServerBlock(line_number=line_num)
                server.raw_content.append(line_data["raw"])
                i += 1
                brace_count = content.count("{") - content.count("}")
                server_start_line = line_num

                while i < len(lines) and brace_count > 0:
                    line_data = lines[i]
                    content = line_data["content"]
                    server.raw_content.append(line_data["raw"])

                    brace_count += content.count("{") - content.count("}")

                    if content.startswith("listen"):
                        server.listen = self._extract_value(content)
                    elif content.startswith("server_name"):
                        names = self._extract_value(content)
                        server.server_name = names.split()
                    elif content.startswith("location"):
                        location_data = self._parse_location(
                            lines, i, line_data
                        )
                        if location_data:
                            server.locations.append(location_data["rule"])
                            brace_count += location_data["brace_delta"]
                            i = location_data["end_index"]
                            continue

                    i += 1

                if brace_count > 0:
                    self.config.parse_errors.append(
                        f"第 {server_start_line} 行开始的 server 块缺少 {brace_count} 个闭合大括号"
                    )

                self.config.servers.append(server)
            elif content.startswith("server") and "{" not in content:
                self.config.parse_errors.append(
                    f"第 {line_num} 行: server 块缺少开始大括号"
                )
                i += 1
            else:
                i += 1

    def _extract_value(self, line: str) -> str:
        match = re.search(r"^\w+\s+(.+?)\s*;?$", line)
        if match:
            return match.group(1).rstrip(";").strip()
        return ""

    def _parse_location(
        self, lines: List[Dict[str, Any]], start_idx: int, start_line: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        content = start_line["content"]
        pattern = (
            r"location\s+(?:(=|\^~|~|\~\*)\s+)?([^{]+?)\s*\{"
        )
        match = re.search(pattern, content)
        if not match:
            self.config.parse_errors.append(
                f"第 {start_line['line_number']} 行: 无法解析 location 规则"
            )
            return None

        modifier_str = match.group(1) or ""
        path_pattern = match.group(2).strip()

        modifier = LocationModifier.NONE
        for mod in LocationModifier:
            if mod.value == modifier_str:
                modifier = mod
                break

        rule = LocationRule(
            modifier=modifier,
            pattern=path_pattern,
            line_number=start_line["line_number"],
            raw_line=start_line["raw"].strip(),
        )

        i = start_idx + 1
        brace_count = content.count("{") - content.count("}")
        initial_brace = brace_count
        block_content = []

        while i < len(lines) and brace_count > 0:
            line_data = lines[i]
            content = line_data["content"]
            brace_count += content.count("{") - content.count("}")
            if brace_count > 0:
                block_content.append(line_data["raw"])
            i += 1

        rule.block_content = block_content

        brace_delta = 0 - initial_brace
        return {"rule": rule, "end_index": i, "brace_delta": brace_delta}
