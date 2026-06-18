"""
集成测试
========

验证完整流程和边界情况：
1. 三步核心流程（机构一致情况）
2. 机构简称不一致时留待财务复核
3. 重复导入不翻倍
4. 变更历史前后对比
5. 回滚机制
6. 3D/图表展示跳转原始材料
7. 可重跑命令生成
"""

import os
import sys
import json
import tempfile
import pytest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from cross_border_compliance.database import Base
from cross_border_compliance.models import (
    ComplianceSpotCheck, CheckStatus, ChangeHistory,
    ReviewTask, AuditLog, ExDividendScreenshot
)
from cross_border_compliance.services import (
    import_ex_dividend_screenshots,
    add_tax_rate_remark,
    update_spot_check_record,
    get_rerun_commands,
    get_spot_check_detail
)
from cross_border_compliance.boundary_rules import (
    check_institution_name_consistency,
    add_institution_alias,
    update_spot_check_field,
    rollback_change,
    review_institution_name,
    get_source_material_for_visualization,
    get_change_history_diff
)


@pytest.fixture
def db_session():
    """创建测试数据库会话"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class TestCoreWorkflow:
    """测试三步核心流程"""

    def test_complete_workflow_consistent_names(self, db_session):
        """测试机构名称一致的完整流程"""
        screenshots_data = [
            {
                "institution_name": "摩根大通银行",
                "ex_dividend_date": "2026-06-15",
                "dividend_amount": "0.25",
                "currency": "USD"
            }
        ]

        # 第一步：导入除权日截图
        result = import_ex_dividend_screenshots(
            db_session, screenshots_data,
            "/data/screenshots_20260603.png",
            "assistant_zhou"
        )
        assert result["created"] == 1
        assert result["skipped"] == 0
        spot_check_id = result["spot_check_ids"][0]

        spot_check = db_session.query(ComplianceSpotCheck).filter(
            ComplianceSpotCheck.id == spot_check_id
        ).first()
        assert spot_check.status == CheckStatus.IMPORTED
        assert spot_check.institution_name_from_screenshot == "摩根大通银行"

        # 第二步：补看税费率备注（机构名一致）
        remark_data = {
            "institution_name": "摩根大通银行",
            "remark_content": "跨境汇款税率10%，需补缴差额",
            "tax_rate": "10%",
            "tax_type": "withholding",
            "source_file": "/data/tax_remark_20260603.pdf"
        }
        spot_check, msg = add_tax_rate_remark(
            db_session, spot_check_id, remark_data, "assistant_zhou"
        )
        assert spot_check.status == CheckStatus.REMARK_ADDED
        assert spot_check.institution_name_consistent is True
        assert "一致" in msg

        # 第三步：补录记录更新
        update_data = {
            "check_result": "合规，已按10%税率补缴",
            "check_result_reason": "复核后确认补缴金额正确"
        }
        spot_check, msg = update_spot_check_record(
            db_session, spot_check_id, update_data, "assistant_zhou"
        )
        assert "已更新" in msg
        assert spot_check.check_result == "合规，已按10%税率补缴"
        assert spot_check.status == CheckStatus.REMARK_ADDED

        # 查看变更历史
        history = get_change_history_diff(db_session, spot_check_id)
        assert history["total_changes"] >= 5
        changes = history["changes"]
        assert any(c["field"] == "status" for c in changes)
        assert any(c["field"] == "institution_name_from_remark" for c in changes)

    def test_institution_name_inconsistent_needs_review(self, db_session):
        """测试机构简称不一致时留待财务复核，不急着归正常"""
        screenshots_data = [
            {
                "institution_name": "摩根大通银行",
                "ex_dividend_date": "2026-06-15",
                "dividend_amount": "0.25",
                "currency": "USD"
            }
        ]

        result = import_ex_dividend_screenshots(
            db_session, screenshots_data,
            "/data/screenshots_20260603.png",
            "assistant_zhou"
        )
        spot_check_id = result["spot_check_ids"][0]

        # 第二步：补看备注，但机构名不一致
        remark_data = {
            "institution_name": "摩根大通",
            "remark_content": "跨境汇款税率10%",
            "tax_rate": "10%",
            "source_file": "/data/tax_remark.pdf"
        }
        spot_check, msg = add_tax_rate_remark(
            db_session, spot_check_id, remark_data, "assistant_zhou"
        )

        # 不一致时状态变为 review_required，不自动归一化
        assert spot_check.status == CheckStatus.REVIEW_REQUIRED
        assert spot_check.institution_name_consistent is False
        assert "留待财务复核" in msg

        # 自动创建了复核任务
        review_task = db_session.query(ReviewTask).filter(
            ReviewTask.spot_check_id == spot_check_id,
            ReviewTask.status == "pending"
        ).first()
        assert review_task is not None
        assert review_task.issue_type == "institution_name_inconsistency"

        # 财务复核通过，指定标准名
        spot_check, msg = review_institution_name(
            db_session, spot_check_id,
            approved=True,
            reviewer="finance_reviewer",
            resolution="确认是同一机构",
            standard_name="摩根大通银行"
        )
        assert spot_check.status == CheckStatus.REVIEWED
        assert spot_check.institution_name_consistent is True
        assert spot_check.institution_name_from_screenshot == "摩根大通银行"
        assert spot_check.institution_name_from_remark == "摩根大通银行"

        # 第三步：补录完成
        update_data = {"check_result": "合规"}
        spot_check, msg = update_spot_check_record(
            db_session, spot_check_id, update_data, "assistant_zhou"
        )
        assert spot_check.status == CheckStatus.COMPLETED

    def test_duplicate_import_not_doubled(self, db_session):
        """测试重复导入同一批除权日截图不翻倍"""
        screenshots_data = [
            {
                "institution_name": "摩根大通银行",
                "ex_dividend_date": "2026-06-15",
                "dividend_amount": "0.25",
                "currency": "USD"
            },
            {
                "institution_name": "高盛集团",
                "ex_dividend_date": "2026-06-20",
                "dividend_amount": "1.50",
                "currency": "USD"
            }
        ]

        # 第一次导入
        result1 = import_ex_dividend_screenshots(
            db_session, screenshots_data,
            "/data/screenshots_20260603.png",
            "assistant_zhou"
        )
        assert result1["created"] == 2
        assert result1["skipped"] == 0

        count_after_first = db_session.query(ComplianceSpotCheck).count()
        assert count_after_first == 2

        # 第二次导入相同数据
        result2 = import_ex_dividend_screenshots(
            db_session, screenshots_data,
            "/data/screenshots_20260603.png",
            "assistant_zhou"
        )
        assert result2["created"] == 0
        assert result2["skipped"] == 2

        count_after_second = db_session.query(ComplianceSpotCheck).count()
        assert count_after_second == 2

        # 第三次导入部分重复+部分新
        screenshots_data2 = [
            {
                "institution_name": "摩根大通银行",
                "ex_dividend_date": "2026-06-15",
                "dividend_amount": "0.25",
                "currency": "USD"
            },
            {
                "institution_name": "摩根士丹利",
                "ex_dividend_date": "2026-06-25",
                "dividend_amount": "0.85",
                "currency": "USD"
            }
        ]
        result3 = import_ex_dividend_screenshots(
            db_session, screenshots_data2,
            "/data/screenshots_20260603.png",
            "assistant_zhou"
        )
        assert result3["created"] == 1
        assert result3["skipped"] == 1

        count_after_third = db_session.query(ComplianceSpotCheck).count()
        assert count_after_third == 3


class TestChangeHistory:
    """测试变更历史和回滚"""

    def test_single_remark_change_show_diff(self, db_session):
        """测试单条备注修改能看出改前改后的差别"""
        screenshots_data = [
            {
                "institution_name": "摩根大通银行",
                "ex_dividend_date": "2026-06-15",
                "dividend_amount": "0.25",
                "currency": "USD"
            }
        ]
        result = import_ex_dividend_screenshots(
            db_session, screenshots_data, "/data/test.png", "assistant_zhou"
        )
        spot_check_id = result["spot_check_ids"][0]

        remark_data = {
            "institution_name": "摩根大通银行",
            "remark_content": "跨境汇款税率10%",
            "tax_rate": "10%"
        }
        add_tax_rate_remark(db_session, spot_check_id, remark_data, "assistant_zhou")

        # 小周只改了一条备注
        spot_check, msg = update_spot_check_field(
            db_session, spot_check_id,
            field_name="institution_name_from_remark",
            new_value="摩根大通银行（中国）",
            operator="assistant_zhou",
            change_reason="补充完整机构名称"
        )

        # 历史里能看出改前改后
        history = get_change_history_diff(db_session, spot_check_id)
        remark_changes = [
            c for c in history["changes"]
            if c["field"] == "institution_name_from_remark"
        ]
        assert len(remark_changes) >= 2

        last_change = remark_changes[-1]
        assert last_change["old_value"] == "摩根大通银行"
        assert last_change["new_value"] == "摩根大通银行（中国）"
        assert last_change["changed_by"] == "assistant_zhou"
        assert last_change["change_reason"] == "补充完整机构名称"
        assert last_change["rollback_command"] is not None

    def test_rollback_change(self, db_session):
        """测试回滚机制"""
        screenshots_data = [
            {
                "institution_name": "摩根大通银行",
                "ex_dividend_date": "2026-06-15",
                "dividend_amount": "0.25",
                "currency": "USD"
            }
        ]
        result = import_ex_dividend_screenshots(
            db_session, screenshots_data, "/data/test.png", "assistant_zhou"
        )
        spot_check_id = result["spot_check_ids"][0]

        # 修改备注
        spot_check, msg = update_spot_check_field(
            db_session, spot_check_id,
            field_name="institution_name_from_screenshot",
            new_value="摩根大通",
            operator="assistant_zhou",
            change_reason="测试修改"
        )

        # 找到变更记录
        changes = db_session.query(ChangeHistory).filter(
            ChangeHistory.spot_check_id == spot_check_id,
            ChangeHistory.field_name == "institution_name_from_screenshot"
        ).order_by(ChangeHistory.id.desc()).first()

        # 回滚
        spot_check, msg = rollback_change(
            db_session, changes.id, "assistant_zhou"
        )
        assert spot_check.institution_name_from_screenshot == "摩根大通银行"

        # 回滚本身也记录历史
        history = get_change_history_diff(db_session, spot_check_id)
        rollback_changes = [
            c for c in history["changes"]
            if c["action"] == "rollback"
        ]
        assert len(rollback_changes) == 1

    def test_rollback_command_matches_real_cli(self, db_session):
        """测试自动生成的回滚命令与真实CLI参数一致"""
        screenshots_data = [
            {
                "institution_name": "摩根大通银行",
                "ex_dividend_date": "2026-06-15",
                "dividend_amount": "0.25",
                "currency": "USD"
            }
        ]
        result = import_ex_dividend_screenshots(
            db_session, screenshots_data, "/data/test.png", "assistant_zhou"
        )
        spot_check_id = result["spot_check_ids"][0]

        spot_check, msg = update_spot_check_field(
            db_session, spot_check_id,
            field_name="institution_name_from_screenshot",
            new_value="摩根大通",
            operator="assistant_zhou",
            change_reason="测试修改"
        )

        history = get_change_history_diff(db_session, spot_check_id)
        update_changes = [
            c for c in history["changes"]
            if c["action"] == "update" and c["field"] == "institution_name_from_screenshot"
        ]
        assert len(update_changes) >= 1
        cmd = update_changes[-1]["rollback_command"]
        assert "rollback" in cmd
        assert "--change-id" in cmd
        assert "--operator" in cmd
        assert "--spot-check-id" not in cmd
        assert "--field" not in cmd
        assert "--value" not in cmd


class TestBoundaryRules:
    """测试边界规则"""

    def test_name_consistency_rules(self, db_session):
        """测试机构名称一致性判定规则"""
        add_institution_alias(
            db_session, "摩根大通银行", "摩根大通", "admin"
        )

        # 规则1: 空值判定
        is_consistent, hint = check_institution_name_consistency(
            db_session, None, "摩根大通"
        )
        assert is_consistent is False
        assert "为空" in hint

        # 规则2: 精确匹配（不区分大小写）
        is_consistent, hint = check_institution_name_consistency(
            db_session, "JPMorgan", "jpmorgan"
        )
        assert is_consistent is True
        assert "精确匹配" in hint

        # 规则3: 别名映射匹配
        is_consistent, hint = check_institution_name_consistency(
            db_session, "摩根大通银行", "摩根大通"
        )
        assert is_consistent is True
        assert "别名映射" in hint

        # 规则4: 相似度判定
        is_consistent, hint = check_institution_name_consistency(
            db_session, "摩根大通银行", "摩根大通银"
        )
        assert is_consistent is False
        assert "相似度" in hint
        assert "留待财务复核" in hint

    def test_visualization_jump_to_source(self, db_session):
        """测试3D/图表展示时点击不一致可回溯源材料"""
        screenshots_data = [
            {
                "institution_name": "摩根大通银行",
                "ex_dividend_date": "2026-06-15",
                "dividend_amount": "0.25",
                "currency": "USD"
            }
        ]
        result = import_ex_dividend_screenshots(
            db_session, screenshots_data,
            "/data/screenshots_20260603.png",
            "assistant_zhou"
        )
        spot_check_id = result["spot_check_ids"][0]

        remark_data = {
            "institution_name": "摩根大通",
            "remark_content": "跨境汇款税率10%",
            "tax_rate": "10%",
            "source_file": "/data/tax_remark.pdf"
        }
        add_tax_rate_remark(db_session, spot_check_id, remark_data, "assistant_zhou")

        # 获取可视化跳转信息
        source_info = get_source_material_for_visualization(
            db_session, spot_check_id
        )

        # 不能只剩漂亮画面，要有原始材料信息
        assert source_info["screenshot"] is not None
        assert source_info["screenshot"]["source_file"] == "/data/screenshots_20260603.png"
        assert source_info["remark"] is not None
        assert source_info["remark"]["remark_content"] == "跨境汇款税率10%"

        # 不一致时给出跳转建议
        assert "jump_recommendation" in source_info
        assert source_info["jump_recommendation"]["action"] == "navigate_to_source"
        assert "点击查看原始" in source_info["jump_recommendation"]["hint"]


class TestAuditAndRerun:
    """测试审计复盘和可重跑命令"""

    def test_audit_log_and_rerun_commands(self, db_session):
        """测试生成可复盘记录和可重跑命令"""
        screenshots_data = [
            {
                "institution_name": "摩根大通银行",
                "ex_dividend_date": "2026-06-15",
                "dividend_amount": "0.25",
                "currency": "USD"
            }
        ]

        # 执行三步流程
        result = import_ex_dividend_screenshots(
            db_session, screenshots_data, "/data/test.png", "assistant_zhou"
        )
        spot_check_id = result["spot_check_ids"][0]

        remark_data = {
            "institution_name": "摩根大通银行",
            "remark_content": "跨境汇款税率10%",
            "tax_rate": "10%"
        }
        add_tax_rate_remark(db_session, spot_check_id, remark_data, "assistant_zhou")

        update_data = {"check_result": "合规"}
        update_spot_check_record(
            db_session, spot_check_id, update_data, "assistant_zhou"
        )

        # 审计日志记录了所有操作
        audit_logs = db_session.query(AuditLog).order_by(AuditLog.created_at.asc()).all()
        assert len(audit_logs) >= 3

        operations = [log.operation for log in audit_logs]
        assert "import_ex_dividend_screenshots" in operations
        assert "add_tax_rate_remark" in operations
        assert "update_spot_check_record" in operations

        # 每条日志都有可重跑命令
        for log in audit_logs:
            assert log.rerun_command is not None
            assert "python -m" in log.rerun_command

        # 获取可重跑命令清单
        commands = get_rerun_commands(db_session, spot_check_id)
        assert len(commands) >= 3

        # 最后给人的是可重新跑的命令，不是功能清单
        for cmd in commands:
            assert "command" in cmd
            assert "description" in cmd
            assert "step" in cmd

    def test_rerun_command_format_matches_cli(self, db_session):
        """测试审计日志中的重跑命令与真实CLI参数一致"""
        screenshots_data = [
            {
                "institution_name": "摩根大通银行",
                "ex_dividend_date": "2026-06-15",
                "dividend_amount": "0.25",
                "currency": "USD"
            }
        ]
        result = import_ex_dividend_screenshots(
            db_session, screenshots_data, "/data/test.png", "assistant_zhou",
            data_file="test_data/screenshots_20260603.json"
        )
        spot_check_id = result["spot_check_ids"][0]

        remark_data = {
            "institution_name": "摩根大通银行",
            "remark_content": "跨境汇款税率10%",
            "tax_rate": "10%"
        }
        add_tax_rate_remark(db_session, spot_check_id, remark_data, "assistant_zhou")

        update_data = {"check_result": "合规"}
        update_spot_check_record(
            db_session, spot_check_id, update_data, "assistant_zhou"
        )

        audit_logs = db_session.query(AuditLog).order_by(AuditLog.created_at.asc()).all()

        import_log = next(l for l in audit_logs if l.operation == "import_ex_dividend_screenshots")
        assert "import-screenshots" in import_log.rerun_command
        assert "--source-file" in import_log.rerun_command
        assert "--data-file 'test_data/screenshots_20260603.json'" in import_log.rerun_command
        assert "--operator" in import_log.rerun_command
        assert "DATA_FILE" not in import_log.rerun_command
        assert import_log.parameters["data_file"] == "test_data/screenshots_20260603.json"

        remark_log = next(l for l in audit_logs if l.operation == "add_tax_rate_remark")
        assert "add-remark" in remark_log.rerun_command
        assert "--spot-check-id" in remark_log.rerun_command
        assert "--institution-name" in remark_log.rerun_command
        assert "--remark-content" in remark_log.rerun_command
        assert "--operator" in remark_log.rerun_command

        update_log = next(l for l in audit_logs if l.operation == "update_spot_check_record")
        assert "update-record" in update_log.rerun_command
        assert "--spot-check-id" in update_log.rerun_command
        assert "--check-result" in update_log.rerun_command
        assert "--operator" in update_log.rerun_command
        assert "--update-data" not in update_log.rerun_command


class TestSpotCheckDetail:
    """测试抽检记录完整详情"""

    def test_complete_detail_view(self, db_session):
        """测试获取抽检记录完整详情"""
        screenshots_data = [
            {
                "institution_name": "摩根大通银行",
                "ex_dividend_date": "2026-06-15",
                "dividend_amount": "0.25",
                "currency": "USD"
            }
        ]
        result = import_ex_dividend_screenshots(
            db_session, screenshots_data, "/data/test.png", "assistant_zhou"
        )
        spot_check_id = result["spot_check_ids"][0]

        remark_data = {
            "institution_name": "摩根大通",
            "remark_content": "跨境汇款税率10%",
            "tax_rate": "10%",
            "source_file": "/data/tax.pdf"
        }
        add_tax_rate_remark(db_session, spot_check_id, remark_data, "assistant_zhou")

        detail = get_spot_check_detail(db_session, spot_check_id)

        assert detail["id"] == spot_check_id
        assert detail["check_no"].startswith("CBC-")
        assert detail["status"] == "review_required"
        assert "change_history" in detail
        assert "source_materials" in detail
        assert "review_tasks" in detail
        assert len(detail["review_tasks"]) == 1
        assert detail["review_tasks"][0]["status"] == "pending"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
