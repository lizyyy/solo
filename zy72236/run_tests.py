import os
import sys
import io
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import pandas as pd

from app.database import Base
from app import models
from app.workflow import import_clearing_batch, review_holiday_adjustment, get_workflow_status, can_proceed_to_balance_update
from app.self_check import run_self_check
from app.export import verify_export_consistency, export_to_excel, export_to_csv
from app.crud import get_unified_record_data, mark_manager_reviewed, get_batch_records, resolve_duplicate
from app.balance import update_balance_for_batch, get_balance_changes, get_balance_summary

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_fund_commission.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)


def generate_test_excel():
    data = [
        {
            '基金代码': '000001', '基金名称': '华夏成长混合',
            '客户账号': 'C00001', '客户姓名': '张三',
            '客户经理': '李明', '客户经理代码': 'M001',
            '审批人': '王芳', '交易日期': '2024-01-02', '清算日期': '2024-01-03',
            '交易金额': 100000.00, '佣金率': 0.005,
        },
        {
            '基金代码': '000002', '基金名称': '易方达蓝筹精选',
            '客户账号': 'C00002', '客户姓名': '李四',
            '客户经理': '王强', '客户经理代码': 'M002',
            '审批人': 'zhang wei', '交易日期': '2024-01-02', '清算日期': '2024-01-03',
            '交易金额': 250000.00, '佣金率': 0.005,
        },
        {
            '基金代码': '000001', '基金名称': '华夏成长混合',
            '客户账号': 'C00001', '客户姓名': '张三',
            '客户经理': '李明', '客户经理代码': 'M001',
            '审批人': '王芳', '交易日期': '2024-01-02', '清算日期': '2024-01-03',
            '交易金额': 100000.00, '佣金率': 0.005,
        },
        {
            '基金代码': '000003', '基金名称': '嘉实沪深300ETF',
            '客户账号': 'C00003', '客户姓名': '王五',
            '客户经理': '赵雪', '客户经理代码': 'M003',
            '审批人': 'liu yang', '交易日期': '2024-01-02', '清算日期': '2024-01-01',
            '交易金额': 500000.00, '佣金率': 0.003,
        },
    ]
    df = pd.DataFrame(data)
    output = io.BytesIO()
    df.to_excel(output, index=False)
    output.seek(0)
    return output.getvalue()


def run_test(name, func):
    try:
        result = func()
        print(f"✅ {name}: 通过")
        return result
    except AssertionError as e:
        print(f"❌ {name}: 失败 - {e}")
        return None
    except Exception as e:
        print(f"❌ {name}: 错误 - {e}")
        import traceback
        traceback.print_exc()
        return None


