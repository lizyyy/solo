#!/usr/bin/env python3
import sys
import os
import json
import tempfile
import shutil
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import engine, Base, SessionLocal
from app.models.models import (
    LogDirectory, MaskingRule, RetainedField, RiskWord,
    RegressionTask, RegressionResult, DiffReport, FailedRecord
)
from app.services.regression_processor import RegressionProcessor
from app.core.constants import TaskStatus, ErrorCode


class SelfTest:
    def __init__(self):
        self.db = SessionLocal()
        self.test_dir = None
        self.passed = 0
        self.failed = 0

    def log(self, message, success=True):
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"[{status}] {message}")
        if success:
            self.passed += 1
        else:
            self.failed += 1

    def setup(self):
        print("\n" + "="*60)
        print("开始设置测试环境...")
        print("="*60)

        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

        self.test_dir = tempfile.mkdtemp(prefix="masking_test_")
        print(f"测试目录: {self.test_dir}")

        test_logs = [
            '2024-01-01 10:00:00 INFO User login: user1@example.com IP: 192.168.1.100',
            '2024-01-01 10:00:01 INFO User login: user2@test.com IP: 10.0.0.1',
            '2024-01-01 10:00:02 ERROR Database connection failed host=db.example.com port=5432',
            '2024-01-01 10:00:03 INFO Order placed: order-12345 amount=99.99',
            '2024-01-01 10:00:04 INFO Phone: 13812345678 Card: 4111-1111-1111-1111',
        ]

        with open(os.path.join(self.test_dir, "app.log"), "w", encoding="utf-8") as f:
            f.write("\n".join(test_logs))

        self.log("测试环境设置完成")

    def test_1_log_directory_import(self):
        print("\n" + "-"*60)
        print("测试 1: 日志目录导入")
        print("-"*60)

        log_dir = LogDirectory(
            name="测试日志目录",
            path=self.test_dir,
            file_pattern="*.log",
            description="测试用日志目录"
        )
        self.db.add(log_dir)
        self.db.commit()

        saved_dir = self.db.query(LogDirectory).filter(LogDirectory.id == log_dir.id).first()
        assert saved_dir is not None, "日志目录保存失败"
        assert saved_dir.path == self.test_dir, "路径不匹配"
        self.log(f"日志目录创建成功, ID: {log_dir.id}")

        from app.services.regression_processor import FileScanner
        files = FileScanner.scan_directory(self.test_dir, "*.log")
        assert len(files) == 1, f"应该找到1个日志文件，实际找到{len(files)}个"
        self.log(f"文件扫描成功，找到 {len(files)} 个文件")

    def test_2_masking_rules(self):
        print("\n" + "-"*60)
        print("测试 2: 脱敏规则管理")
        print("-"*60)

        rules = [
            MaskingRule(
                name="邮箱脱敏",
                pattern=r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
                replacement="***@***.com",
                priority=10
            ),
            MaskingRule(
                name="IP脱敏",
                pattern=r'\b(?:\d{1,3}\.){3}\d{1,3}\b',
                replacement="***.***.***.***",
                priority=9
            ),
            MaskingRule(
                name="手机号脱敏",
                pattern=r'1[3-9]\d{9}',
                replacement="***********",
                priority=8
            ),
            MaskingRule(
                name="银行卡脱敏",
                pattern=r'\b\d{4}-\d{4}-\d{4}-\d{4}\b',
                replacement="****-****-****-****",
                priority=7
            ),
        ]

        for rule in rules:
            self.db.add(rule)
        self.db.commit()

        saved_rules = self.db.query(MaskingRule).all()
        assert len(saved_rules) == 4, f"应该有4条规则，实际有{len(saved_rules)}条"
        self.log(f"创建了 {len(saved_rules)} 条脱敏规则")

        sorted_rules = self.db.query(MaskingRule).order_by(MaskingRule.priority.desc()).all()
        assert sorted_rules[0].priority == 10, "优先级排序错误"
        self.log("规则优先级排序正确")

    def test_3_retained_fields(self):
        print("\n" + "-"*60)
        print("测试 3: 保留字段配置")
        print("-"*60)

        retained = RetainedField(
            field_name="时间戳",
            field_pattern=r'\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}',
            description="日志时间戳应保留"
        )
        self.db.add(retained)
        self.db.commit()

        saved = self.db.query(RetainedField).all()
        assert len(saved) == 1, "保留字段保存失败"
        self.log(f"创建保留字段: {saved[0].field_name}")

    def test_4_risk_words(self):
        print("\n" + "-"*60)
        print("测试 4: 风险词配置")
        print("-"*60)

        risk_words = [
            RiskWord(word="ERROR", severity="high", category="日志级别"),
            RiskWord(word="FAILED", severity="medium", category="操作结果"),
        ]

        for word in risk_words:
            self.db.add(word)
        self.db.commit()

        saved_words = self.db.query(RiskWord).all()
        assert len(saved_words) == 2, "风险词保存失败"
        self.log(f"创建了 {len(saved_words)} 个风险词")

    def test_5_regression_processing(self):
        print("\n" + "-"*60)
        print("测试 5: 回归任务处理")
        print("-"*60)

        log_dir = self.db.query(LogDirectory).first()
        task = RegressionTask(
            name="测试回归任务",
            log_directory_id=log_dir.id,
            created_by="selftest"
        )
        self.db.add(task)
        self.db.commit()

        self.log(f"创建回归任务, ID: {task.id}")

        processor = RegressionProcessor(self.db)
        result = processor.process_task(task.id)

        assert result["success"], f"任务处理失败: {result.get('error')}"
        self.log("任务处理成功")

        updated_task = self.db.query(RegressionTask).filter(RegressionTask.id == task.id).first()
        assert updated_task.status in [TaskStatus.NEED_REVIEW, TaskStatus.COMPLETED], f"任务状态不正确: {updated_task.status}"
        self.log(f"任务状态: {updated_task.status}")

        assert updated_task.total_lines > 0, "没有处理任何行"
        assert updated_task.processed_lines > 0, "没有成功处理任何行"
        self.log(f"处理统计: 总计 {updated_task.total_lines} 行, 成功 {updated_task.processed_lines} 行")

    def test_6_results_and_diffs(self):
        print("\n" + "-"*60)
        print("测试 6: 处理结果与差异报告")
        print("-"*60)

        task = self.db.query(RegressionTask).first()

        results = self.db.query(RegressionResult).filter(RegressionResult.task_id == task.id).all()
        assert len(results) > 0, "没有生成处理结果"
        self.log(f"生成了 {len(results)} 条处理结果")

        sample_result = results[0]
        assert sample_result.masked_content != sample_result.original_content, "内容没有被脱敏"
        self.log("脱敏效果验证: 内容确实发生了变化")

        diffs = self.db.query(DiffReport).filter(DiffReport.task_id == task.id).all()
        self.log(f"检测到 {len(diffs)} 处差异")

        failed = self.db.query(FailedRecord).filter(FailedRecord.task_id == task.id).all()
        self.log(f"失败记录: {len(failed)} 条")

    def test_7_filtering(self):
        print("\n" + "-"*60)
        print("测试 7: 筛选功能")
        print("-"*60)

        task = self.db.query(RegressionTask).first()

        matched_results = self.db.query(RegressionResult).filter(
            RegressionResult.task_id == task.id,
            RegressionResult.is_matched == True
        ).all()
        self.log(f"匹配规则的结果: {len(matched_results)} 条")

        high_severity_diffs = self.db.query(DiffReport).filter(
            DiffReport.task_id == task.id,
            DiffReport.severity == "high"
        ).all()
        self.log(f"高严重程度差异: {len(high_severity_diffs)} 条")

        active_rules = self.db.query(MaskingRule).filter(MaskingRule.is_active == True).all()
        assert len(active_rules) > 0, "没有激活的规则"
        self.log(f"激活的规则: {len(active_rules)} 条")

    def test_8_export(self):
        print("\n" + "-"*60)
        print("测试 8: 导出功能")
        print("-"*60)

        task = self.db.query(RegressionTask).first()

        from app.api.processing import _generate_markdown_report

        export_data = {"tasks": [{
            "task_id": task.id,
            "name": task.name,
            "status": task.status,
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "started_at": task.started_at.isoformat() if task.started_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "statistics": {
                "total_files": task.total_files,
                "total_lines": task.total_lines,
                "processed_lines": task.processed_lines,
                "failed_lines": task.failed_lines,
                "diff_count": task.diff_count,
                "risk_score": task.risk_score
            },
            "differences": [],
            "failed_records": []
        }]}

        md_report = _generate_markdown_report(export_data)
        assert len(md_report) > 0, "Markdown报告生成失败"
        assert "# 脱敏规则回归差异报告" in md_report, "报告格式不正确"
        self.log("Markdown导出功能正常")

        json_str = json.dumps(export_data, indent=2, ensure_ascii=False)
        assert len(json_str) > 0, "JSON导出失败"
        self.log("JSON导出功能正常")

    def test_9_error_responses(self):
        print("\n" + "-"*60)
        print("测试 9: 错误响应场景")
        print("-"*60)

        processor = RegressionProcessor(self.db)

        result = processor.process_task(99999)
        assert not result["success"], "对不存在的任务应该返回错误"
        self.log("对不存在的任务返回正确错误")

        log_dir = self.db.query(LogDirectory).first()
        task = RegressionTask(
            name="已完成任务",
            log_directory_id=log_dir.id,
            status=TaskStatus.COMPLETED
        )
        self.db.add(task)
        self.db.commit()

        result = processor.process_task(task.id)
        assert not result["success"], "对已完成的任务应该返回错误"
        assert result.get("error_code") == "already_processed", "错误码不正确"
        self.log("对已完成任务返回正确错误码: already_processed")

        need_review_task = RegressionTask(
            name="需要人工复核的任务",
            log_directory_id=log_dir.id,
            status=TaskStatus.NEED_REVIEW
        )
        self.db.add(need_review_task)
        self.db.commit()
        
        diff = DiffReport(
            task_id=need_review_task.id,
            diff_type="content_change",
            severity="medium",
            is_reviewed=False
        )
        self.db.add(diff)
        self.db.commit()

        result = processor.process_task(need_review_task.id)
        assert not result["success"], "对需要人工复核的任务应该返回错误"
        assert result.get("error_code") == ErrorCode.NEED_MANUAL_REVIEW, f"错误码不正确, 期望 need_manual_review, 实际 {result.get('error_code')}"
        self.log("对需要人工复核的任务返回正确错误码: need_manual_review")

    def cleanup(self):
        print("\n" + "="*60)
        print("清理测试环境...")
        print("="*60)

        if self.test_dir and os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)
            self.log("测试目录已清理")

        self.db.close()

    def run(self):
        try:
            self.setup()

            self.test_1_log_directory_import()
            self.test_2_masking_rules()
            self.test_3_retained_fields()
            self.test_4_risk_words()
            self.test_5_regression_processing()
            self.test_6_results_and_diffs()
            self.test_7_filtering()
            self.test_8_export()
            self.test_9_error_responses()

        except AssertionError as e:
            self.log(f"断言失败: {e}", success=False)
        except Exception as e:
            self.log(f"异常: {e}", success=False)
            import traceback
            traceback.print_exc()
        finally:
            self.cleanup()

        print("\n" + "="*60)
        print(f"测试结果: 通过 {self.passed}, 失败 {self.failed}")
        print("="*60)

        return self.failed == 0


if __name__ == "__main__":
    tester = SelfTest()
    success = tester.run()
    sys.exit(0 if success else 1)
