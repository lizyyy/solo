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
                is_valid, reason, status_code = await self._check_url(item.content, rule)
                if not is_valid:
                    item.status = ScanItemStatus.INVALID
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
    
    async def _check_url(self, url: str, rule: Rule) -> Tuple[bool, Optional[str], Optional[int]]:
        if not url.startswith(("http://", "https://")):
            return True, None, None
        
        config = rule.config
        timeout = config.get("timeout", self.scan_config.timeout)
        retry_count = config.get("retry_count", self.scan_config.retry_count)
        acceptable_statuses = config.get("acceptable_statuses", [200, 301, 302])
        failure_codes = config.get("failure_codes", [])
        
        for attempt in range(retry_count + 1):
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.head(
                        url,
                        timeout=aiohttp.ClientTimeout(total=timeout),
                        allow_redirects=self.scan_config.follow_redirects,
                        headers={"User-Agent": self.scan_config.user_agent},
                        ssl=self.scan_config.verify_ssl
                    ) as response:
                        if failure_codes and response.status in failure_codes:
                            return False, f"HTTP {response.status}: {response.reason}", response.status
                        
                        if response.status not in acceptable_statuses:
                            if attempt < retry_count:
                                await asyncio.sleep(1)
                                continue
                            return False, f"HTTP {response.status}: {response.reason}", response.status
                        
                        return True, None, response.status
            except asyncio.TimeoutError:
                if attempt < retry_count:
                    await asyncio.sleep(1)
                    continue
                return False, "请求超时", None
            except aiohttp.ClientSSLError:
                return False, "SSL证书验证失败", None
            except aiohttp.ClientConnectorError:
                if attempt < retry_count:
                    await asyncio.sleep(1)
                    continue
                return False, "无法连接到服务器", None
            except Exception as e:
                if attempt < retry_count:
                    await asyncio.sleep(1)
                    continue
                return False, f"请求异常: {str(e)}", None
        
        return False, "重试次数耗尽", None
    
    def _match_pattern(self, content: str, rule: Rule) -> bool:
        patterns = rule.config.get("patterns", [])
        for pattern in patterns:
            if re.search(pattern, content, re.IGNORECASE):
                return True
        return False
