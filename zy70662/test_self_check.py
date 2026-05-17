#!/usr/bin/env python3
"""
比赛成绩申诉处理系统自检验证脚本
测试: 数据导入、筛选、处理、导出
"""

import os
import sys
import json
import time
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
import models
import schemas
from services import ScoreService, AppealService, PenaltyService, ReportService
from exceptions import (
    NotFoundException,
    InvalidStatusException,
    AlreadyProcessedException,
    ManualReviewRequiredException,
    ValidationException
)


def color_print(text, color="white"):
    colors = {
        "red": "\033[91m",
        "green": "\033[92m",
        "yellow": "\033[93m",
        "blue": "\033[94m",
        "white": "\033[97m",
        "reset": "\033[0m"
    }
    print(f"{colors.get(color, colors['white'])}{text}{colors['reset']}")


class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.tests = []

    def add_test(self, name, success, message=""):
        self.tests.append({"name": name, "success": success, "message": message})
        if success:
            self.passed += 1
            color_print(f"  ✓ {name}: {message}", "green")
        else:
            self.failed += 1
            color_print(f"  ✗ {name}: {message}", "red")

    def summary(self):
        print("\n" + "=" * 60)
        color_print("测试结果汇总", "blue")
        print("=" * 60)
        color_print(f"通过: {self.passed}", "green")
        color_print(f"失败: {self.failed}", "red")
        print(f"总计: {self.passed + self.failed}")

        if self.failed > 0:
            color_print("\n失败的测试:", "red")
            for test in self.tests:
                if not test["success"]:
                    color_print(f"  - {test['name']}: {test['message']}", "red")

        return self.failed == 0


def setup_test_database():
    color_print("\n[1/5] 初始化测试数据库...", "blue")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    return SessionLocal()


def test_data_import(db: Session, result: TestResult):
    color_print("\n[2/5] 测试数据导入...", "blue")

    try:
        group1 = models.AgeGroup(name="成年组", description="18岁以上", min_age=18, max_age=99)
        group2 = models.AgeGroup(name="青年组", description="14-17岁", min_age=14, max_age=17)
        db.add_all([group1, group2])
        db.flush()
        result.add_test("创建组别", True, f"创建了2个组别")
    except Exception as e:
        result.add_test("创建组别", False, str(e))
        return

    try:
        participants_data = [
            {"bib_number": "A001", "name": "张三", "age": 25, "age_group_id": 1},
            {"bib_number": "A002", "name": "李四", "age": 28, "age_group_id": 1},
            {"bib_number": "A003", "name": "王五", "age": 22, "age_group_id": 1},
            {"bib_number": "B001", "name": "赵六", "age": 16, "age_group_id": 2},
            {"bib_number": "B002", "name": "钱七", "age": 15, "age_group_id": 2},
        ]

        for p_data in participants_data:
            p = models.Participant(**p_data)
            db.add(p)
        db.flush()
        result.add_test("导入选手", True, f"导入了{len(participants_data)}名选手")
    except Exception as e:
        result.add_test("导入选手", False, str(e))

    try:
        time_records_data = [
            (1, "start", 0.0),
            (1, "cp1", 600.0),
            (1, "finish", 1800.0),
            (2, "start", 0.0),
            (2, "cp1", 620.0),
            (2, "finish", 1850.0),
            (3, "start", 0.0),
            (3, "cp1", 590.0),
            (3, "finish", 1780.0),
            (4, "start", 0.0),
            (4, "cp1", 650.0),
            (4, "finish", 1900.0),
            (5, "start", 0.0),
            (5, "cp1", 640.0),
            (5, "finish", 1880.0),
        ]

        for p_id, checkpoint, time_sec in time_records_data:
            tr = models.TimeRecord(
                participant_id=p_id,
                checkpoint=checkpoint,
                time_seconds=time_sec,
                is_valid=True
            )
            db.add(tr)
        db.flush()
        result.add_test("导入计时记录", True, f"导入了{len(time_records_data)}条计时记录")
    except Exception as e:
        result.add_test("导入计时记录", False, str(e))

    try:
        penalties_data = [
            (1, "抢跑", 5.0, "起步抢跑警告"),
            (2, "切道", 10.0, "弯道违规切道"),
        ]

        for p_id, p_type, time_sec, desc in penalties_data:
            penalty = models.Penalty(
                participant_id=p_id,
                penalty_type=p_type,
                time_penalty_seconds=time_sec,
                description=desc,
                applied=True
            )
            db.add(penalty)
        db.flush()
        result.add_test("导入处罚记录", True, f"导入了{len(penalties_data)}条处罚记录")
    except Exception as e:
        result.add_test("导入处罚记录", False, str(e))

    db.commit()


