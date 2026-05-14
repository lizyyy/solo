import asyncio
import aiohttp
import re
from datetime import datetime
from typing import Tuple, Optional, Dict, Any
from urllib.parse import urlparse

from ..models.rule import Rule, RuleSet, RuleType
from ..models.scan import ScanItem, ScanItemStatus, ScanConfig


class RuleEngine:
    def __init__(self, rule_set: RuleSet, scan_config: ScanConfig):
        self.rule_set = rule_set
        self.scan_config = scan_config
        self.rule_versions = rule_set.get_rule_versions()
    
    async def apply_rules(self, item: ScanItem) -> ScanItem:
        item.rule_versions = self.rule_versions.copy()
        item.scan_time = datetime.now()
        
        for rule in self.rule_set.get_enabled_rules():
            if rule.type == RuleType.URL_CHECK:
                status, reason, status_code = await self._check_url(item.content, rule)
                if status != ScanItemStatus.VALID:
                    item.status = status
                    item.error_message = reason
                    item.metadata["status_code"] = status_code
                    return item
            elif rule.type == RuleType.PATTERN_MATCH:
                if self._match_pattern(item.content, rule):
                    item.status = ScanItemStatus.INVALID
                    item.error_message = f"匹配到废弃模式: {rule.name}"
                    return item
        
        item.status = ScanItemStatus.VALID
        return item
    
    async def _check_url(self, url: str, rule: Rule) -> Tuple[ScanItemStatus, Optional[str], Optional[int]]:
        if not url.startswith(("http://", "https://")):
            return ScanItemStatus.VALID, None, None
        
        config = rule.config
        timeout = config.get("timeout", self.scan_config.timeout)
        retry_count = config.get("retry_count", self.scan_config.retry_count)
        acceptable_statuses = config.get("acceptable_statuses", [200, 201, 202, 203, 204, 206, 301, 302, 304, 307, 308])
        failure_codes = config.get("failure_codes", [])
        check_methods = config.get("check_methods", ["HEAD", "GET"])
        
        last_error = None
        last_status = None
        has_http_response = False
        
        for attempt in range(retry_count + 1):
            for method in check_methods:
                try:
                    async with aiohttp.ClientSession() as session:
                        request_func = session.head if method == "HEAD" else session.get
                        
                        request_kwargs = {
                            "timeout": aiohttp.ClientTimeout(total=timeout),
                            "allow_redirects": self.scan_config.follow_redirects,
                            "headers": {"User-Agent": self.scan_config.user_agent},
                            "ssl": self.scan_config.verify_ssl
                        }
                        
                        if method == "GET":
                            request_kwargs["headers"]["Range"] = "bytes=0-1023"
                        
                        async with request_func(url, **request_kwargs) as response:
                            last_status = response.status
                            has_http_response = True
                            
                            if failure_codes and response.status in failure_codes:
                                return ScanItemStatus.INVALID, f"HTTP {response.status}: {response.reason} ({method})", response.status
                            
                            if response.status not in acceptable_statuses:
                                last_error = f"HTTP {response.status}: {response.reason} ({method})"
                                continue
                            
                            return ScanItemStatus.VALID, None, response.status
                except asyncio.TimeoutError:
                    last_error = f"请求超时 ({method})"
                    continue
                except aiohttp.ClientSSLError:
                    return ScanItemStatus.ERROR, "SSL证书验证失败", None
                except aiohttp.ClientConnectorError:
                    last_error = f"无法连接到服务器 ({method})"
                    continue
                except aiohttp.ClientResponseError:
                    last_error = f"响应错误 ({method})"
                    has_http_response = True
                    continue
                except Exception as e:
                    last_error = f"请求异常: {str(e)} ({method})"
                    continue
            
            if attempt < retry_count:
                await asyncio.sleep(1)
        
        if has_http_response:
            return ScanItemStatus.INVALID, last_error or "重试次数耗尽", last_status
        else:
            return ScanItemStatus.ERROR, last_error or "重试次数耗尽", last_status
    
    def _match_pattern(self, content: str, rule: Rule) -> bool:
        patterns = rule.config.get("patterns", [])
        for pattern in patterns:
            if re.search(pattern, content, re.IGNORECASE):
                return True
        return False
