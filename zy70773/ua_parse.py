import re
import hashlib
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List, Tuple
from ua_parser import user_agent_parser


@dataclass
class ParsedUA:
    raw: str
    family: str = ""
    major: str = ""
    minor: str = ""
    patch: str = ""
    os_family: str = ""
    os_major: str = ""
    os_minor: str = ""
    device_family: str = ""
    device_brand: str = ""
    device_model: str = ""
    is_mobile: bool = False
    is_tablet: bool = False
    is_pc: bool = False
    is_bot: bool = False
    hash: str = ""

    def __post_init__(self):
        if not self.hash:
            self.hash = hashlib.md5(self.raw.encode("utf-8")).hexdigest()[:12]


@dataclass
class LogEntry:
    line_number: int
    raw_line: str
    is_valid: bool = True
    ip: str = ""
    timestamp: str = ""
    method: str = ""
    path: str = ""
    protocol: str = ""
    status: int = 0
    body_bytes_sent: int = 0
    referer: str = ""
    user_agent: str = ""
    parsed_ua: Optional[ParsedUA] = None
    category: str = "unknown"
    category_reason: str = ""
    cluster_id: str = ""
    path_signature: str = ""


class UAParser:
    def __init__(self):
        self.bot_keywords = {
            "bot", "crawler", "spider", "scraper", "curl", "wget", "python",
            "java", "perl", "php", "ruby", "go-http", "axios", "postman",
            "insomnia", "slurp", "yahoo! slurp", "bingbot", "googlebot",
            "baiduspider", "yandexbot", "duckduckbot", "facebot", "facebookexternalhit",
            "twitterbot", "linkedinbot", "pinterest", "semrush", "ahrefs", "mj12",
            "dotbot", "screaming frog", "rogerbot", "petalbot", "bytespider"
        }
        
        self.mobile_keywords = {
            "mobile", "android", "iphone", "ipad", "ipod", "blackberry",
            "windows phone", "symbian", "webos", "opera mini", "ucbrowser",
            "miui", "huawei", "xiaomi", "oppo", "vivo", "oneplus"
        }

    def parse(self, ua_string: str) -> ParsedUA:
        if not ua_string or ua_string == "-":
            return ParsedUA(raw=ua_string or "-", family="Empty")
        
        parsed = user_agent_parser.Parse(ua_string)
        
        ua = parsed.get("user_agent", {})
        os = parsed.get("os", {})
        device = parsed.get("device", {})
        
        result = ParsedUA(
            raw=ua_string,
            family=ua.get("family", "Other") or "Other",
            major=ua.get("major", "") or "",
            minor=ua.get("minor", "") or "",
            patch=ua.get("patch", "") or "",
            os_family=os.get("family", "Other") or "Other",
            os_major=os.get("major", "") or "",
            os_minor=os.get("minor", "") or "",
            device_family=device.get("family", "Other") or "Other",
            device_brand=device.get("brand", "") or "",
            device_model=device.get("model", "") or "",
        )
        
        result.is_bot = self._detect_bot(ua_string, result)
        result.is_mobile = self._detect_mobile(ua_string, result)
        result.is_tablet = "tablet" in ua_string.lower() or result.device_family == "Tablet"
        result.is_pc = not result.is_bot and not result.is_mobile and not result.is_tablet
        
        return result

    def _detect_bot(self, ua_string: str, parsed: ParsedUA) -> bool:
        ua_lower = ua_string.lower()
        for keyword in self.bot_keywords:
            if keyword in ua_lower:
                return True
        if parsed.family and parsed.family.lower() in {"spider", "bot", "crawler"}:
            return True
        if parsed.device_family == "Spider":
            return True
        return False

    def _detect_mobile(self, ua_string: str, parsed: ParsedUA) -> bool:
        ua_lower = ua_string.lower()
        for keyword in self.mobile_keywords:
            if keyword in ua_lower:
                return True
        if parsed.device_family in {"iPhone", "Android", "Mobile"}:
            return True
        return False

    def get_ua_signature(self, parsed: ParsedUA) -> str:
        parts = [
            parsed.family,
            parsed.os_family,
            parsed.device_family,
            "bot" if parsed.is_bot else "",
            "mobile" if parsed.is_mobile else "",
        ]
        return "|".join(p for p in parts if p)


class LogParser:
    NGINX_PATTERN = re.compile(
        r'^(?P<ip>\S+) '
        r'(?P<host>\S+) '
        r'(?P<user>\S+) '
        r'\[(?P<timestamp>[^\]]+)\] '
        r'"(?P<request>(?P<method>\S+) (?P<path>\S+) (?P<protocol>\S+)|-)" '
        r'(?P<status>\d+) '
        r'(?P<body_bytes_sent>\d+) '
        r'"(?P<referer>[^"]*)" '
        r'"(?P<user_agent>[^"]*)"$'
    )

    def __init__(self):
        self.ua_parser = UAParser()

    def parse_line(self, line: str, line_number: int) -> LogEntry:
        line = line.rstrip("\n")
        entry = LogEntry(line_number=line_number, raw_line=line)
        
        if not line.strip():
            entry.is_valid = False
            entry.category_reason = "empty_line"
            return entry
        
        match = self.NGINX_PATTERN.match(line)
        if not match:
            entry.is_valid = False
            entry.category_reason = "parse_failed"
            return entry
        
        try:
            groups = match.groupdict()
            entry.ip = groups.get("ip", "")
            entry.timestamp = groups.get("timestamp", "")
            entry.method = groups.get("method", "") or ""
            entry.path = groups.get("path", "") or ""
            entry.protocol = groups.get("protocol", "") or ""
            entry.status = int(groups.get("status", 0) or 0)
            entry.body_bytes_sent = int(groups.get("body_bytes_sent", 0) or 0)
            entry.referer = groups.get("referer", "") or ""
            entry.user_agent = groups.get("user_agent", "") or ""
            
            if entry.user_agent:
                entry.parsed_ua = self.ua_parser.parse(entry.user_agent)
                entry.path_signature = self._get_path_signature(entry.path)
            
        except Exception as e:
            entry.is_valid = False
            entry.category_reason = f"parse_error:{str(e)}"
        
        return entry

    def _get_path_signature(self, path: str) -> str:
        if not path:
            return "empty"
        
        path = re.sub(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '{uuid}', path, flags=re.IGNORECASE)
        path = re.sub(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b', '{ip}', path)
        path = re.sub(r'\b\d+\b', '{num}', path)
        path = re.sub(r'/[0-9a-f]{6,}', '/{hash}', path, flags=re.IGNORECASE)
        
        return path