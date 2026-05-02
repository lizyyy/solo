import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Database
from importer import DataImporter
from state_machine import SlideStateMachine, RuleEngine
from reporter import ReportGenerator
from models import SlideStatus


class DemoRunner:
    def __init__(self, db_path=":memory:"):
        self.db = Database(db_path)
        self.importer = DataImporter(self.db)
        self.state_machine = SlideStateMachine(self.db)
        self.rule_engine = RuleEngine(self.db)
        self.reporter = ReportGenerator(self.db)

    def run_full_demo(self):
        print("=" * 60)
        print("病理科切片管理系统 - 演示流程")
        print("=" * 60)

        base_path = os.path.dirname(os.path.abspath(__file__))
        slides_csv = os.path.join(base_path, "samples", "slides.csv")
        borrows_json = os.path.join(base_path, "samples", "borrows.json")
        rules_json = os.path.join(base_path, "samples", "department_rules.json")

        print("\n[步骤 1] 导入切片台账")
        print("-" * 40)
        slides, slide_result = self.importer.import_slide_csv(slides_csv)
        if slide_result.is_valid:
            inserted, updated = self.db.insert_slides(slides)
            print(f"✓ 切片导入成功: 新增 {inserted} 条, 更新 {updated} 条")
        else:
            print(f"✗ 导入失败: {[str(e) for e in slide_result.errors]}")

        print(f"\n[步骤 2] 导入科室规则")
        print("-" * 40)
        rules, rules_result = self.importer.import_rules_json(rules_json)
        if rules_result.is_valid:
            inserted, updated = self.db.insert_department_rules(rules)
            print(f"✓ 规则导入成功: 新增 {inserted} 条, 更新 {updated} 条")
            for rule in rules:
                print(f"  - {rule.department}: 最多借 {rule.max_borrow_days} 天, 同时最多 {rule.max_concurrent_borrows} 份")

        print(f"\n[步骤 3] 导入借阅申请")
        print("-" * 40)
        records, borrows_result = self.importer.import_borrow_json(borrows_json)
        if borrows_result.warnings:
            print(f"⚠ 验证警告: {borrows_result.warnings}")

        success = 0
        failed = 0
        for record in records:
            ok, msg, _ = self.state_machine.execute_borrow(
                slide_id=record.slide_id,
                borrower_name=record.borrower_name,
                borrower_dept=record.borrower_dept,
                borrow_date=record.borrow_date,
                expected_return_date=record.expected_return_date,
                notes=record.notes,
                record_id=record.record_id
            )
            if ok:
                success += 1
            else:
                failed += 1
                print(f"  ✗ {record.record_id}: {msg}")

        print(f"✓ 借阅处理: 成功 {success} 条, 失败 {failed} 条")

        print(f"\n[步骤 4] 处理部分归还")
        print("-" * 40)
        return_tests = [
            ("B001", "2024-02-08", False, "按时归还"),
            ("B003", "2024-02-10", True, "逾期3天归还"),
            ("B005", "2024-02-05", True, "逾期归还（数据中已记录）"),
        ]

        for record_id, return_date, is_overdue, desc in return_tests:
            ok, msg = self.state_machine.execute_return(
                record_id=record_id,
                actual_return_date=return_date,
                confirmed_by="系统管理员"
            )
            status = "✓" if ok else "✗"
            print(f"  {status} {record_id} - {desc}: {msg}")

        print(f"\n[步骤 5] 边界测试 - 重复借阅")
        print("-" * 40)
        ok, msg, _ = self.state_machine.execute_borrow(
            slide_id="SL002",
            borrower_name="测试医生",
            borrower_dept="肿瘤科",
            record_id="TEST_DUPLICATE"
        )
        if not ok:
            print(f"✓ 正确拦截重复借阅: {msg}")
        else:
            print(f"✗ 应该拒绝重复借阅")

        print(f"\n[步骤 6] 边界测试 - 归还早于借出")
        print("-" * 40)
        ok, msg = self.state_machine.execute_return(
            record_id="B002",
            actual_return_date="2024-01-01",
            confirmed_by="测试"
        )
        if not ok:
            print(f"✓ 正确拦截非法归还日期: {msg}")
        else:
            print(f"✗ 应该拒绝归还早于借出的日期")

        print(f"\n[步骤 7] 逾期检查")
        print("-" * 40)
        updated = self.rule_engine.update_overdue_status()
        print(f"更新了 {updated} 条逾期记录")

        overdue_list = self.rule_engine.check_overdue_slides()
        if overdue_list:
            print(f"当前逾期记录: {len(overdue_list)} 条")
            for item in overdue_list[:3]:
                print(f"  - {item['slide_id']}: {item['borrower_name']} 逾期 {item['overdue_days']} 天")
        else:
            print("暂无逾期记录")

        print(f"\n[步骤 8] 批量归还演示")
        print("-" * 40)
        ok, msg, record = self.state_machine.execute_borrow(
            slide_id="SL008",
            borrower_name="批量测试",
            borrower_dept="外科",
            record_id="BATCH_TEST"
        )
        if ok:
            success, failed, errors = self.state_machine.batch_return(
                record_ids=["BATCH_TEST"],
                actual_return_date=datetime.now().strftime("%Y-%m-%d"),
                confirmed_by="批量操作员"
            )
            print(f"✓ 批量归还测试: 成功 {success}, 失败 {failed}")

        print(f"\n[步骤 9] 生成交接报告")
        print("-" * 40)
        returned_records = self.db.get_borrow_records(status=SlideStatus.RETURNED)
        print(f"已归还记录数: {len(returned_records)}")

        md_report = self.reporter.generate_handover_markdown(
            records=returned_records,
            title="2024年2月切片交接报告"
        )
        print("\nMarkdown报告预览 (前30行):")
        print("-" * 40)
        for line in md_report.split('\n')[:30]:
            print(line)

        csv_report = self.reporter.generate_handover_csv(records=returned_records)
        print("\n" + "-" * 40)
        print("CSV报告预览 (前5行):")
        print("-" * 40)
        for line in csv_report.split('\n')[:5]:
            print(line)

        print(f"\n[步骤 10] 统计信息")
        print("-" * 40)
        stats = self.db.get_statistics()
        print(f"切片总数: {stats['total_slides']}")
        print(f"在库: {stats['available']}")
        print(f"已借出: {stats['borrowed']}")
        print(f"逾期: {stats['overdue']}")

        print("\n" + "=" * 60)
        print("演示流程完成！")
        print("=" * 60)

        return md_report


def main():
    demo = DemoRunner()
    demo.run_full_demo()


if __name__ == "__main__":
    main()
