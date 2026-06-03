import os
import sys
import tempfile
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["CC_SETTLEMENT_DB"] = "sqlite:///:memory:"

from src.database import init_db, SessionLocal
from src.models import (
    SettlementRecord, SupplementaryRecord, RecordStatus, NextOwner,
    SettlementBatch
)
from src.workflow import (
    import_settlement_batch, add_holiday_note,
    update_supplementary_record, review_by_finance
)
from src.report import generate_html_report, generate_supplementary_csv


@pytest.fixture
def db():
    init_db()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_sample_csv():
    csv_content = """流水号,机构简称,卡号,金额,清算日期,原始机构名
CC20260601001,招商银行,622609******1234,12500.00,2026-06-01,招商银行股份有限公司信用卡中心
CC20260601002,招行,622609******5678,8750.50,2026-06-01,招商银行股份有限公司信用卡中心
CC20260601003,工商银行,621226******9012,32000.00,2026-06-01,中国工商银行股份有限公司
CC20260601004,工行,621226******3456,15600.00,2026-06-01,中国工商银行股份有限公司
CC20260601005,招商银行信用卡中心,622609******7890,9800.00,2026-06-01,招商银行股份有限公司信用卡中心
"""
    f = tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False)
    f.write(csv_content)
    f.close()
    return f.name


