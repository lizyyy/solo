#!/usr/bin/env python3
"""
K8s Parser 逻辑单元测试 - 验证资源缺失识别
"""
import sys
sys.path.insert(0, '.')

from k8s_parser import K8sResourceParser
from database import IssueType


class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'


def print_success(msg):
    print(f"{Colors.GREEN}✓ PASS:{Colors.ENDC} {msg}")


def print_error(msg):
    print(f"{Colors.RED}✗ FAIL:{Colors.ENDC} {msg}")


def print_info(msg):
    print(f"{Colors.BLUE}ℹ INFO:{Colors.ENDC} {msg}")


def test_partial_missing_scenarios():
    """测试各种局部缺失场景"""
    print_info("测试局部缺失场景测试")
    print_info("=" * 60)

    parser = K8sResourceParser()
    all_passed = True

    test_cases = [
        {
            "name": "完全正常 - CPU和Memory都有requests和limits",
            "cpu_req": "250m", "mem_req": "256Mi",
            "cpu_lim": "500m", "mem_lim": "512Mi",
            "expected": IssueType.NORMAL
        },
        {
            "name": "只缺 CPU request（有mem request，都有limits",
            "cpu_req": "", "mem_req": "128Mi",
            "cpu_lim": "500m", "mem_lim": "512Mi",
            "expected": IssueType.MISSING_REQUESTS
        },
        {
            "name": "只缺 Memory request（有cpu request，都有limits）",
            "cpu_req": "100m", "mem_req": "",
            "cpu_lim": "500m", "mem_lim": "512Mi",
            "expected": IssueType.MISSING_REQUESTS
        },
        {
            "name": "只缺 CPU limit（有mem limit，都有requests",
            "cpu_req": "100m", "mem_req": "128Mi",
            "cpu_lim": "", "mem_lim": "512Mi",
            "expected": IssueType.MISSING_LIMITS
        },
        {
            "name": "只缺 Memory limit（有cpu limit，都有requests）",
            "cpu_req": "100m", "mem_req": "128Mi",
            "cpu_lim": "500m", "mem_lim": "",
            "expected": IssueType.MISSING_LIMITS
        },
        {
            "name": "完全没有requests，都有limits",
            "cpu_req": "", "mem_req": "",
            "cpu_lim": "500m", "mem_lim": "512Mi",
            "expected": IssueType.MISSING_REQUESTS
        },
        {
            "name": "完全没有limits，都有requests",
            "cpu_req": "100m", "mem_req": "128Mi",
            "cpu_lim": "", "mem_lim": "",
            "expected": IssueType.MISSING_LIMITS
        },
        {
            "name": "requests和limits都完全没有",
            "cpu_req": "", "mem_req": "",
            "cpu_lim": "", "mem_lim": "",
            "expected": IssueType.MISSING_BOTH
        },
        {
            "name": "缺CPU request和缺CPU limit（有mem req和lim）",
            "cpu_req": "", "mem_req": "128Mi",
            "cpu_lim": "", "mem_lim": "512Mi",
            "expected": IssueType.MISSING_BOTH
        },
        {
            "name": "requests完整但比例异常（比例问题）",
            "cpu_req": "100m", "mem_req": "128Mi",
            "cpu_lim": "1000m", "mem_lim": "1024Mi",
            "expected": IssueType.RATIO_MISMATCH
        },
    ]

    for tc in test_cases:
        issue_type, cpu_ratio, mem_ratio = parser.determine_issue_type(
            tc["cpu_req"], tc["mem_req"],
            tc["cpu_lim"], tc["mem_lim"]
        )
        
        status = "PASS" if issue_type == tc["expected"] else "FAIL"
        
        if issue_type == tc["expected"]:
            print_success(f"{tc['name']}")
            print_info(f"  预期: {tc['expected'].value}, 实际: {issue_type.value}")
        else:
            print_error(f"{tc['name']}")
            print_error(f"  预期: {tc['expected'].value}, 实际: {issue_type.value}")
            all_passed = False
        print()

    return all_passed


def main():
    print_info("=" * 60)
    print_info("K8s Parser 逻辑单元测试")
    print_info("=" * 60)
    print()

    result = test_partial_missing_scenarios()

    print_info("=" * 60)
    if result:
        print_success("所有单元测试通过!")
        return 0
    else:
        print_error("部分单元测试失败!")
        return 1


if __name__ == "__main__":
    sys.exit(main())
