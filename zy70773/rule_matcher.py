import re
import yaml
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Pattern, Any, Set
from pathlib import Path

from ua_parse import LogEntry, ParsedUA


@dataclass
class Rule:
    name: str
    category: str
    patterns: List[str] = field(default_factory=list)
    compiled_patterns: List[Pattern] = field(default_factory=list)
    ua_families: Set[str] = field(default_factory=set)
    os_families: Set[str] = field(default_factory=set)
    device_families: Set[str] = field(default_factory=set)
    priority: int = 0
    is_bot: Optional[bool] = None
    is_mobile: Optional[bool] = None
    
    def match(self, entry: LogEntry, parsed_ua: ParsedUA) -> bool:
        if self.is_bot is not None and parsed_ua.is_bot != self.is_bot:
            return False
        if self.is_mobile is not None and parsed_ua.is_mobile != self.is_mobile:
            return False
        
        has_conditions = (self.ua_families or self.os_families or 
                         self.device_families or self.compiled_patterns)
        
        if not has_conditions:
            return False
        
        matched = False
        
        if self.ua_families and parsed_ua.family in self.ua_families:
            matched = True
        if self.os_families and parsed_ua.os_family in self.os_families:
            matched = True
        if self.device_families and parsed_ua.device_family in self.device_families:
            matched = True
        
        if self.compiled_patterns and not matched:
            ua_string = entry.user_agent.lower() if entry.user_agent else ""
            for pattern in self.compiled_patterns:
                if pattern.search(ua_string):
                    matched = True
                    break
        
        return matched


class RuleMatcher:
    CATEGORIES = ["client", "crawler", "risk", "unknown"]
    
    def __init__(self, rules_path: Optional[str] = None):
        self.rules: List[Rule] = []
        self.category_stats: Dict[str, int] = {cat: 0 for cat in self.CATEGORIES}
        self._load_default_rules()
        if rules_path and Path(rules_path).exists():
            self._load_rules_from_file(rules_path)
        self.rules.sort(key=lambda r: (-r.priority, r.name))
    
    def _load_default_rules(self):
        crawler_patterns = [
            r"bot", r"crawler", r"spider", r"slurp", r"scraper",
            r"googlebot", r"bingbot", r"baiduspider", r"yandex",
            r"duckduckbot", r"facebot", r"twitterbot", r"linkedinbot",
            r"pinterest", r"semrush", r"ahrefs", r"mj12", r"dotbot",
            r"rogerbot", r"petalbot", r"bytespider", r"360spider",
            r"sogou", r"exabot", r"turnitinbot", r"scribdbot",
            r"curl", r"wget", r"python-requests", r"python-urllib",
            r"go-http-client", r"java/", r"perl-", r"ruby", r"php/",
            r"postman", r"insomnia", r"node-fetch", r"axios"
        ]
        
        self.rules.append(Rule(
            name="known_crawlers",
            category="crawler",
            patterns=crawler_patterns,
            compiled_patterns=[re.compile(p, re.IGNORECASE) for p in crawler_patterns],
            priority=100,
            is_bot=True
        ))
        
        client_ua_families = {
            "Chrome", "Chrome Mobile", "Chrome Mobile iOS",
            "Firefox", "Firefox Mobile", "Firefox iOS",
            "Safari", "Mobile Safari", "Mobile Safari UI/WKWebView",
            "Edge", "Edge Mobile",
            "Opera", "Opera Mobile", "Opera Mini",
            "Samsung Internet", "MiuiBrowser", "UC Browser",
            "QQ Browser", "Baidu Browser", "Vivo Browser",
            "Oppo Browser", "Android Browser"
        }
        
        self.rules.append(Rule(
            name="desktop_mobile_browsers",
            category="client",
            ua_families=client_ua_families,
            priority=80,
            is_bot=False
        ))
        
        client_os_families = {
            "Windows", "Mac OS X", "Linux",
            "Android", "iOS", "iPadOS",
            "Chrome OS", "Ubuntu", "Fedora"
        }
        
        self.rules.append(Rule(
            name="legitimate_os_clients",
            category="client",
            os_families=client_os_families,
            priority=60,
            is_bot=False
        ))
        
        risk_patterns = [
            r"masscan", r"nmap", r"nessus", r"openvas",
            r"acunetix", r"netsparker", r"burp", r"sqlmap",
            r"nikto", r"dirbuster", r"gobuster", r"feroxbuster",
            r"hydra", r"medusa", r"patator", r"metasploit",
            r"zgrab", r"zmap", r"masscan", r"shodan",
            r"censys", r"binaryedge", r"peathound", r"bloodhound"
        ]
        
        self.rules.append(Rule(
            name="scanner_tools",
            category="risk",
            patterns=risk_patterns,
            compiled_patterns=[re.compile(p, re.IGNORECASE) for p in risk_patterns],
            priority=90
        ))
        
        empty_ua_rule = Rule(
            name="empty_user_agent",
            category="risk",
            patterns=[r"^-$", r"^$"],
            compiled_patterns=[re.compile(r"^(-)?$", re.IGNORECASE)],
            priority=95
        )
        self.rules.append(empty_ua_rule)
    
    def _load_rules_from_file(self, rules_path: str):
        with open(rules_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        
        if not data or "rules" not in data:
            return
        
        for rule_data in data["rules"]:
            patterns = rule_data.get("patterns", [])
            rule = Rule(
                name=rule_data.get("name", "unnamed"),
                category=rule_data.get("category", "unknown"),
                patterns=patterns,
                compiled_patterns=[re.compile(p, re.IGNORECASE) for p in patterns],
                ua_families=set(rule_data.get("ua_families", [])),
                os_families=set(rule_data.get("os_families", [])),
                device_families=set(rule_data.get("device_families", [])),
                priority=rule_data.get("priority", 0),
                is_bot=rule_data.get("is_bot"),
                is_mobile=rule_data.get("is_mobile")
            )
            self.rules.append(rule)
    
    def classify(self, entry: LogEntry) -> str:
        if not entry.is_valid or not entry.parsed_ua:
            entry.category = "unknown"
            entry.category_reason = "invalid_entry"
            return "unknown"
        
        for rule in self.rules:
            if rule.match(entry, entry.parsed_ua):
                entry.category = rule.category
                entry.category_reason = rule.name
                self.category_stats[rule.category] += 1
                return rule.category
        
        entry.category = "unknown"
        entry.category_reason = "no_rule_matched"
        self.category_stats["unknown"] += 1
        return "unknown"
    
    def get_stats(self) -> Dict[str, int]:
        return dict(self.category_stats)
    
    def reset_stats(self):
        self.category_stats = {cat: 0 for cat in self.CATEGORIES}