#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')

import asyncio
from dead_config_scanner import ScanConfig
from dead_config_scanner.rules import RuleEngine, get_default_rule_set
from dead_config_scanner.models.scan import ScanItem

async def test_url_check():
    print("测试 URL 检测修复...")
    print("=" * 60)
    
    scan_config = ScanConfig(timeout=10, concurrent=1)
    rule_set = get_default_rule_set()
    engine = RuleEngine(rule_set, scan_config)
    
    test_urls = [
        ("https://www.baidu.com", "百度首页 - 应该有效"),
        ("https://httpstat.us/404", "404页面 - 应该无效"),
    ]
    
    for url, description in test_urls:
        print(f"\n测试: {description}")
        print(f"URL: {url}")
        item = ScanItem(source="test", content=url)
        try:
            result = await asyncio.wait_for(engine.apply_rules(item), timeout=15)
            print(f"状态: {result.status}")
            print(f"错误信息: {result.error_message}")
            print(f"状态码: {result.metadata.get('status_code')}")
        except asyncio.TimeoutError:
            print("结果: 测试超时 (网络问题)")
        except Exception as e:
            print(f"异常: {e}")
    
    print("\n" + "=" * 60)
    print("修复说明:")
    print("1. 先尝试 HEAD 请求")
    print("2. HEAD 失败后自动使用 GET 请求兜底")
    print("3. GET 请求添加 Range 头只请求前 1KB，避免下载大文件")
    print("4. 错误信息中包含使用的请求方法，便于调试")

if __name__ == "__main__":
    asyncio.run(test_url_check())
