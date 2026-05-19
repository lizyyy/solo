import re
import json
import hashlib
from datetime import datetime
from typing import List, Dict, Tuple, Optional
from user_agents import parse
from sqlalchemy.orm import Session
from database import AccessLog, FilterRule, AuditLog

class LogParser:
    NGINX_PATTERN = re.compile(
        r'(\d+\.\d+\.\d+\.\d+)\s+-\s+-\s+'
        r'\[([^\]]+)\]\s+'
        r'"(\w+)\s+([^"]+)\s+HTTP/\d+\.\d+"\s+'
        r'(\d+)\s+'
        r'(\d+)\s+'
        r'"([^"]*)"\s+'
        r'"([^"]*)"'
    )

    @classmethod
    def parse_nginx_log(cls, log_line: str) -> Optional[Dict]:
        match = cls.NGINX_PATTERN.match(log_line.strip())
        if not match:
            return None
        ip, time_str, method, path, status, size, referer, user_agent = match.groups()
        try:
            request_time = datetime.strptime(time_str, "%d/%b/%Y:%H:%M:%S %z")
        except ValueError:
            request_time = datetime.utcnow()
        return {
            "ip": ip,
            "method": method,
            "path": path,
            "status_code": int(status),
            "request_time": request_time,
            "referer": referer,
            "user_agent": user_agent,
            "raw_log": log_line.strip()
        }

    @classmethod
    def parse_json_log(cls, log_line: str) -> Optional[Dict]:
        try:
            data = json.loads(log_line.strip())
            return {
                "ip": data.get("ip", data.get("remote_addr", "")),
                "method": data.get("method", data.get("request_method", "")),
                "path": data.get("path", data.get("uri", "")),
                "status_code": int(data.get("status", data.get("status_code", 200))),
                "request_time": datetime.fromisoformat(data.get("timestamp", "")) if data.get("timestamp") else datetime.utcnow(),
                "referer": data.get("referer", ""),
                "user_agent": data.get("user_agent", data.get("http_user_agent", "")),
                "response_time": float(data.get("response_time", 0)),
                "raw_log": log_line.strip()
            }
        except (json.JSONDecodeError, ValueError):
            return None

class CrawlerDetector:
    CRAWLER_KEYWORDS = [
        "bot", "crawler", "spider", "slurp", "robot", "crawl", "scraper",
        "archiver", "extractor", "fetcher", "wget", "curl", "python-requests",
        "python-urllib", "httplib", "go-http-client", "java", "perl", "php",
        "ruby", "scrapy", "splash", "selenium", "headless"
    ]

    SUSPICIOUS_PATHS = [
        "/robots.txt", "/sitemap.xml", "/wp-", "/admin", "/login", "/api/",
        ".env", ".git", ".bak", ".sql", "phpmyadmin", "xmlrpc.php"
    ]

    @classmethod
    def check_user_agent(cls, user_agent: str) -> Tuple[float, Optional[str]]:
        if not user_agent:
            return 0.9, "empty_user_agent"
        ua_lower = user_agent.lower()
        for keyword in cls.CRAWLER_KEYWORDS:
            if keyword in ua_lower:
                return 0.95, f"keyword_{keyword}"
        try:
            ua = parse(user_agent)
            if ua.is_bot:
                return 0.98, "ua_parser_bot"
        except Exception:
            pass
        return 0.0, None

    @classmethod
    def check_path(cls, path: str) -> Tuple[float, Optional[str]]:
        path_lower = path.lower()
        for suspicious in cls.SUSPICIOUS_PATHS:
            if suspicious in path_lower:
                return 0.7, f"suspicious_path_{suspicious}"
        return 0.0, None

    @classmethod
    def check_method(cls, method: str) -> Tuple[float, Optional[str]]:
        if method.upper() in ["HEAD", "OPTIONS", "TRACE"]:
            return 0.3, f"suspicious_method_{method}"
        return 0.0, None

    @classmethod
    def apply_rules(cls, db: Session, log_data: Dict) -> Tuple[float, List[str]]:
        total_confidence = 0.0
        reasons = []
        rules = db.query(FilterRule).filter(FilterRule.is_active == True).all()
        for rule in rules:
            if rule.rule_type == "user_agent":
                if re.search(rule.pattern, log_data.get("user_agent", ""), re.IGNORECASE):
                    total_confidence += rule.confidence
                    reasons.append(f"rule_{rule.name}")
            elif rule.rule_type == "ip":
                if log_data.get("ip") == rule.pattern or re.match(rule.pattern, log_data.get("ip", "")):
                    total_confidence += rule.confidence
                    reasons.append(f"rule_{rule.name}")
            elif rule.rule_type == "path":
                if re.search(rule.pattern, log_data.get("path", "")):
                    total_confidence += rule.confidence
                    reasons.append(f"rule_{rule.name}")
        return min(total_confidence, 1.0), reasons

    @classmethod
    def detect(cls, db: Session, log_data: Dict) -> Tuple[bool, float, List[str]]:
        confidence = 0.0
        reasons = []
        ua_conf, ua_type = cls.check_user_agent(log_data.get("user_agent", ""))
        if ua_type:
            confidence += ua_conf
            reasons.append(ua_type)
        path_conf, path_type = cls.check_path(log_data.get("path", ""))
        if path_type:
            confidence += path_conf
            reasons.append(path_type)
        method_conf, method_type = cls.check_method(log_data.get("method", ""))
        if method_type:
            confidence += method_conf
            reasons.append(method_type)
        rule_conf, rule_reasons = cls.apply_rules(db, log_data)
        confidence += rule_conf
        reasons.extend(rule_reasons)
        confidence = min(confidence, 1.0)
        is_crawler = confidence >= 0.5
        return is_crawler, confidence, reasons

class SuspiciousGrouper:
    @classmethod
    def group_by_ip(cls, logs: List[AccessLog], threshold: int = 10) -> Dict[str, List[AccessLog]]:
        ip_groups = {}
        for log in logs:
            ip = log.ip
            if ip not in ip_groups:
                ip_groups[ip] = []
            ip_groups[ip].append(log)
        return {ip: group for ip, group in ip_groups.items() if len(group) >= threshold}

    @classmethod
    def generate_group_id(cls, ip: str, user_agent: str) -> str:
        key = f"{ip}:{user_agent[:50]}"
        return hashlib.md5(key.encode()).hexdigest()[:12]

    @classmethod
    def assign_groups(cls, logs: List[AccessLog]) -> None:
        for log in logs:
            if log.group_id is None:
                log.group_id = cls.generate_group_id(log.ip, log.user_agent)

class AuditManager:
    @staticmethod
    def log_action(db: Session, action: str, operator: str, old_value: str = None,
                   new_value: str = None, reason: str = None, log_id: int = None,
                   report_id: int = None):
        audit = AuditLog(
            log_id=log_id,
            report_id=report_id,
            action=action,
            operator=operator,
            old_value=old_value,
            new_value=new_value,
            reason=reason
        )
        db.add(audit)
        db.commit()