class TestE2E:
    def test_step1_import_batch(self, db):
        """第一步：导入清算批次号"""
        csv_path = get_sample_csv()
        result = import_settlement_batch(
            db, csv_path, "BATCH_20260601", "tester", "测试批次"
        )
        os.unlink(csv_path)

        assert result["batch_no"] == "BATCH_20260601"
        assert result["total_records"] == 5
        assert result["inconsistent_count"] == 3
        assert len(result["issues"]) == 3

        serial_nos = [i["serial_no"] for i in result["issues"]]
        assert "CC20260601002" in serial_nos
        assert "CC20260601004" in serial_nos
        assert "CC20260601005" in serial_nos

        batch = db.query(SettlementBatch).first()
        assert batch.batch_no == "BATCH_20260601"
        assert batch.total_records == 5

        print("✅ 第一步通过：批次导入成功，机构简称不一致标记正确")

    def test_step2_inconsistent_records_hold_for_review(self, db):
        """验证不一致记录状态为异常待复核（留给财务）"""
        csv_path = get_sample_csv()
        import_settlement_batch(db, csv_path, "BATCH_20260601", "tester")
        os.unlink(csv_path)

        inconsistent_records = db.query(SettlementRecord).filter(
            SettlementRecord.org_name_consistent == False
        ).all()

        assert len(inconsistent_records) == 3
        for rec in inconsistent_records:
            assert rec.status == RecordStatus.ABNEED_REVIEW
            assert rec.org_name_expected in ["招商银行", "工商银行"]

            supp = rec.supplementary
            assert supp is not None
            assert supp.next_owner == NextOwner.FINANCIAL_REVIEWER
            assert "机构简称" in supp.reason_kept
            assert "不一致" in supp.reason_kept
            assert supp.source_batch_no == "BATCH_20260601"

        consistent_records = db.query(SettlementRecord).filter(
            SettlementRecord.org_name_consistent == True
        ).all()
        assert len(consistent_records) == 2
        for rec in consistent_records:
            assert rec.status == RecordStatus.PENDING_FUND_ACCOUNTING
            supp = rec.supplementary
            assert supp.next_owner == NextOwner.FUND_ACCOUNTING_LIN

        print("✅ 第二步通过：不一致记录留给财务复核人，状态正确")

    def test_step3_add_holiday_note(self, db):
        """第三步：基金会计林姐补录节假日顺延说明"""
        csv_path = get_sample_csv()
        import_settlement_batch(db, csv_path, "BATCH_20260601", "tester")
        os.unlink(csv_path)

        rec_consistent = db.query(SettlementRecord).filter(
            SettlementRecord.serial_no == "CC20260601001"
        ).first()
        rec_inconsistent = db.query(SettlementRecord).filter(
            SettlementRecord.serial_no == "CC20260601002"
        ).first()

        note = "该笔清算日期遇端午节假期，顺延至2026-06-03处理，已与前台确认。"

        result1 = add_holiday_note(db, rec_consistent.id, note, "fund_accounting_lin")
        assert result1["status"] == RecordStatus.PENDING_REVIEW

        result2 = add_holiday_note(db, rec_inconsistent.id, note, "fund_accounting_lin")
        assert result2["status"] == RecordStatus.PENDING_REVIEW

        db.refresh(rec_consistent)
        db.refresh(rec_inconsistent)

        assert rec_consistent.holiday_note is not None
        assert rec_consistent.holiday_note.note == note
        assert rec_inconsistent.holiday_note is not None
        assert rec_inconsistent.holiday_note.note == note

        print("✅ 第三步通过：节假日说明补录成功")

    def test_step4_supplementary_auto_update(self, db):
        """验证补录记录自动更新"""
        csv_path = get_sample_csv()
        import_settlement_batch(db, csv_path, "BATCH_20260601", "tester")
        os.unlink(csv_path)

        rec_inconsistent = db.query(SettlementRecord).filter(
            SettlementRecord.serial_no == "CC20260601002"
        ).first()

        note = "该笔清算日期遇端午节假期，顺延至2026-06-03处理，已与前台确认。"
        add_holiday_note(db, rec_inconsistent.id, note, "fund_accounting_lin")

        db.refresh(rec_inconsistent)
        supp = rec_inconsistent.supplementary

        assert "机构简称仍需财务复核人确认" in supp.reason_kept
        assert "节假日说明已补录" in supp.reason_kept
        assert "待财务复核人确认机构简称差异" in supp.missing_materials
        assert supp.next_owner == NextOwner.FINANCIAL_REVIEWER
        assert "林姐补录节假日说明" in supp.trace_info
        assert supp.updated_by == "fund_accounting_lin"

        rec_consistent = db.query(SettlementRecord).filter(
            SettlementRecord.serial_no == "CC20260601001"
        ).first()
        add_holiday_note(db, rec_consistent.id, note, "fund_accounting_lin")
        db.refresh(rec_consistent)
        supp2 = rec_consistent.supplementary

        assert "节假日顺延说明已补录" in supp2.reason_kept
        assert supp2.missing_materials == "无"
        assert supp2.next_owner == NextOwner.FINANCIAL_REVIEWER
        assert "林姐补录节假日说明" in supp2.trace_info

        print("✅ 第四步通过：补录记录自动更新，字段正确")

    def test_step5_finance_review(self, db):
        """财务复核人复核"""
        csv_path = get_sample_csv()
        import_settlement_batch(db, csv_path, "BATCH_20260601", "tester")
        os.unlink(csv_path)

        rec_inconsistent = db.query(SettlementRecord).filter(
            SettlementRecord.serial_no == "CC20260601002"
        ).first()

        note = "该笔清算日期遇端午节假期，顺延至2026-06-03处理，已与前台确认。"
        add_holiday_note(db, rec_inconsistent.id, note, "fund_accounting_lin")

        result = review_by_finance(
            db, rec_inconsistent.id, True,
            "经核实'招行'确为招商银行简称，予以通过",
            "financial_reviewer"
        )

        assert result["approved"] == True
        assert result["status"] == RecordStatus.REVIEWED

        db.refresh(rec_inconsistent)
        assert rec_inconsistent.status == RecordStatus.REVIEWED
        assert rec_inconsistent.org_name_consistent == True

        supp = rec_inconsistent.supplementary
        assert "财务复核人已确认" in supp.reason_kept
        assert "予以通过" in supp.reason_kept
        assert supp.missing_materials == "无"
        assert supp.next_owner == "已完成"

        print("✅ 第五步通过：财务复核通过，状态流转正确")

    def test_step6_finance_reject(self, db):
        """财务复核人退回"""
        csv_path = get_sample_csv()
        import_settlement_batch(db, csv_path, "BATCH_20260601", "tester")
        os.unlink(csv_path)

        rec_inconsistent = db.query(SettlementRecord).filter(
            SettlementRecord.serial_no == "CC20260601004"
        ).first()

        note = "该笔清算日期遇端午节假期，顺延至2026-06-03处理。"
        add_holiday_note(db, rec_inconsistent.id, note, "fund_accounting_lin")

        result = review_by_finance(
            db, rec_inconsistent.id, False,
            "'工行'简称不规范，请联系业务部门确认标准名称",
            "financial_reviewer"
        )

        assert result["approved"] == False
        assert result["status"] == RecordStatus.PENDING_FUND_ACCOUNTING

        db.refresh(rec_inconsistent)
        supp = rec_inconsistent.supplementary
        assert "财务复核人退回" in supp.reason_kept
        assert "工行" in supp.missing_materials
        assert supp.next_owner == NextOwner.FUND_ACCOUNTING_LIN
        assert "财务复核退回" in supp.trace_info

        print("✅ 第六步通过：财务复核退回，流转至林姐处理")

    def test_step7_generate_report(self, db):
        """生成报告和CSV"""
        csv_path = get_sample_csv()
        import_settlement_batch(db, csv_path, "BATCH_20260601", "tester")
        os.unlink(csv_path)

        for rec_id in [1, 2]:
            add_holiday_note(
                db, rec_id,
                "该笔清算日期遇端午节假期，顺延至2026-06-03处理。",
                "fund_accounting_lin"
            )

        with tempfile.TemporaryDirectory() as tmpdir:
            html_path = os.path.join(tmpdir, "report.html")
            csv_path_out = os.path.join(tmpdir, "supplementary.csv")

            result_html = generate_html_report(db, html_path, "BATCH_20260601")
            result_csv = generate_supplementary_csv(db, csv_path_out, "BATCH_20260601")

            assert os.path.exists(result_html)
            assert os.path.exists(result_csv)

            with open(result_html, encoding="utf-8") as f:
                html_content = f.read()
                assert "信用卡分期提前结清核对报告" in html_content
                assert "机构简称不一致" in html_content
                assert "CC20260601002" in html_content
                assert "招行" in html_content
                assert "查看详情/追溯" in html_content
                assert "回到清算批次号" in html_content
                assert "图表视图" in html_content
                assert "仅看补录记录" in html_content

            with open(result_csv, encoding="utf-8-sig") as f:
                csv_content = f.read()
                assert "流水号" in csv_content
                assert "来源批次号" in csv_content
                assert "留下原因" in csv_content
                assert "缺什么材料" in csv_content
                assert "下一步找谁" in csv_content
                assert "追溯路径" in csv_content
                assert "CC20260601002" in csv_content

        print("✅ 第七步通过：报告和CSV生成正确，含追溯能力")

    def test_full_workflow(self, db):
        """完整三步流程测试"""
        print("\n" + "=" * 60)
        print("🚀 完整三步流程测试")
        print("=" * 60)

        csv_path = get_sample_csv()

        print("\n📥 第一步：导入清算批次号 BATCH_20260601")
        result = import_settlement_batch(
            db, csv_path, "BATCH_20260601", "operator_zhang", "2026年6月测试批次"
        )
        os.unlink(csv_path)
        print(f"   ✅ 导入 {result['total_records']} 条，{result['inconsistent_count']} 条不一致")
        print(f"   ⏳ 不一致记录状态：异常待复核（留给财务复核人）")
        print(f"   ⏳ 一致记录状态：待基金会计处理")

        print("\n👩‍💼 第二步：基金会计林姐补录节假日顺延说明")
        for rec in db.query(SettlementRecord).all():
            note = f"该笔清算日期遇端午节假期，顺延至2026-06-03处理，已核实。"
            add_holiday_note(db, rec.id, note, "fund_accounting_lin")
        print("   ✅ 所有记录节假日说明补录完成")
        print("   ⏳ 状态流转至：待财务复核")

        print("\n📝 第三步：补录记录自动更新")
        for rec in db.query(SettlementRecord).all():
            supp = rec.supplementary
            assert supp is not None
            if not rec.org_name_consistent:
                assert "机构简称仍需财务复核人确认" in supp.reason_kept
                assert "待财务复核人确认机构简称差异" in supp.missing_materials
            else:
                assert "节假日顺延说明已补录" in supp.reason_kept
                assert supp.missing_materials == "无"
            assert supp.next_owner == NextOwner.FINANCIAL_REVIEWER
            assert "林姐补录节假日说明" in supp.trace_info
        print("   ✅ 补录记录已自动同步：")
        print("      - 留下原因：已更新")
        print("      - 缺材料：已更新")
        print("      - 下一步：财务复核人")
        print("      - 追溯路径：完整记录")

        print("\n⏱️  临时会场景验证：")
        with tempfile.TemporaryDirectory() as tmpdir:
            csv_out = os.path.join(tmpdir, "supplementary.csv")
            generate_supplementary_csv(db, csv_out)
            with open(csv_out, encoding="utf-8-sig") as f:
                lines = f.readlines()
                header = lines[0].strip()
                assert "流水号" in header
                assert "来源批次号" in header
                assert "留下原因" in header
                assert "缺什么材料" in header
                assert "下一步找谁" in header
                assert "追溯路径" in header
            print("   ✅ 补录CSV导出成功，财务复核人10分钟会议够用")

        print("\n" + "=" * 60)
        print("✅ 完整流程测试通过！")
        print("   1. 清算批次号导入 ✓")
        print("   2. 机构简称不一致标记（留给财务复核人）✓")
        print("   3. 基金会计林姐补录节假日顺延说明 ✓")
        print("   4. 补录记录自动更新 ✓")
        print("   5. 报告追溯能力 ✓")
        print("   6. 临时会快速查看 ✓")
        print("=" * 60 + "\n")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
