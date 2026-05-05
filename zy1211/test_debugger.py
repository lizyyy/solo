#!/usr/bin/env python3
"""Test script for perf-debugger."""

import sys
import tempfile
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from perf_debugger.seeds.good_samples import generate_good_samples
from perf_debugger.seeds.bad_samples import generate_bad_samples
from perf_debugger.database import init_db, get_session, Session
from perf_debugger.parsers import detect_parser, parse_file
from perf_debugger.analyzers import analyze_session
from perf_debugger.reporters import generate_report, export_json, export_markdown


def test_good_samples():
    """Test with normal (good) samples."""
    print("=" * 60)
    print("测试 1: 好样例 (正常系统状态)")
    print("=" * 60)
    
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        
        print("\n[1/5] 生成好样例数据...")
        generate_good_samples(tmpdir)
        sample_files = list(tmp_path.glob("*.txt"))
        print(f"    生成了 {len(sample_files)} 个样本文件")
        
        print("\n[2/5] 初始化数据库...")
        test_db = tmp_path / "test.db"
        init_db(str(test_db))
        db = get_session(str(test_db))
        print("    数据库初始化完成")
        
        print("\n[3/5] 创建会话并导入数据...")
        session = Session(
            name="Test Good Session",
            description="Test session with normal samples"
        )
        db.add(session)
        db.flush()
        
        for sample_file in sample_files:
            sample_type = detect_parser(sample_file)
            if sample_type:
                print(f"    导入 [{sample_type}]: {sample_file.name}")
                try:
                    result = parse_file(db, session, sample_file, sample_type)
                    print(f"        - {result['metrics_count']} metrics, {result['records_count']} records")
                except Exception as e:
                    print(f"        - 错误: {e}")
        
        db.commit()
        
        print("\n[4/5] 分析会话...")
        result = analyze_session(db, session, cpu_threshold=80.0, iowait_threshold=30.0)
        print(f"    检测到 {len(result['events'])} 个事件")
        print(f"    分析摘要: {result.get('summary', '无')}")
        
        print("\n[5/5] 生成报告...")
        report = generate_report(db, session)
        print("    报告生成完成")
        print("\n" + "=" * 60)
        print("好样例测试结果:")
        print("=" * 60)
        if len(result['events']) == 0:
            print("✓ PASS: 正常系统状态未检测到异常事件")
        else:
            print(f"⚠ 检测到 {len(result['events'])} 个事件 (可能是正常波动)")
        
        db.close()
        return len(result['events'])


def test_bad_samples():
    """Test with anomaly (bad) samples."""
    print("\n" + "=" * 60)
    print("测试 2: 坏样例 (系统异常状态)")
    print("=" * 60)
    
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        
        print("\n[1/5] 生成坏样例数据...")
        generate_bad_samples(tmpdir, issue_type='all')
        sample_files = list(tmp_path.glob("*.txt"))
        print(f"    生成了 {len(sample_files)} 个样本文件")
        
        print("\n[2/5] 初始化数据库...")
        test_db = tmp_path / "test_bad.db"
        init_db(str(test_db))
        db = get_session(str(test_db))
        print("    数据库初始化完成")
        
        print("\n[3/5] 创建会话并导入数据...")
        session = Session(
            name="Test Bad Session",
            description="Test session with anomaly samples"
        )
        db.add(session)
        db.flush()
        
        for sample_file in sample_files:
            sample_type = detect_parser(sample_file)
            if sample_type:
                print(f"    导入 [{sample_type}]: {sample_file.name}")
                try:
                    result = parse_file(db, session, sample_file, sample_type)
                    print(f"        - {result['metrics_count']} metrics, {result['records_count']} records")
                except Exception as e:
                    print(f"        - 错误: {e}")
        
        db.commit()
        
        print("\n[4/5] 分析会话...")
        result = analyze_session(db, session, cpu_threshold=80.0, iowait_threshold=30.0)
        print(f"    检测到 {len(result['events'])} 个事件")
        print(f"    分析摘要: {result.get('summary', '无')}")
        
        print("\n[5/5] 生成报告...")
        json_file = tmp_path / "report.json"
        md_file = tmp_path / "report.md"
        
        export_json(db, session, str(json_file))
        export_markdown(db, session, str(md_file))
        
        print(f"    JSON 报告: {json_file}")
        print(f"    Markdown 报告: {md_file}")
        
        report = generate_report(db, session)
        print("\n" + "=" * 60)
        print("坏样例测试结果:")
        print("=" * 60)
        
        if len(result['events']) > 0:
            print("✓ PASS: 成功检测到异常事件!")
            for event in result['events']:
                print(f"  - [{event.severity}] {event.event_type}: {event.title}")
        else:
            print("✗ FAIL: 应该检测到异常事件但没有检测到")
        
        db.close()
        return len(result['events'])


def main():
    """Run all tests."""
    print("=" * 60)
    print("perf-debugger 测试套件")
    print("=" * 60)
    
    try:
        good_events = test_good_samples()
        bad_events = test_bad_samples()
        
        print("\n" + "=" * 60)
        print("测试总结")
        print("=" * 60)
        print(f"好样例测试: 检测到 {good_events} 个事件 (期望: 0 或很少)")
        print(f"坏样例测试: 检测到 {bad_events} 个事件 (期望: > 0)")
        
        if bad_events > 0:
            print("\n✓ 核心功能测试通过!")
            return 0
        else:
            print("\n✗ 坏样例测试未检测到异常")
            return 1
            
    except Exception as e:
        print(f"\n✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
