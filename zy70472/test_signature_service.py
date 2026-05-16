#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import json
from signature import SignatureService, SignatureError
from models import BatchItem
from audit import AuditManager
from reporter import Reporter


def test_basic_sign():
    print("=" * 60)
    print("测试 1: 基本参数签名")
    service = SignatureService()
    params = {"user_id": "123", "action": "search", "keyword": "手机"}
    result = service.sign(params, "client_001", compensate_enabled=False)
    assert result["success"] == True
    assert result["compensated"] == False
    assert "signature" in result
    print(f"  ✓ 成功, 签名: {result['signature'][:32]}...")
    return True


def test_gray_search_word_with_compensation():
    print("=" * 60)
    print("测试 2: 灰度搜索词 - 启用补偿")
    service = SignatureService()
    params = {"user_id": "123", "action": "search", "keyword": "灰色搜索词测试"}
    result = service.sign(params, "client_001", compensate_enabled=True)
    assert result["success"] == True
    assert result["compensated"] == True
    print(f"  ✓ 补偿成功, gray_score={result['gray_score']}")
    return True


def test_gray_search_word_without_compensation():
    print("=" * 60)
    print("测试 3: 灰度搜索词 - 禁用补偿")
    service = SignatureService()
    params = {"user_id": "123", "action": "search", "keyword": "测试违禁词"}
    try:
        service.sign(params, "client_001", compensate_enabled=False)
        print("  ✗ 应该抛出异常但未抛出")
        return False
    except SignatureError as e:
        assert e.error_code == "GRAY_SEARCH_WORD_DETECTED"
        print(f"  ✓ 正确抛出异常, error_code={e.error_code}")
        return True


def test_verify_signature():
    print("=" * 60)
    print("测试 4: 签名验证")
    service = SignatureService()
    params = {"user_id": "456", "action": "verify"}
    result = service.sign(params, "client_002", False)
    is_valid = service.verify(params, result["signature"], "client_002")
    assert is_valid == True
    print("  ✓ 签名验证成功")
    
    is_invalid = service.verify(params, "invalid_signature", "client_002")
    assert is_invalid == False
    print("  ✓ 错误签名验证失败")
    return True


def test_batch_preview():
    print("=" * 60)
    print("测试 5: 批量预览")
    service = SignatureService()
    items = [
        BatchItem(id="1", params={"keyword": "正常商品"}, client_id="c1"),
        BatchItem(id="2", params={"keyword": "灰色测试"}, client_id="c1"),
        BatchItem(id="3", params={"keyword": "电脑"}, client_id="c2"),
    ]
    preview = service.preview_batch(items)
    assert preview["total_count"] == 3
    assert preview["will_success_count"] == 2
    assert preview["will_fail_count"] == 1
    print(f"  ✓ 总条数: {preview['total_count']}")
    print(f"  ✓ 预计成功: {preview['will_success_count']}")
    print(f"  ✓ 预计失败: {preview['will_fail_count']}")
    return True


def test_batch_partial_success():
    print("=" * 60)
    print("测试 6: 批量部分成功处理")
    service = SignatureService()
    items = [
        BatchItem(id="1", params={"keyword": "正常商品"}, client_id="c1"),
        BatchItem(id="2", params={"keyword": "测试违禁"}, client_id="c1"),
        BatchItem(id="3", params={"keyword": "电脑"}, client_id="c2"),
    ]
    result = service.batch_sign(items, compensate_enabled=False)
    
    assert result["partial_success"] == True
    assert result["success_count"] == 2
    assert result["fail_count"] == 1
    assert len(result["items"]) == 3
    
    print(f"  ✓ batch_id: {result['batch_id']}")
    print(f"  ✓ total: {result['total_count']}")
    print(f"  ✓ success: {result['success_count']}")
    print(f"  ✓ fail: {result['fail_count']}")
    print(f"  ✓ partial_success: {result['partial_success']}")
    
    for item in result["items"]:
        status = "✓" if item.success else "✗"
        print(f"    条目 {item.id}: {status} 执行时间={item.execution_time_ms:.2f}ms")
    
    return True