def test_data_filtering(db: Session, result: TestResult):
    color_print("\n[3/5] 测试数据筛选...", "blue")

    try:
        group1_participants = db.query(models.Participant).filter(
            models.Participant.age_group_id == 1
        ).all()
        success = len(group1_participants) == 3
        result.add_test(
            "按组别筛选选手",
            success,
            f"成年组有{len(group1_participants)}名选手" if success else f"期望3名，实际{len(group1_participants)}名"
        )
    except Exception as e:
        result.add_test("按组别筛选选手", False, str(e))

    try:
        participant1_times = db.query(models.TimeRecord).filter(
            models.TimeRecord.participant_id == 1
        ).all()
        success = len(participant1_times) == 3
        result.add_test(
            "按选手筛选计时记录",
            success,
            f"选手1有{len(participant1_times)}条记录" if success else f"期望3条，实际{len(participant1_times)}条"
        )
    except Exception as e:
        result.add_test("按选手筛选计时记录", False, str(e))

    try:
        applied_penalties = db.query(models.Penalty).filter(
            models.Penalty.applied == True
        ).all()
        success = len(applied_penalties) == 2
        result.add_test(
            "筛选已生效处罚",
            success,
            f"有{len(applied_penalties)}条已生效处罚"
        )
    except Exception as e:
        result.add_test("筛选已生效处罚", False, str(e))


def test_score_processing(db: Session, result: TestResult):
    color_print("\n[4/5] 测试成绩处理...", "blue")

    try:
        scores = ScoreService.recalculate_scores(db, apply_penalties=True)
        success = len(scores) == 5
        result.add_test(
            "重算所有成绩",
            success,
            f"计算了{len(scores)}名选手的成绩"
        )
    except Exception as e:
        result.add_test("重算所有成绩", False, str(e))
        return

    try:
        score1 = db.query(models.Score).filter(models.Score.participant_id == 1).first()
        expected_final = 1800.0 + 5.0
        success = abs(score1.final_time_seconds - expected_final) < 0.01
        result.add_test(
            "验证处罚扣减",
            success,
            f"选手1最终成绩: {score1.final_time_seconds}s (原始1800s + 处罚5s)"
        )
    except Exception as e:
        result.add_test("验证处罚扣减", False, str(e))

    try:
        ScoreService.update_ranks(db)
        score3 = db.query(models.Score).filter(models.Score.participant_id == 3).first()
        success = score3.overall_rank == 1
        result.add_test(
            "验证总排名",
            success,
            f"选手3(无处罚1780s)总排名第{score3.overall_rank}"
        )
    except Exception as e:
        result.add_test("验证总排名", False, str(e))

    try:
        score4 = db.query(models.Score).filter(models.Score.participant_id == 4).first()
        success = score4.group_rank == 2
        result.add_test(
            "验证组别排名",
            success,
            f"选手4(青年组)组别排名第{score4.group_rank}"
        )
    except Exception as e:
        result.add_test("验证组别排名", False, str(e))

    db.commit()


def test_appeal_processing(db: Session, result: TestResult):
    color_print("\n  测试申诉处理流程...", "yellow")

    try:
        appeal_data = schemas.AppealCreate(
            appeal_number="APL-2024-001",
            participant_id=1,
            reason="对抢跑处罚有异议，录像显示起步正常"
        )
        appeal = AppealService.create_appeal(db, appeal_data)
        result.add_test(
            "创建申诉",
            appeal is not None,
            f"申诉编号: {appeal.appeal_number}, 状态: {appeal.status}"
        )
    except Exception as e:
        result.add_test("创建申诉", False, str(e))
        return

    try:
        score_with_appeal = db.query(models.Score).filter(
            models.Score.participant_id == 1
        ).first()
        result.add_test(
            "申诉标记",
            score_with_appeal.has_appeal == True,
            "选手成绩已标记为有申诉"
        )
    except Exception as e:
        result.add_test("申诉标记", False, str(e))

    try:
        review_data = schemas.AppealReview(
            status="reviewed",
            decision="penalty_removed",
            decision_notes="经录像复核，确认无抢跑行为，撤销处罚",
            reviewer="主裁判"
        )
        appeal = AppealService.review_appeal(db, appeal.id, review_data)
        result.add_test(
            "审核申诉",
            appeal.decision == "penalty_removed",
            f"申诉审核完成，决定: {appeal.decision}"
        )
    except Exception as e:
        result.add_test("审核申诉", False, str(e))

    try:
        process_result = AppealService.process_appeal_decision(db, appeal.id)
        result.add_test(
            "执行申诉决定",
            "Scores recalculated" in str(process_result["actions_taken"]),
            f"执行了{len(process_result['actions_taken'])}项操作"
        )
    except Exception as e:
        result.add_test("执行申诉决定", False, str(e))

    try:
        score1_after = db.query(models.Score).filter(models.Score.participant_id == 1).first()
        success = abs(score1_after.final_time_seconds - 1800.0) < 0.01
        result.add_test(
            "验证申诉后成绩",
            success,
            f"申诉后选手1成绩: {score1_after.final_time_seconds}s (处罚已移除)"
        )
    except Exception as e:
        result.add_test("验证申诉后成绩", False, str(e))

    db.commit()


