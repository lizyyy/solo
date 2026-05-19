#!/usr/bin/env python
"""测试 R004 规则修复：不同仓库不同分支的重叠窗口不应误判"""

import sys
from datetime import datetime

sys.path.insert(0, '.')

from branch_protection_audit.models import (
    ParseResult,
    Repository,
    BranchRule,
    ExceptionApplication,
    ProtectionWindow,
    RecoveryAction,
    SourceLocation,
)
from branch_protection_audit.rules import RuleEngine


def create_test_source():
    return SourceLocation(file_path="test.json", line_number=1, raw_content="")


def test_different_repo_different_branch_should_not_fail():
    """测试：不同仓库、不同分支但时间重叠的窗口，不应判定为失败"""
    print("=" * 60)
    print("测试 1: 不同仓库、不同分支但时间重叠 - 不应报错")
    print("=" * 60)

    result = ParseResult()
    source = create_test_source()

    repo1 = Repository(id="repo-A", name="仓库A", source=source)
    repo2 = Repository(id="repo-B", name="仓库B", source=source)
    result.repositories = [repo1, repo2]

    exc1 = ExceptionApplication(
        id="exc-A",
        repository_id="repo-A",
        branch_pattern="main",
        applicant="张三",
        approver="李四",
        reason="修复A",
        requested_at=datetime(2024, 1, 1, 10, 0),
        status="APPROVED",
        source=source,
    )
    exc2 = ExceptionApplication(
        id="exc-B",
        repository_id="repo-B",
        branch_pattern="develop",
        applicant="王五",
        approver="赵六",
        reason="修复B",
        requested_at=datetime(2024, 1, 1, 10, 0),
        status="APPROVED",
        source=source,
    )
    result.exceptions = [exc1, exc2]

    win1 = ProtectionWindow(
        id="win-A",
        exception_id="exc-A",
        start_time=datetime(2024, 1, 1, 10, 0),
        end_time=datetime(2024, 1, 1, 12, 0),
        is_active=False,
        source=source,
    )
    win2 = ProtectionWindow(
        id="win-B",
        exception_id="exc-B",
        start_time=datetime(2024, 1, 1, 11, 0),
        end_time=datetime(2024, 1, 1, 13, 0),
        is_active=False,
        source=source,
    )
    result.windows = [win1, win2]

    engine = RuleEngine()
    conclusion = engine.run_all_rules(result)

    print(f"总记录数: {conclusion.total_records}")
    print(f"通过: {conclusion.pass_count}, 警告: {conclusion.warn_count}, 失败: {conclusion.fail_count}")

    r004_fail_results = []
    for record in conclusion.records:
        for v in record.validations:
            if v.rule_id == "R004" and "重叠窗口" in v.message and v.status == "FAIL":
                r004_fail_results.append(v)

    if r004_fail_results:
        print(f"\n❌ 错误: 检测到 {len(r004_fail_results)} 个重叠窗口 FAIL 错误")
        for v in r004_fail_results:
            print(f"   [{v.status}] {v.message}")
        return False
    else:
        print("✅ 正确: 不同仓库不同分支的时间重叠未被误判")
        return True


def test_same_repo_same_branch_overlap_should_fail():
    """测试：同一仓库同一分支的时间重叠窗口，应该判定为失败"""
    print("\n" + "=" * 60)
    print("测试 2: 同一仓库同一分支的时间重叠 - 应该报错")
    print("=" * 60)

    result = ParseResult()
    source = create_test_source()

    repo1 = Repository(id="repo-A", name="仓库A", source=source)
    result.repositories = [repo1]

    exc1 = ExceptionApplication(
        id="exc-A1",
        repository_id="repo-A",
        branch_pattern="main",
        applicant="张三",
        approver="李四",
        reason="修复1",
        requested_at=datetime(2024, 1, 1, 10, 0),
        status="APPROVED",
        source=source,
    )
    exc2 = ExceptionApplication(
        id="exc-A2",
        repository_id="repo-A",
        branch_pattern="main",
        applicant="张三",
        approver="李四",
        reason="修复2",
        requested_at=datetime(2024, 1, 1, 10, 30),
        status="APPROVED",
        source=source,
    )
    result.exceptions = [exc1, exc2]

    win1 = ProtectionWindow(
        id="win-A1",
        exception_id="exc-A1",
        start_time=datetime(2024, 1, 1, 10, 0),
        end_time=datetime(2024, 1, 1, 12, 0),
        is_active=False,
        source=source,
    )
    win2 = ProtectionWindow(
        id="win-A2",
        exception_id="exc-A2",
        start_time=datetime(2024, 1, 1, 11, 0),
        end_time=datetime(2024, 1, 1, 13, 0),
        is_active=False,
        source=source,
    )
    result.windows = [win1, win2]

    engine = RuleEngine()
    conclusion = engine.run_all_rules(result)

    print(f"总记录数: {conclusion.total_records}")
    print(f"通过: {conclusion.pass_count}, 警告: {conclusion.warn_count}, 失败: {conclusion.fail_count}")

    r004_fail_results = []
    for record in conclusion.records:
        for v in record.validations:
            if v.rule_id == "R004" and "重叠窗口" in v.message and v.status == "FAIL":
                r004_fail_results.append(v)

    if r004_fail_results:
        print(f"\n✅ 正确: 检测到 {len(r004_fail_results)} 个重叠窗口 FAIL 错误（预期行为）")
        for v in r004_fail_results:
            print(f"   [{v.status}] {v.message}")
        return True
    else:
        print("❌ 错误: 同一仓库同一分支的时间重叠未被检测到")
        return False


def main():
    test1 = test_different_repo_different_branch_should_not_fail()
    test2 = test_same_repo_same_branch_overlap_should_fail()

    print("\n" + "=" * 60)
    if test1 and test2:
        print("✅ 所有测试通过！")
    else:
        print("❌ 部分测试失败！")
    print("=" * 60)

    return 0 if (test1 and test2) else 1


if __name__ == "__main__":
    sys.exit(main())
