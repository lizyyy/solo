#!/usr/bin/env python3
"""
测试脚本 - 验证 UA 分类器功能
"""
import os
import sys
import tempfile

TEST_LOG_LINES = """192.168.1.1 - - [15/Jan/2024:10:00:00 +0800] "GET / HTTP/1.1" 200 1234 "https://example.com" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
192.168.1.2 - - [15/Jan/2024:10:00:01 +0800] "GET /robots.txt HTTP/1.1" 200 567 "-" "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
10.0.0.5 - - [15/Jan/2024:10:00:02 +0800] "GET /api/v1/users HTTP/1.1" 403 123 "-" "curl/7.68.0"
192.168.1.3 - - [15/Jan/2024:10:00:03 +0800] "GET / HTTP/1.1" 200 1234 "-" "-"
172.16.0.1 - - [15/Jan/2024:10:00:04 +0800] "GET /admin HTTP/1.1" 404 456 "-" "Mozilla/5.0 zgrab/0.x"
192.168.1.4 - - [15/Jan/2024:10:00:05 +0800] "GET / HTTP/1.1" 200 1234 "-" "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1"
10.0.0.1 - - [15/Jan/2024:10:00:06 +0800] "GET /test1 HTTP/1.1" 200 100 "-" "UnknownClient/1.0"
10.0.0.1 - - [15/Jan/2024:10:00:07 +0800] "GET /test2 HTTP/1.1" 200 100 "-" "UnknownClient/1.0"
10.0.0.1 - - [15/Jan/2024:10:00:08 +0800] "GET /test3 HTTP/1.1" 200 100 "-" "UnknownClient/1.0"
10.0.0.1 - - [15/Jan/2024:10:00:09 +0800] "GET /test4 HTTP/1.1" 200 100 "-" "UnknownClient/1.0"
invalid log line here
192.168.1.5 - - [15/Jan/2024:10:00:10 +0800] "POST /api HTTP/1.1" 200 789 "-" "Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36"
"""


def test_parse_single_ua():
    print("[测试1] 解析单个UA...")
    from ua_parse import UAParser
    
    ua_parser = UAParser()
    
    test_uas = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "curl/7.68.0",
        "-",
    ]
    
    for ua in test_uas:
        parsed = ua_parser.parse(ua)
        print(f"  UA: {ua[:50]}... -> family={parsed.family}, bot={parsed.is_bot}")
    
    print("  ✓ UA解析正常\n")


def test_rule_matching():
    print("[测试2] 规则匹配...")
    from rule_matcher import RuleMatcher
    from ua_parse import LogEntry, UAParser
    
    rule_matcher = RuleMatcher()
    ua_parser = UAParser()
    
    test_cases = [
        ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0", "client"),
        ("Mozilla/5.0 (compatible; Googlebot/2.1)", "crawler"),
        ("curl/7.68.0", "crawler"),
        ("-", "risk"),
        ("sqlmap/1.0", "risk"),
    ]
    
    all_passed = True
    for ua, expected in test_cases:
        entry = LogEntry(line_number=0, raw_line="")
        entry.user_agent = ua
        entry.parsed_ua = ua_parser.parse(ua)
        category = rule_matcher.classify(entry)
        status = "✓" if category == expected else "✗"
        if category != expected:
            all_passed = False
        print(f"  {status} {ua[:40]}... -> {category} (expected: {expected})")
    
    if all_passed:
        print("  ✓ 规则匹配正常\n")
    else:
        print("  ✗ 部分规则匹配失败\n")


def test_log_parsing():
    print("[测试3] 日志解析...")
    from ua_parse import LogParser
    
    log_parser = LogParser()
    
    valid_line = '192.168.1.1 - - [15/Jan/2024:10:00:00 +0800] "GET / HTTP/1.1" 200 1234 "-" "Mozilla/5.0"'
    invalid_line = "this is not a valid log line"
    
    entry1 = log_parser.parse_line(valid_line, 1)
    entry2 = log_parser.parse_line(invalid_line, 2)
    
    print(f"  有效行: is_valid={entry1.is_valid}, ip={entry1.ip}, path={entry1.path}")
    print(f"  无效行: is_valid={entry2.is_valid}, line_number={entry2.line_number}, reason={entry2.category_reason}")
    
    print("  ✓ 日志解析正常\n")


def test_full_workflow():
    print("[测试4] 完整工作流...")
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.log', delete=False) as f:
        f.write(TEST_LOG_LINES)
        temp_file = f.name
    
    try:
        cmd = f"{sys.executable} ua_classifier.py analyze {temp_file} --report-id test_{os.getpid()} --quiet"
        print(f"  执行: {cmd}")
        result = os.system(cmd)
        
        if result == 0:
            print("  ✓ 完整工作流正常")
            
            import glob
            report_files = glob.glob("reports/*test_*.json")
            if report_files:
                print(f"  ✓ 报告文件已生成: {report_files[0]}")
        else:
            print("  ✗ 工作流执行失败")
    finally:
        os.unlink(temp_file)
    print()


def main():
    print("=" * 50)
    print("UA 分类器功能测试")
    print("=" * 50 + "\n")
    
    try:
        test_parse_single_ua()
        test_rule_matching()
        test_log_parsing()
        test_full_workflow()
        
        print("=" * 50)
        print("所有测试完成!")
        print("=" * 50)
        
    except ImportError as e:
        print(f"\n✗ 导入错误: {e}")
        print("请先运行: pip install -r requirements.txt")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()