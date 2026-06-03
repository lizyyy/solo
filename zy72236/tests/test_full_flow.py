import os
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import io

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import Base, get_db
from app.main import app
from app import models
from app.self_check import run_self_check
from app.export import verify_export_consistency
from app.crud import get_unified_record_data

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_fund_commission.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


@pytest.fixture(scope="module")
def test_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
    if os.path.exists("./test_fund_commission.db"):
        os.remove("./test_fund_commission.db")


def generate_test_excel():
    import pandas as pd
    data = [
        {
            '基金代码': '000001',
            '基金名称': '华夏成长混合',
            '客户账号': 'C00001',
            '客户姓名': '张三',
            '客户经理': '李明',
            '客户经理代码': 'M001',
            '审批人': '王芳',
            '交易日期': '2024-01-02',
            '清算日期': '2024-01-03',
            '交易金额': 100000.00,
            '佣金率': 0.005,
        },
        {
            '基金代码': '000002',
            '基金名称': '易方达蓝筹精选',
            '客户账号': 'C00002',
            '客户姓名': '李四',
            '客户经理': '王强',
            '客户经理代码': 'M002',
            '审批人': 'zhang wei',
            '交易日期': '2024-01-02',
            '清算日期': '2024-01-03',
            '交易金额': 250000.00,
            '佣金率': 0.005,
        },
        {
            '基金代码': '000001',
            '基金名称': '华夏成长混合',
            '客户账号': 'C00001',
            '客户姓名': '张三',
            '客户经理': '李明',
            '客户经理代码': 'M001',
            '审批人': '王芳',
            '交易日期': '2024-01-02',
            '清算日期': '2024-01-03',
            '交易金额': 100000.00,
            '佣金率': 0.005,
        },
        {
            '基金代码': '000003',
            '基金名称': '嘉实沪深300ETF',
            '客户账号': 'C00003',
            '客户姓名': '王五',
            '客户经理': '赵雪',
            '客户经理代码': 'M003',
            '审批人': 'liu yang',
            '交易日期': '2024-01-02',
            '清算日期': '2024-01-01',
            '交易金额': 500000.00,
            '佣金率': 0.003,
        },
    ]
    df = pd.DataFrame(data)
    output = io.BytesIO()
    df.to_excel(output, index=False)
    output.seek(0)
    return output.getvalue()


