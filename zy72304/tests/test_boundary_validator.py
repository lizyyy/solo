"""
边界校验器测试

测试百分数和小数混合的判定、修改、回滚机制
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bus_scheduling.validator import BoundaryValidator
from bus_scheduling.models import NumberType, IssueStatus


class TestBoundaryValidator:
    """边界校验器测试类"""

    def setup_method(self):
        self.validator = BoundaryValidator()

    def test_detect_percentage(self):
        """测试检测百分数"""
        num_type, value = self.validator.detect_number_type("85%")
        assert num_type == NumberType.PERCENTAGE
        assert abs(value - 0.85) < 0.001

    def test_detect_decimal(self):
        """测试检测小数"""
        num_type, value = self.validator.detect_number_type("120")
        assert num_type == NumberType.DECIMAL
        assert abs(value - 120.0) < 0.001

    def test_detect_decimal_with_point(self):
        """测试检测带小数点的数"""
        num_type, value = self.validator.detect_number_type("120.5")
        assert num_type == NumberType.DECIMAL
        assert abs(value - 120.5) < 0.001

    def test_detect_unknown(self):
        """测试检测未知格式"""
        num_type, value = self.validator.detect_number_type("abc")
        assert num_type == NumberType.UNKNOWN
        assert value is None

    def test_detect_empty(self):
        """测试检测空值"""
        num_type, value = self.validator.detect_number_type("")
        assert num_type == NumberType.UNKNOWN
        assert value is None

    def test_check_mixed_numbers(self):
        """测试检测混合数"""
        values = ["85%", "120", "75%", "95"]
        has_mixed, issues = self.validator.check_mixed_numbers(
            values, "rec_001", "客流量"
        )
        assert has_mixed is True
        assert len(issues) == 4

    def test_check_no_mixed_percentage_only(self):
        """测试只有百分数的情况"""
        values = ["85%", "75%", "90%"]
        has_mixed, issues = self.validator.check_mixed_numbers(
            values, "rec_001", "客流量"
        )
        assert has_mixed is False
        assert len(issues) == 0

    def test_check_no_mixed_decimal_only(self):
        """测试只有小数的情况"""
        values = ["85", "120", "95"]
        has_mixed, issues = self.validator.check_mixed_numbers(
            values, "rec_001", "客流量"
        )
        assert has_mixed is False
        assert len(issues) == 0

    def test_review_issue_approved(self):
        """测试复核通过"""
        values = ["85%", "120"]
        _, issues = self.validator.check_mixed_numbers(
            values, "rec_001", "客流量"
        )
        issue = issues[0]

        updated = self.validator.review_issue(
            issue=issue,
            approved=True,
            reviewer="活动负责人",
            retain_reason="该线路为特殊线路，允许使用百分数",
        )

        assert updated.status == IssueStatus.APPROVED
        assert updated.reviewer == "活动负责人"
        assert updated.retain_reason == "该线路为特殊线路，允许使用百分数"

    def test_review_issue_modified(self):
        """测试复核并修改"""
        values = ["85%", "120"]
        _, issues = self.validator.check_mixed_numbers(
            values, "rec_001", "客流量"
        )
        issue = issues[0]

        updated = self.validator.review_issue(
            issue=issue,
            approved=False,
            reviewer="活动负责人",
            retain_reason="统一改为小数格式",
            modified_value=85.0,
        )

        assert updated.status == IssueStatus.MODIFIED
        assert abs(updated.suggested_value - 85.0) < 0.001

    def test_review_issue_rejected(self):
        """测试复核拒绝"""
        values = ["85%", "120"]
        _, issues = self.validator.check_mixed_numbers(
            values, "rec_001", "客流量"
        )
        issue = issues[0]

        updated = self.validator.review_issue(
            issue=issue,
            approved=False,
            reviewer="活动负责人",
            retain_reason="数据异常，需要重新采集",
        )

        assert updated.status == IssueStatus.REJECTED

    def test_rollback_issue(self):
        """测试回滚"""
        values = ["85%", "120"]
        _, issues = self.validator.check_mixed_numbers(
            values, "rec_001", "客流量"
        )
        issue = issues[0]

        # 先复核通过
        self.validator.review_issue(
            issue=issue,
            approved=True,
            reviewer="活动负责人",
        )
        assert issue.status == IssueStatus.APPROVED

        # 再回滚
        updated, history = self.validator.rollback_issue(
            issue=issue,
            operator="活动负责人",
            reason="复核有误，需要重新确认",
        )

        assert updated.status == IssueStatus.PENDING_REVIEW
        assert history.old_value == IssueStatus.APPROVED.value
        assert history.new_value == IssueStatus.PENDING_REVIEW.value

    def test_modify_value(self):
        """测试修改数值"""
        values = ["85%", "120"]
        _, issues = self.validator.check_mixed_numbers(
            values, "rec_001", "客流量"
        )
        issue = issues[0]

        updated, history = self.validator.modify_value(
            issue=issue,
            new_value=90.0,
            operator="实验助理小穆",
            reason="根据最新数据调整",
        )

        assert abs(updated.suggested_value - 90.0) < 0.001
        assert updated.status == IssueStatus.MODIFIED
        assert history.old_value == "0.85"
        assert history.new_value == "90.0"

    def test_get_boundary_rules(self):
        """测试获取边界规则"""
        rules = self.validator.get_boundary_rules()
        assert "规则说明" in rules
        assert "百分数格式" in rules
        assert "小数格式" in rules
        assert "混合判定" in rules
        assert "混合处理" in rules


if __name__ == "__main__":
    # 运行测试
    test = TestBoundaryValidator()

    print("=== 边界校验器测试 ===")
    print()

    print("1. 测试检测百分数...")
    test.setup_method()
    test.test_detect_percentage()
    print("   ✓ 通过")

    print("2. 测试检测小数...")
    test.setup_method()
    test.test_detect_decimal()
    print("   ✓ 通过")

    print("3. 测试检测带小数点的数...")
    test.setup_method()
    test.test_detect_decimal_with_point()
    print("   ✓ 通过")

    print("4. 测试检测未知格式...")
    test.setup_method()
    test.test_detect_unknown()
    print("   ✓ 通过")

    print("5. 测试检测空值...")
    test.setup_method()
    test.test_detect_empty()
    print("   ✓ 通过")

    print("6. 测试检测混合数...")
    test.setup_method()
    test.test_check_mixed_numbers()
    print("   ✓ 通过")

    print("7. 测试只有百分数的情况...")
    test.setup_method()
    test.test_check_no_mixed_percentage_only()
    print("   ✓ 通过")

    print("8. 测试只有小数的情况...")
    test.setup_method()
    test.test_check_no_mixed_decimal_only()
    print("   ✓ 通过")

    print("9. 测试复核通过...")
    test.setup_method()
    test.test_review_issue_approved()
    print("   ✓ 通过")

    print("10. 测试复核并修改...")
    test.setup_method()
    test.test_review_issue_modified()
    print("   ✓ 通过")

    print("11. 测试复核拒绝...")
    test.setup_method()
    test.test_review_issue_rejected()
    print("   ✓ 通过")

    print("12. 测试回滚...")
    test.setup_method()
    test.test_rollback_issue()
    print("   ✓ 通过")

    print("13. 测试修改数值...")
    test.setup_method()
    test.test_modify_value()
    print("   ✓ 通过")

    print("14. 测试获取边界规则...")
    test.setup_method()
    test.test_get_boundary_rules()
    print("   ✓ 通过")

    print()
    print("所有测试通过！")
