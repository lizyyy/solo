import re
from typing import Tuple, List, Optional, Union
from .models import HostEntry, BadEntry


class HostListParser:
    COMMENT_PATTERN = re.compile(r"^#|^//|^;")
    HOST_PATTERN = re.compile(r"^([^\s,;:]+)(?:[\s,;:]+(\d+))?(?:[\s,;:]+(.+))?$")

    def __init__(self, default_port: int = 22):
        self.default_port = default_port

    def parse_line(self, line: str, line_number: int) -> Tuple[Optional[HostEntry], Optional[BadEntry]]:
        stripped_line = line.strip()
        
        if not stripped_line:
            return None, BadEntry(
                line_number=line_number,
                raw_line=line,
                error_reason="空行"
            )
        
        if self.COMMENT_PATTERN.match(stripped_line):
            return None, None

        match = self.HOST_PATTERN.match(stripped_line)
        if not match:
            return None, BadEntry(
                line_number=line_number,
                raw_line=line,
                error_reason="格式无法解析"
            )

        hostname = match.group(1)
        port_str = match.group(2)
        tags_str = match.group(3)

        if not hostname:
            return None, BadEntry(
                line_number=line_number,
                raw_line=line,
                error_reason="主机名为空"
            )

        try:
            port = int(port_str) if port_str else self.default_port
            if port < 1 or port > 65535:
                raise ValueError("端口超出范围")
        except ValueError:
            return None, BadEntry(
                line_number=line_number,
                raw_line=line,
                error_reason=f"无效端口: {port_str}"
            )

        tags = []
        if tags_str:
            tags = [t.strip() for t in re.split(r"[,; ]+", tags_str) if t.strip()]

        return HostEntry(
            line_number=line_number,
            hostname=hostname,
            port=port,
            tags=tags,
            raw_line=line
        ), None

    def parse_file(self, filepath: str) -> Tuple[List[HostEntry], List[BadEntry]]:
        hosts = []
        bad_entries = []

        with open(filepath, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                host, bad = self.parse_line(line.rstrip("\n"), line_num)
                if host:
                    hosts.append(host)
                if bad:
                    bad_entries.append(bad)

        return hosts, bad_entries