def test_report_export(db: Session, result: TestResult):
    color_print("\n[5/5] 测试报告导出...", "blue")

    appeal = db.query(models.Appeal).first()
    if not appeal:
        result.add_test("生成复核报告", False, "没有申诉记录")
        return

    try:
        report_content = ReportService.generate_review_report(
            db, appeal.id, include_raw_data=True
        )
        report = ReportService.save_report(
            db, appeal.id, report_content, "自检验证", "json"
        )
        result.add_test(
            "生成复核报告",
            report is not None,
            f"报告ID: {report.id}, 生成者: {report.generated_by}"
        )
    except Exception as e:
        result.add_test("生成复核报告", False, str(e))
        return

    try:
        json_export = ReportService.export_report(db, report.id, format="json")
        success = "appeal_info" in json_export and "participant_info" in json_export
        result.add_test(
            "导出JSON格式",
            success,
            "JSON格式导出成功，包含申诉和选手信息"
        )
    except Exception as e:
        result.add_test("导出JSON格式", False, str(e))

    try:
        text_export = ReportService.export_report(db, report.id, format="text")
        success = "APPEAL REVIEW REPORT" in text_export and "=" * 60 in text_export
        result.add_test(
            "导出文本格式",
            success,
            "文本格式导出成功，包含报告标题和分隔线"
        )
    except Exception as e:
        result.add_test("导出文本格式", False, str(e))

    db.commit()


def test_error_handling(db: Session, result: TestResult):
    color_print("\n[附加] 测试错误处理...", "blue")

    try:
        appeal_data = schemas.AppealCreate(
            appeal_number="APL-2024-001",
            participant_id=1,
            reason="重复申诉测试"
        )
        AppealService.create_appeal(db, appeal_data)
        result.add_test("重复申诉检测", False, "应该抛出AlreadyProcessedException")
    except AlreadyProcessedException as e:
        result.add_test("重复申诉检测", True, f"正确抛出已处理异常: {e.message[:30]}...")
    except Exception as e:
        result.add_test("重复申诉检测", False, f"错误的异常类型: {type(e).__name__}")

    try:
        AppealService.process_appeal_decision(db, 99999)
        result.add_test("不存在申诉检测", False, "应该抛出NotFoundException")
    except NotFoundException as e:
        result.add_test("不存在申诉检测", True, "正确抛出未找到异常")
    except Exception as e:
        result.add_test("不存在申诉检测", False, f"错误的异常类型: {type(e).__name__}")

    try:
        appeal_data2 = schemas.AppealCreate(
            appeal_number="APL-2024-002",
            participant_id=2,
            reason="需要人工复核的申诉"
        )
        appeal2 = AppealService.create_appeal(db, appeal_data2)

        review_data2 = schemas.AppealReview(
            status="reviewed",
            decision="requires_manual_review",
            decision_notes="情况复杂，需要首席裁判官复核",
            reviewer="副裁判"
        )
        AppealService.review_appeal(db, appeal2.id, review_data2)
        AppealService.process_appeal_decision(db, appeal2.id)
        result.add_test("人工复核触发", False, "应该抛出ManualReviewRequiredException")
    except ManualReviewRequiredException as e:
        result.add_test("人工复核触发", True, "正确触发人工复核流程")
    except Exception as e:
        result.add_test("人工复核触发", False, f"错误的异常类型: {type(e).__name__}: {str(e)[:50]}")

    db.rollback()


def main():
    color_print("=" * 60, "blue")
    color_print("比赛成绩申诉处理系统 - 自检验证脚本", "blue")
    color_print("=" * 60, "blue")

    result = TestResult()

    try:
        db = setup_test_database()
        test_data_import(db, result)
        test_data_filtering(db, result)
        test_score_processing(db, result)
        test_appeal_processing(db, result)
        test_report_export(db, result)
        test_error_handling(db, result)
        db.close()

        success = result.summary()

        if success:
            color_print("\n✓ 所有测试通过！系统功能正常。", "green")
            return 0
        else:
            color_print("\n✗ 部分测试失败，请检查代码。", "red")
            return 1

    except Exception as e:
        color_print(f"\n严重错误: {str(e)}", "red")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