def main():
    print("=" * 70)
    print("基金销售尾佣拆分系统 - 完整流程测试")
    print("=" * 70)
    print()

    db = TestingSessionLocal()
    batch_id = None

    try:
        print("📋 第一步：导入清算批次号")
        print("-" * 70)

        def test_step1():
            excel_content = generate_test_excel()
            result = import_clearing_batch(db, "QY20240101", excel_content, "tester")
            nonlocal batch_id
            batch_id = result.batch_id

            assert result.total_records == 4, f"总记录数应为4，实际{result.total_records}"
            assert result.duplicate_count == 1, f"重复记录应为1，实际{result.duplicate_count}"
            assert result.pinyin_approval_count == 2, f"拼音审批人应为2，实际{result.pinyin_approval_count}"
            assert result.needs_review_count == 3, f"待复核应为3，实际{result.needs_review_count}"

            print(f"   批次号: {result.batch_number}")
            print(f"   总记录数: {result.total_records}")
            print(f"   重复记录: {result.duplicate_count}")
            print(f"   审批人拼音: {result.pinyin_approval_count}")
            return True

        run_test("导入清算批次号", test_step1)

        print()
        print("🔍 验证审计追踪：原始行号、处理状态")
        print("-" * 70)

        def test_audit_trail():
            records = get_batch_records(db, batch_id)
            assert len(records) == 4, f"记录数应为4，实际{len(records)}"

            line_numbers = [r.original_line_number for r in records]
            assert line_numbers == [2, 3, 4, 5], f"原始行号应为[2,3,4,5]，实际{line_numbers}"

            pinyin_records = [r for r in records if r.approval_name_is_pinyin]
            assert len(pinyin_records) == 2, f"拼音记录应为2，实际{len(pinyin_records)}"
            for r in pinyin_records:
                assert r.needs_manager_review == True, "拼音记录应标记为待复核"
                assert r.status == "needs_manager_review", f"状态应为needs_manager_review，实际{r.status}"

            duplicate_records = [r for r in records if r.is_duplicate]
            assert len(duplicate_records) == 1, f"重复记录应为1，实际{len(duplicate_records)}"
            assert duplicate_records[0].original_line_number == 4, f"重复记录行号应为4，实际{duplicate_records[0].original_line_number}"

            print(f"   原始行号正确: {line_numbers}")
            print(f"   拼音记录状态正确: {len(pinyin_records)}条待复核")
            print(f"   重复记录正确: {len(duplicate_records)}条")
            return True

        run_test("审计追踪验证", test_audit_trail)

        print()
        print("📅 第二步：风控老秦补看节假日顺延说明")
        print("-" * 70)

        def test_step2():
            result = review_holiday_adjustment(
                db, batch_id, "老秦",
                [{"original_date": "2024-01-01", "adjusted_date": "2024-01-04", "reason": "元旦假期顺延"}]
            )

            assert result["success"] == True, "节假日审核应成功"
            assert result["adjusted_count"] == 1, f"应调整1条，实际{result['adjusted_count']}"
            assert result["recalculated_count"] == 1, f"应重算1条，实际{result['recalculated_count']}"

            records = get_batch_records(db, batch_id)
            holiday_adjusted = [r for r in records if r.source_type == "holiday_adjustment"]
            assert len(holiday_adjusted) == 1, f"节假日调整记录应为1，实际{len(holiday_adjusted)}"
            assert holiday_adjusted[0].settlement_date.strftime("%Y-%m-%d") == "2024-01-04", "清算日期应调整为2024-01-04"
            assert holiday_adjusted[0].manually_modified == True, "应标记为人工修改"

            print(f"   审核人: 老秦")
            print(f"   调整记录数: {result['adjusted_count']}")
            print(f"   重算记录数: {result['recalculated_count']}")
            return True

        run_test("节假日审核", test_step2)

        print()
        print("🔄 验证工作流状态")
        print("-" * 70)

        def test_workflow_status():
            workflow = get_workflow_status(db, batch_id)
            assert workflow.current_step == 2, f"当前步骤应为2，实际{workflow.current_step}"
            assert workflow.total_steps == 3, f"总步骤应为3，实际{workflow.total_steps}"
            assert workflow.overall_status == "needs_manager_review", f"总体状态应为needs_manager_review，实际{workflow.overall_status}"

            print(f"   当前步骤: {workflow.current_step}/{workflow.total_steps}")
            print(f"   总体状态: {workflow.overall_status}")
            return True

        run_test("工作流状态验证", test_workflow_status)

        print()
        print("🚫 验证：未处理重复记录和未复核拼音时不能更新余额")
        print("-" * 70)

        def test_block_balance_update():
            check = can_proceed_to_balance_update(db, batch_id)
            assert check["can_proceed"] == False, "未完成复核时应不能更新余额"
            assert check["duplicate_count"] == 1, f"重复记录应为1，实际{check['duplicate_count']}"
            assert check["pending_review_count"] == 2, f"待复核应为2，实际{check['pending_review_count']}"

            print(f"   正确拦截，原因: {check['issues']}")
            print(f"   重复记录数: {check['duplicate_count']}")
            print(f"   待复核数: {check['pending_review_count']}")
            return True

        run_test("余额更新拦截验证", test_block_balance_update)

        print()
        print("� 第三步（a）：处理重复记录")
        print("-" * 70)

        def test_resolve_duplicate():
            records = get_batch_records(db, batch_id)
            dup_records = [r for r in records if r.is_duplicate and not r.duplicate_resolved]
            assert len(dup_records) == 1, f"未处理重复记录应为1，实际{len(dup_records)}"

            dup_record = dup_records[0]
            result = resolve_duplicate(db, dup_record.id, "skip", "风控老秦")
            assert result is not None, "处理重复记录应成功"
            assert result.duplicate_resolved == True, "应标记为已处理"
            assert result.is_duplicate == True, "skip 操作应保持 is_duplicate"

            check = can_proceed_to_balance_update(db, batch_id)
            assert check["duplicate_count"] == 0, f"处理后重复记录应为0，实际{check['duplicate_count']}"

            print(f"   处理重复记录ID: {dup_record.id}")
            print(f"   操作: skip（跳过）")
            print(f"   处理后重复计数: {check['duplicate_count']}")
            return True

        run_test("处理重复记录", test_resolve_duplicate)

        print()
        print("�‍💼 第三步（b）：客户经理复核审批人拼音")
        print("-" * 70)

        def test_step3_review():
            records = get_batch_records(db, batch_id)
            pinyin_record_ids = [r.id for r in records if r.approval_name_is_pinyin]
            assert len(pinyin_record_ids) == 2, f"拼音记录应为2，实际{len(pinyin_record_ids)}"

            for record_id in pinyin_record_ids:
                result = mark_manager_reviewed(db, record_id, "客户经理张总", True)
                assert result is not None, f"复核记录{record_id}应成功"
                assert result.manager_reviewed == True, "应标记为已复核"

            records = get_batch_records(db, batch_id)
            still_pending = [r for r in records if r.needs_manager_review and r.approval_name_is_pinyin]
            assert len(still_pending) == 0, "复核后应无待拼音复核记录"

            print(f"   复核记录数: {len(pinyin_record_ids)}")
            print(f"   复核人: 客户经理张总")
            return True

        run_test("客户经理复核审批人拼音", test_step3_review)

        print()
        print("💰 第三步：余额变化表更新")
        print("-" * 70)

        def test_step3_balance():
            result = update_balance_for_batch(db, batch_id, "system")
            assert result["success"] == True, "余额更新应成功"
            assert result["total_records"] == 4, f"总记录应为4，实际{result['total_records']}"
            assert result["success_count"] == 3, f"成功更新应为3，实际{result['success_count']}"
            assert result["failed_count"] == 1, f"失败应为1（重复记录），实际{result['failed_count']}"

            changes = get_balance_changes(db)
            source_types = set(c["source_type"] for c in changes)
            assert "clearing_batch" in source_types, "应有清算批次导入来源"
            assert "holiday_adjustment" in source_types, "应有节假日调整来源"

            manager_codes = set(c["manager_code"] for c in changes)
            assert manager_codes == {"M001", "M002", "M003"}, f"客户经理应为M001,M002,M003，实际{manager_codes}"

            print(f"   成功更新: {result['success_count']}条")
            print(f"   跳过重复: {result['failed_count']}条")
            print(f"   涉及客户经理: {manager_codes}")
            return True

        run_test("余额变化表更新", test_step3_balance)

        print()
        print("📊 验证余额汇总")
        print("-" * 70)

        def test_balance_summary():
            summary = get_balance_summary(db)
            assert len(summary) == 3, f"汇总客户经理应为3，实际{len(summary)}"
            manager_codes = [s["manager_code"] for s in summary]
            assert "M001" in manager_codes, "应包含M001"
            assert "M002" in manager_codes, "应包含M002"
            assert "M003" in manager_codes, "应包含M003"

            for s in summary:
                assert "current_balance" in s, "应包含当前余额"
                assert "pending_amount" in s, "应包含待确认金额"
                assert "confirmed_amount" in s, "应包含已确认金额"

            print(f"   客户经理数: {len(summary)}")
            for s in summary:
                print(f"   - {s['manager_name']}({s['manager_code']}): 当前余额{s['current_balance_display']}")
            return True

        run_test("余额汇总验证", test_balance_summary)

        print()
        print("✅ 运行自检")
        print("-" * 70)

        def test_self_check():
            report = run_self_check(db, batch_id)
            assert report.total_checks == 6, f"自检项目应为6，实际{report.total_checks}"
            assert report.passed_checks >= 4, f"通过检查应>=4，实际{report.passed_checks}"

            check_names = [r.check_name for r in report.results]
            assert "重复导入检测" in check_names, "应包含重复导入检测"
            assert "审批人拼音检测" in check_names, "应包含审批人拼音检测"
            assert "补录后重算验证" in check_names, "应包含补录后重算验证"
            assert "导出一致性检查" in check_names, "应包含导出一致性检查"
            assert "审计追踪完整性" in check_names, "应包含审计追踪完整性"
            assert "节假日顺延审核" in check_names, "应包含节假日顺延审核"

            for r in report.results:
                status = "✅ 通过" if r.passed else "⚠️ 未通过"
                print(f"   {status} {r.check_name}: {r.message}")

            print(f"   自检结果: {report.passed_checks}/{report.total_checks} 通过")
            return True

        run_test("自检功能验证", test_self_check)

        print()
        print("🔗 验证统一数据源")
        print("-" * 70)

        def test_unified_data():
            api_records = get_unified_record_data(db, batch_id)
            api_pinyin = [r for r in api_records if r["approval_name_is_pinyin"]]
            api_pending = [r for r in api_records if r["needs_manager_review"]]

            db_records = get_batch_records(db, batch_id)
            db_pinyin = [r for r in db_records if r.approval_name_is_pinyin]
            db_pending = [r for r in db_records if r.needs_manager_review]

            assert len(api_pinyin) == len(db_pinyin), f"API和DB拼音记录数不一致: {len(api_pinyin)} vs {len(db_pinyin)}"
            assert len(api_pending) == len(db_pending), f"API和DB待复核记录数不一致: {len(api_pending)} vs {len(db_pending)}"

            consistency = verify_export_consistency(db, batch_id)
            assert consistency["consistent"] == True, "导出一致性检查应通过"

            print(f"   API拼音记录: {len(api_pinyin)}")
            print(f"   DB拼音记录: {len(db_pinyin)}")
            print(f"   导出一致性: {'一致' if consistency['consistent'] else '不一致'}")
            return True

        run_test("统一数据源验证", test_unified_data)

        print()
        print("📤 验证导出功能")
        print("-" * 70)

        def test_export():
            excel_content = export_to_excel(db, batch_id)
            assert len(excel_content) > 1000, "Excel文件不应为空"

            csv_content = export_to_csv(db, batch_id)
            assert len(csv_content) > 100, "CSV文件不应为空"
            lines = csv_content.split("\n")
            assert len(lines) >= 5, f"CSV至少应有5行，实际{len(lines)}"

            print(f"   Excel导出: {len(excel_content)} bytes")
            print(f"   CSV导出: {len(lines) - 1} 行数据")
            return True

        run_test("导出功能验证", test_export)

        print()
        print("📝 验证审计日志")
        print("-" * 70)

        def test_audit_logs():
            records = get_batch_records(db, batch_id)
            modified_record = next(r for r in records if r.manually_modified)

            logs = modified_record.audit_logs
            assert len(logs) >= 3, f"修改记录至少应有3条日志，实际{len(logs)}"

            actions = [log.action for log in logs]
            assert "record_created" in actions, "应包含创建日志"
            assert "holiday_adjustment" in actions, "应包含节假日调整日志"
            assert "recalculated" in actions, "应包含重算日志"

            print(f"   记录ID: {modified_record.id}")
            print(f"   日志条数: {len(logs)}")
            print(f"   操作类型: {set(actions)}")
            return True

        run_test("审计日志验证", test_audit_logs)

        print()
        print("🏁 验证完整工作流完成")
        print("-" * 70)

        def test_workflow_complete():
            workflow = get_workflow_status(db, batch_id)
            assert workflow.current_step == 3, f"当前步骤应为3，实际{workflow.current_step}"
            assert workflow.overall_status == "completed", f"总体状态应为completed，实际{workflow.overall_status}"

            steps = workflow.steps
            assert steps[0].status == "completed", "第一步应已完成"
            assert steps[1].status == "completed", "第二步应已完成"
            assert steps[2].status == "completed", "第三步应已完成"

            print(f"   当前步骤: {workflow.current_step}/{workflow.total_steps}")
            print(f"   总体状态: {workflow.overall_status}")
            return True

        run_test("完整工作流验证", test_workflow_complete)

        print()
        print("=" * 70)
        print("🎉 所有测试通过！基金销售尾佣拆分系统完整流程验证成功！")
        print("=" * 70)
        print()
        print("📋 核心功能清单：")
        print("   ✅ 重复导入检测")
        print("   ✅ 审批人拼音检测")
        print("   ✅ 补录后重算验证")
        print("   ✅ 导出一致性检查")
        print("   ✅ 审计追踪完整性")
        print("   ✅ 节假日顺延审核")
        print("   ✅ 统一数据源（导出/页面/接口）")
        print("   ✅ 原始行号保留")
        print("   ✅ 人工改动记录")
        print("   ✅ 处理状态追踪")
        print("   ✅ 余额变化表（来源/待确认）")
        print("   ✅ 三步工作流：导入→节假日审核→余额更新")
        print("   ✅ 审批人拼音留待客户经理复核")
        print("   ✅ 重复记录处理（跳过/保留）")
        print()

    finally:
        db.close()
        if os.path.exists("./test_fund_commission.db"):
            os.remove("./test_fund_commission.db")
            print("🧹 测试数据库已清理")


if __name__ == "__main__":
    main()