def test_audit_recording():
    print("=" * 60)
    print("测试 7: 审计记录")
    from datetime import datetime
    
    service = SignatureService()
    audit = AuditManager()
    
    items = [
        BatchItem(id="1", params={"keyword": "商品A"}, client_id="c1"),
        BatchItem(id="2", params={"keyword": "测试违禁"}, client_id="c1"),
    ]
    result = service.batch_sign(items, compensate_enabled=False)
    
    start = datetime.now()
    end = datetime.now()
    audit.record_batch(result["batch_id"], items, result, start, end)
    
    query_result = audit.query({"batch_id": result["batch_id"]})
    assert query_result["total"] == 2
    print(f"  ✓ 审计记录数: {query_result['total']}")
    
    failed_records = audit.get_failed_records(result["batch_id"])
    assert len(failed_records) == 1
    print(f"  ✓ 失败记录数: {len(failed_records)}")
    
    groups = audit.group_by_failure_reason(failed_records)
    assert "GRAY_SEARCH_WORD_DETECTED" in groups
    print(f"  ✓ 失败分组正确: {list(groups.keys())}")
    
    return True


def test_report_generation():
    print("=" * 60)
    print("测试 8: 报告生成")
    from datetime import datetime
    
    service = SignatureService()
    audit = AuditManager()
    reporter = Reporter(audit)
    
    items = [
        BatchItem(id="1", params={"keyword": "商品A"}, client_id="c1"),
        BatchItem(id="2", params={"keyword": "测试违禁"}, client_id="c1"),
        BatchItem(id="3", params={"keyword": "灰色搜索词"}, client_id="c2"),
    ]
    result = service.batch_sign(items, compensate_enabled=True)
    
    audit.record_batch(result["batch_id"], items, result, datetime.now(), datetime.now())
    
    report = reporter.generate_report(result["batch_id"])
    assert report is not None
    
    print(f"  ✓ batch_id: {report.batch_id}")
    print(f"  ✓ 成功率: {report.success_rate:.1f}%")
    print(f"  ✓ 处理时长: {report.duration_ms:.2f}ms")
    print(f"  ✓ 失败摘要: {report.failure_summary}")
    print(f"  ✓ 需要确认: {report.needs_manual_confirmation}")
    print(f"  ✓ 下一步建议: {len(report.next_steps)} 条")
    for step in report.next_steps:
        print(f"      - {step}")
    
    return True


def test_self_check():
    print("=" * 60)
    print("测试 9: 自检功能")
    service = SignatureService()
    results = service.self_check()
    
    print(f"  共执行 {len(results)} 项测试:")
    all_passed = True
    for r in results:
        status = "✓" if r["passed"] == r["expected"] else "✗"
        if r["passed"] != r["expected"]:
            all_passed = False
        print(f"    {status} {r['name']} ({r['execution_time_ms']:.2f}ms)")
    
    print(f"  自检结果: {'全部通过' if all_passed else '存在失败项'}")
    return all_passed


def main():
    print("\n" + "=" * 60)
    print("参数签名器服务 - 综合测试套件")
    print("=" * 60 + "\n")
    
    tests = [
        test_basic_sign,
        test_gray_search_word_with_compensation,
        test_gray_search_word_without_compensation,
        test_verify_signature,
        test_batch_preview,
        test_batch_partial_success,
        test_audit_recording,
        test_report_generation,
        test_self_check,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
                print(f"  ✗ 测试失败")
        except Exception as e:
            failed += 1
            print(f"  ✗ 异常: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "=" * 60)
    print(f"测试结果: 通过 {passed}/{len(tests)}, 失败 {failed}")
    print("=" * 60)
    
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
