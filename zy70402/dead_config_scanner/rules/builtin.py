from ..models.rule import Rule, RuleSet, RuleType, RuleSeverity


def get_default_rule_set() -> RuleSet:
    rule_set = RuleSet(
        set_id="default",
        name="默认死配置检测规则集",
        version="2.0.0",
        description="包含基础的URL有效性检测和常见废弃配置模式匹配 - v2.0: 区分链接失效(INVALID)与扫描错误(ERROR)"
    )
    
    url_check_rule = Rule(
        rule_id="url_alive_check",
        name="URL存活检测",
        version="2.0.0",
        type=RuleType.URL_CHECK,
        severity=RuleSeverity.ERROR,
        description="检测HTTP/HTTPS链接是否可访问，4xx和5xx视为失效 - v2.0: 区分链接失效与扫描错误",
        config={
            "check_methods": ["HEAD", "GET"],
            "follow_redirects": True,
            "acceptable_statuses": [200, 201, 202, 203, 204, 206, 301, 302, 304, 307, 308],
            "timeout": 10
        }
    )
    
    deprecated_pattern_rule = Rule(
        rule_id="deprecated_pattern",
        name="废弃配置模式检测",
        version="2.0.0",
        type=RuleType.PATTERN_MATCH,
        severity=RuleSeverity.WARNING,
        description="检测已废弃的配置模式",
        config={
            "patterns": [
                r"old-api\.example\.com",
                r"legacy-endpoint",
                r"deprecated-v1"
            ]
        }
    )
    
    legal_evidence_rule = Rule(
        rule_id="legal_evidence_url",
        name="灰度法务证据页链接检测",
        version="2.0.0",
        type=RuleType.URL_CHECK,
        severity=RuleSeverity.CRITICAL,
        description="专门针对法务证据页下载链接的有效性检测 - v2.0: 支持HEAD+GET双重检测",
        config={
            "priority": "high",
            "retry_count": 3,
            "failure_codes": [404, 410, 500, 502, 503],
            "timeout": 15
        }
    )
    
    rule_set.add_rule(url_check_rule)
    rule_set.add_rule(deprecated_pattern_rule)
    rule_set.add_rule(legal_evidence_rule)
    
    return rule_set