class TestFullFlow:
    """测试完整的基金销售尾佣拆分流程"""

    batch_id = None

    def test_step1_import_batch(self, test_db):
        """测试第一步：导入清算批次号"""
        excel_content = generate_test_excel()

        response = client.post(
            "/api/batches/import",
            files={"file": ("test_batch.xlsx", excel_content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"batch_number": "QY20240101", "imported_by": "tester"}
        )

        assert response.status_code == 200
        result = response.json()
        TestFullFlow.batch_id = result["batch_id"]

        assert result["total_records"] == 4
        assert result["duplicate_count"] == 1
        assert result["pinyin_approval_count"] == 2
        assert result["needs_review_count"] == 3

        print(f"✅ 第一步完成：导入批次 {result['batch_number']}")
        print(f"   总记录数: {result['total_records']}")
        print(f"   重复记录: {result['duplicate_count']}")
        print(f"   审批人拼音: {result['pinyin_approval_count']}")

    def test_step1_verify_audit_trail(self, test_db):
        """验证导入后的审计追踪：原始行号、处理状态"""
        response = client.get(f"/api/batches/{TestFullFlow.batch_id}/records")
        assert response.status_code == 200
        data = response.json()

        records = data["records"]
        assert len(records) == 4

        line_numbers = [r["original_line_number"] for r in records]
        assert line_numbers == [2, 3, 4, 5]

        pinyin_records = [r for r in records if r["approval_name_is_pinyin"]]
        assert len(pinyin_records) == 2
        for r in pinyin_records:
            assert r["needs_manager_review"] == True
            assert r["status"] == "needs_manager_review"

        duplicate_records = [r for r in records if r["is_duplicate"]]
        assert len(duplicate_records) == 1
        assert duplicate_records[0]["original_line_number"] == 4

        print(f"✅ 审计追踪验证通过")
        print(f"   原始行号正确: {line_numbers}")
        print(f"   拼音记录状态正确: {len(pinyin_records)}条待复核")
        print(f"   重复记录正确: {len(duplicate_records)}条")

    def test_step2_holiday_review(self, test_db):
        """测试第二步：风控老秦补看节假日顺延说明"""
        response = client.post(
            f"/api/batches/{TestFullFlow.batch_id}/holiday-review",
            json={
                "reviewed_by": "老秦",
                "adjustments": [
                    {
                        "original_date": "2024-01-01",
                        "adjusted_date": "2024-01-04",
                        "reason": "元旦假期顺延"
                    }
                ]
            }
        )

        assert response.status_code == 200
        result = response.json()
        assert result["success"] == True
        assert result["adjusted_count"] == 1
        assert result["recalculated_count"] == 1

        response = client.get(f"/api/batches/{TestFullFlow.batch_id}/records")
        records = response.json()["records"]
        holiday_adjusted = [r for r in records if r["source_type"] == "holiday_adjustment"]
        assert len(holiday_adjusted) == 1
        assert holiday_adjusted[0]["settlement_date"] == "2024-01-04"
        assert holiday_adjusted[0]["manually_modified"] == True

        print(f"✅ 第二步完成：节假日审核")
        print(f"   审核人: 老秦")
        print(f"   调整记录数: {result['adjusted_count']}")
        print(f"   重算记录数: {result['recalculated_count']}")

    def test_step2_workflow_status(self, test_db):
        """验证工作流状态"""
        response = client.get(f"/api/batches/{TestFullFlow.batch_id}/workflow")
        assert response.status_code == 200
        workflow = response.json()

        assert workflow["current_step"] == 2
        assert workflow["total_steps"] == 3
        assert workflow["overall_status"] == "needs_manager_review"

        steps = workflow["steps"]
        assert steps[0]["status"] == "completed"
        assert steps[1]["status"] == "completed"
        assert steps[2]["status"] == "pending"

        print(f"✅ 工作流状态验证通过")
        print(f"   当前步骤: {workflow['current_step']}/{workflow['total_steps']}")
        print(f"   总体状态: {workflow['overall_status']}")

    def test_step3_pinyin_review_before_balance(self, test_db):
        """测试：未完成拼音复核时不能更新余额"""
        response = client.post(f"/api/batches/{TestFullFlow.batch_id}/balance-update")
        assert response.status_code == 400

        result = response.json()
        assert "待客户经理复核" in result["detail"]

        print(f"✅ 余额更新拦截验证通过：未完成复核不能更新余额")

    def test_step3_manager_review_pinyin(self, test_db):
        """测试第三步：客户经理复核审批人拼音"""
        response = client.get(f"/api/batches/{TestFullFlow.batch_id}/records")
        records = response.json()["records"]

        pinyin_record_ids = [r["id"] for r in records if r["approval_name_is_pinyin"]]
        assert len(pinyin_record_ids) == 2

        for idx, record_id in enumerate(pinyin_record_ids):
            response = client.post(
                f"/api/records/{record_id}/manager-review",
                params={"reviewed_by": "客户经理张总", "approved": "true"}
            )
            assert response.status_code == 200
            result = response.json()
            assert result["success"] == True

        response = client.get(f"/api/batches/{TestFullFlow.batch_id}/records")
        records = response.json()["records"]
        still_pending = [r for r in records if r["needs_manager_review"] and r["approval_name_is_pinyin"]]
        assert len(still_pending) == 0

        print(f"✅ 第三步完成：客户经理复核审批人拼音")
        print(f"   复核记录数: {len(pinyin_record_ids)}")
        print(f"   复核人: 客户经理张总")

    def test_step3_balance_update(self, test_db):
        """测试第三步：余额变化表更新"""
        response = client.post(f"/api/batches/{TestFullFlow.batch_id}/balance-update")
        assert response.status_code == 200
        result = response.json()

        assert result["success"] == True
        assert result["total_records"] == 4
        assert result["success_count"] == 3
        assert result["failed_count"] == 1

        response = client.get("/api/balance-changes")
        balance_data = response.json()
        changes = balance_data["changes"]

        source_types = set(c["source_type"] for c in changes)
        assert "clearing_batch" in source_types
        assert "holiday_adjustment" in source_types

        manager_codes = set(c["manager_code"] for c in changes)
        assert manager_codes == {"M001", "M002", "M003"}

        print(f"✅ 第三步完成：余额变化表更新")
        print(f"   成功更新: {result['success_count']}条")
        print(f"   跳过重复: {result['failed_count']}条")
        print(f"   涉及客户经理: {manager_codes}")

    def test_balance_summary(self, test_db):
        """测试余额汇总"""
        response = client.get("/api/balance-summary")
        assert response.status_code == 200
        data = response.json()
        summary = data["summary"]

        assert len(summary) == 3
        manager_codes = [s["manager_code"] for s in summary]
        assert "M001" in manager_codes
        assert "M002" in manager_codes
        assert "M003" in manager_codes

        for s in summary:
            assert "current_balance" in s
            assert "pending_amount" in s
            assert "confirmed_amount" in s

        print(f"✅ 余额汇总验证通过")
        print(f"   客户经理数: {len(summary)}")

    def test_self_check(self, test_db):
        """测试自检功能"""
        report = run_self_check(test_db, TestFullFlow.batch_id)

        assert report.total_checks == 6
        assert report.passed_checks >= 4

        check_names = [r.check_name for r in report.results]
        assert "重复导入检测" in check_names
        assert "审批人拼音检测" in check_names
        assert "补录后重算验证" in check_names
        assert "导出一致性检查" in check_names
        assert "审计追踪完整性" in check_names
        assert "节假日顺延审核" in check_names

        for result in report.results:
            print(f"   {result.check_name}: {'✓ 通过' if result.passed else '✗ 未通过'} - {result.message}")

        print(f"✅ 自检功能验证通过")
        print(f"   通过: {report.passed_checks}/{report.total_checks}")

    def test_unified_data_source(self, test_db):
        """测试统一数据源：导出、页面、接口读同一份结果"""
        api_records = get_unified_record_data(test_db, TestFullFlow.batch_id)

        api_pinyin = [r for r in api_records if r["approval_name_is_pinyin"]]
        api_pending = [r for r in api_records if r["needs_manager_review"]]

        response = client.get(f"/api/batches/{TestFullFlow.batch_id}/records")
        page_records = response.json()["records"]
        page_pinyin = [r for r in page_records if r["approval_name_is_pinyin"]]
        page_pending = [r for r in page_records if r["needs_manager_review"]]

        assert len(api_pinyin) == len(page_pinyin)
        assert len(api_pending) == len(page_pending)

        consistency = verify_export_consistency(test_db, TestFullFlow.batch_id)
        assert consistency["consistent"] == True

        print(f"✅ 统一数据源验证通过")
        print(f"   API拼音记录: {len(api_pinyin)}")
        print(f"   页面拼音记录: {len(page_pinyin)}")
        print(f"   导出一致性: {'一致' if consistency['consistent'] else '不一致'}")

    def test_export_excel(self, test_db):
        """测试Excel导出"""
        response = client.get(f"/api/batches/{TestFullFlow.batch_id}/export/excel")
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        assert "attachment" in response.headers["content-disposition"]
        assert len(response.content) > 1000

        print(f"✅ Excel导出验证通过")
        print(f"   文件大小: {len(response.content)} bytes")

    def test_export_csv(self, test_db):
        """测试CSV导出"""
        response = client.get(f"/api/batches/{TestFullFlow.batch_id}/export/csv")
        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]

        content = response.content.decode("utf-8-sig")
        lines = content.split("\n")
        assert len(lines) >= 5

        print(f"✅ CSV导出验证通过")
        print(f"   数据行数: {len(lines) - 1}")

    def test_audit_logs(self, test_db):
        """测试审计日志"""
        response = client.get(f"/api/batches/{TestFullFlow.batch_id}/audit")
        assert response.status_code == 200
        data = response.json()
        logs = data["audit_logs"]

        assert len(logs) >= 8

        actions = [log["action"] for log in logs]
        assert "batch_created" in actions
        assert "holiday_review_completed" in actions
        assert "holiday_adjustment" in actions
        assert "recalculated" in actions

        print(f"✅ 审计日志验证通过")
        print(f"   日志条数: {len(logs)}")
        print(f"   操作类型: {set(actions)}")

    def test_record_audit_logs(self, test_db):
        """测试单条记录的审计日志"""
        response = client.get(f"/api/batches/{TestFullFlow.batch_id}/records")
        records = response.json()["records"]
        modified_record = next(r for r in records if r["manually_modified"])

        response = client.get(f"/api/records/{modified_record['id']}/audit")
        assert response.status_code == 200
        data = response.json()
        logs = data["audit_logs"]

        assert len(logs) >= 3

        actions = [log["action"] for log in logs]
        assert "record_created" in actions
        assert "holiday_adjustment" in actions
        assert "recalculated" in actions

        print(f"✅ 单条记录审计日志验证通过")
        print(f"   记录ID: {modified_record['id']}")
        print(f"   日志条数: {len(logs)}")
        print(f"   操作类型: {actions}")

    def test_workflow_complete(self, test_db):
        """测试完整工作流完成"""
        response = client.get(f"/api/batches/{TestFullFlow.batch_id}/workflow")
        workflow = response.json()

        assert workflow["current_step"] == 3
        assert workflow["overall_status"] == "completed"

        steps = workflow["steps"]
        assert steps[0]["status"] == "completed"
        assert steps[1]["status"] == "completed"
        assert steps[2]["status"] == "completed"

        print(f"✅ 完整工作流验证通过")
        print(f"   当前步骤: {workflow['current_step']}/{workflow['total_steps']}")
        print(f"   总体状态: {workflow['overall_status']}")
        print("\n" + "=" * 60)
        print("🎉 所有测试通过！基金销售尾佣拆分系统完整流程验证成功！")
        print("=" * 60)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
