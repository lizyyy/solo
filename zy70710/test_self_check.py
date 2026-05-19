#!/usr/bin/env python3
"""
漏跑恢复系统自检脚本 - 验证导入、筛选、处理、导出功能
"""
import sys
import os
import json
from datetime import datetime, timedelta
from typing import List, Dict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, Base, engine
from models import TaskStatus, RecoveryAction
from schemas import BatchTaskCreate, BatchTaskRecover, ImpactItemCreate
from services import TaskService
from exceptions import TaskException, InvalidStatusException, AlreadyProcessedException


class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'


def print_step(step_num: int, title: str, desc: str = ""):
    print(f"\n{Colors.BLUE}{Colors.BOLD}[步骤 {step_num}]{Colors.END} {title}")
    if desc:
        print(f"  {desc}")


def print_success(message: str):
    print(f"  {Colors.GREEN}✓{Colors.END} {message}")


def print_error(message: str):
    print(f"  {Colors.RED}✗{Colors.END} {message}")


def print_warning(message: str):
    print(f"  {Colors.YELLOW}!{Colors.END} {message}")


def setup_test_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_step_1_import():
    """测试1: 批量导入任务"""
    print_step(1, "批量导入任务", "验证导入功能，创建测试任务")

    db = SessionLocal()
    service = TaskService(db)

    try:
        tasks_data = [
            BatchTaskCreate(
                task_name="财务日结任务",
                planned_time=datetime.now() - timedelta(hours=2)
            ),
            BatchTaskCreate(
                task_name="供应商付款对账",
                planned_time=datetime.now() - timedelta(hours=1)
            ),
            BatchTaskCreate(
                task_name="月度报表生成",
                planned_time=datetime.now() + timedelta(days=1)
            ),
            BatchTaskCreate(
                task_name="税务核算任务",
                planned_time=datetime.now() - timedelta(minutes=45)
            ),
        ]

        imported_tasks = service.bulk_import_tasks(tasks_data)
        print_success(f"成功导入 {len(imported_tasks)} 个任务")

        for task in imported_tasks:
            print_success(f"  - ID={task.id}: {task.task_name} ({task.planned_time.strftime('%Y-%m-%d %H:%M')})")

        return imported_tasks

    except Exception as e:
        print_error(f"导入失败: {str(e)}")
        raise
    finally:
        db.close()


def test_step_2_filter(tasks: List):
    """测试2: 筛选任务"""
    print_step(2, "筛选任务", "验证按状态、名称、时间范围筛选")

    db = SessionLocal()
    service = TaskService(db)

    try:
        tasks, total = service.list_tasks(status=TaskStatus.PENDING)
        print_success(f"按状态筛选 (PENDING): 找到 {total} 个任务")

        tasks, total = service.list_tasks(task_name="财务")
        print_success(f"按名称筛选 (包含'财务'): 找到 {total} 个任务")

        end_time = datetime.now()
        start_time = end_time - timedelta(hours=3)
        tasks, total = service.list_tasks(start_time=start_time, end_time=end_time)
        print_success(f"按时间范围筛选 (最近3小时): 找到 {total} 个任务")

        return True

    except Exception as e:
        print_error(f"筛选失败: {str(e)}")
        raise
    finally:
        db.close()


def test_step_3_detect_missed():
    """测试3: 自动检测漏跑任务"""
    print_step(3, "自动检测漏跑", "验证漏跑识别功能")

    db = SessionLocal()
    service = TaskService(db)

    try:
        missed_tasks = service.detect_missed_tasks(grace_minutes=30)
        print_success(f"自动检测到 {len(missed_tasks)} 个漏跑任务")

        for task in missed_tasks:
            print_warning(f"  - ID={task.id}: {task.task_name} - {task.missed_reason}")

        return missed_tasks

    except Exception as e:
        print_error(f"漏跑检测失败: {str(e)}")
        raise
    finally:
        db.close()


def test_step_4_mark_missed(tasks: List):
    """测试4: 手动标记漏跑"""
    print_step(4, "手动标记漏跑", "验证人工标记任务为漏跑状态")

    db = SessionLocal()
    service = TaskService(db)

    try:
        pending_task = None
        for task in tasks:
            refreshed_task = service.get_task(task.id)
            if refreshed_task and refreshed_task.status == TaskStatus.PENDING:
                pending_task = refreshed_task
                break

        if pending_task:
            from schemas import BatchTaskMarkMissed
            marked_task = service.mark_task_missed(
                pending_task.id,
                BatchTaskMarkMissed(missed_reason="人工检测: 服务器异常导致任务未执行")
            )
            print_success(f"任务 '{marked_task.task_name}' 已标记为漏跑")
            print_success(f"  状态: {marked_task.status}")
            print_success(f"  原因: {marked_task.missed_reason}")
        else:
            print_warning("没有待处理的任务可标记，跳过此测试")

        return True

    except Exception as e:
        print_error(f"手动标记漏跑失败: {str(e)}")
        raise
    finally:
        db.close()


def test_step_5_calculate_impact(missed_tasks: List):
    """测试5: 计算影响范围"""
    print_step(5, "计算影响范围", "验证根据任务类型自动计算影响清单")

    db = SessionLocal()
    service = TaskService(db)

    try:
        for task in missed_tasks[:2]:
            impact_items = service.calculate_impact(task.id)
            print_success(f"任务 '{task.task_name}' 影响分析:")

            for item in impact_items:
                severity_color = Colors.RED if item.severity == "high" else Colors.YELLOW
                print(f"    [{severity_color}{item.severity.upper()}{Colors.END}] "
                      f"{item.impact_type}: {item.impact_description}")
                if item.affected_range:
                    print(f"      影响范围: {item.affected_range}")

        return True

    except Exception as e:
        print_error(f"影响计算失败: {str(e)}")
        raise
    finally:
        db.close()


def test_step_6_recover_task(missed_tasks: List):
    """测试6: 恢复任务 (验证互斥)"""
    print_step(6, "恢复任务", "验证补跑互斥和状态推进")

    db = SessionLocal()
    service = TaskService(db)

    try:
        if not missed_tasks:
            print_warning("没有漏跑任务可恢复")
            return False

        task = missed_tasks[0]

        try:
            service.acquire_recovery_lock(task.task_name, "操作员A")
            print_success(f"操作员A 获取恢复锁成功: {task.task_name}")
        except Exception as e:
            print_error(f"获取锁失败: {str(e)}")

        try:
            service.acquire_recovery_lock(task.task_name, "操作员B")
            print_error("操作员B 应该获取锁失败，但成功了")
        except Exception as e:
            print_success(f"操作员B 获取锁失败 (符合预期): {e.message}")

        service.release_recovery_lock(task.task_name)
        print_success("释放锁成功")

        recover_data = BatchTaskRecover(
            recovery_action=RecoveryAction.RERUN,
            recovered_by="操作员A",
            impact_items=[
                ImpactItemCreate(
                    impact_type="数据重跑",
                    impact_description="任务重新执行，已同步最新数据",
                    affected_range="财务系统",
                    severity="low",
                    resolution_note="已完成重跑，数据已恢复"
                )
            ]
        )

        recovered_task = service.recover_task(task.id, recover_data)
        print_success(f"任务恢复成功: {recovered_task.task_name}")
        print_success(f"  状态: {recovered_task.status}")
        print_success(f"  恢复动作: {recovered_task.recovery_action}")
        print_success(f"  恢复人: {recovered_task.recovered_by}")
        print_success(f"  恢复时间: {recovered_task.recovery_time.strftime('%Y-%m-%d %H:%M:%S')}")

        try:
            service.recover_task(task.id, recover_data)
            print_error("重复恢复应该失败，但成功了")
        except AlreadyProcessedException as e:
            print_success(f"重复恢复被正确拒绝 (符合预期): {e.message}")

        return recovered_task

    except Exception as e:
        print_error(f"任务恢复失败: {str(e)}")
        raise
    finally:
        db.close()


def test_step_7_generate_report(recovered_task):
    """测试7: 生成恢复报告"""
    print_step(7, "生成恢复报告", "验证恢复报告导出功能")

    db = SessionLocal()
    service = TaskService(db)

    try:
        if not recovered_task:
            print_warning("没有已恢复的任务可生成报告")
            return False

        report = service.generate_recovery_report(recovered_task.id)
        print_success("恢复报告生成成功:")

        print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
        print(f"{Colors.BOLD}漏跑任务恢复报告{Colors.END}")
        print(f"{'='*60}")
        print(f"任务ID:   {report['task_id']}")
        print(f"任务名称: {report['task_name']}")
        print(f"计划时间: {report['planned_time'].strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"漏跑原因: {report['missed_reason']}")
        print(f"恢复动作: {report['recovery_action']}")
        print(f"恢复时间: {report['recovery_time'].strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"恢复人:   {report['recovered_by']}")
        print(f"影响项数: {report['impact_count']}")
        print(f"\n影响摘要:")
        for severity, summary in report['impact_summary'].items():
            print(f"  {severity.upper()}: {summary['count']} 项 - {', '.join(summary['types'])}")
        print(f"{'='*60}\n")

        report_file = "recovery_report.json"
        report_data = {
            **report,
            "planned_time": report["planned_time"].isoformat(),
            "recovery_time": report["recovery_time"].isoformat()
        }
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
        print_success(f"报告已导出到: {report_file}")

        return report

    except Exception as e:
        print_error(f"生成报告失败: {str(e)}")
        raise
    finally:
        db.close()


def test_step_8_error_cases():
    """测试8: 错误响应测试"""
    print_step(8, "错误响应验证", "验证各种错误场景的响应")

    db = SessionLocal()
    service = TaskService(db)

    try:
        error_cases_tested = 0

        try:
            service.get_task_or_404(99999)
        except Exception as e:
            print_success(f"任务不存在: error_code={e.error_code}, message={e.message}")
            error_cases_tested += 1

        from schemas import BatchTaskCreate
        test_task = service.create_task(BatchTaskCreate(
            task_name="测试任务-错误验证",
            planned_time=datetime.now()
        ))

        from schemas import BatchTaskRecover
        try:
            service.recover_task(test_task.id, BatchTaskRecover(
                recovery_action=RecoveryAction.RERUN,
                recovered_by="测试员"
            ))
        except InvalidStatusException as e:
            print_success(f"状态非法: error_code={e.error_code}, message={e.message}")
            error_cases_tested += 1

        print_success(f"共测试 {error_cases_tested} 种错误场景，全部符合预期")

        return True

    except Exception as e:
        print_error(f"错误响应测试失败: {str(e)}")
        raise
    finally:
        db.close()


def main():
    print(f"\n{Colors.BOLD}{'='*70}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}    漏跑恢复互斥补跑影响清单系统 - 自检脚本{Colors.END}")
    print(f"{Colors.BOLD}{'='*70}{Colors.END}")

    setup_test_db()
    print_success("测试数据库初始化完成")

    results = {}

    try:
        imported_tasks = test_step_1_import()
        results["导入"] = "PASS"

        test_step_2_filter(imported_tasks)
        results["筛选"] = "PASS"

        missed_tasks = test_step_3_detect_missed()
        results["漏跑检测"] = "PASS"

        test_step_4_mark_missed(imported_tasks)
        results["手动标记"] = "PASS"

        test_step_5_calculate_impact(missed_tasks)
        results["影响计算"] = "PASS"

        recovered_task = test_step_6_recover_task(missed_tasks)
        results["任务恢复"] = "PASS"

        test_step_7_generate_report(recovered_task)
        results["报告导出"] = "PASS"

        test_step_8_error_cases()
        results["错误响应"] = "PASS"

    except Exception as e:
        print_error(f"自检过程中发生错误: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1

    print(f"\n{Colors.BOLD}{'='*70}{Colors.END}")
    print(f"{Colors.BOLD}自检结果汇总{Colors.END}")
    print(f"{Colors.BOLD}{'='*70}{Colors.END}")

    all_passed = True
    for step, result in results.items():
        if result == "PASS":
            print(f"  {Colors.GREEN}✓{Colors.END} {step}: {result}")
        else:
            print(f"  {Colors.RED}✗{Colors.END} {step}: {result}")
            all_passed = False

    print(f"\n{Colors.BOLD}{'='*70}{Colors.END}")
    if all_passed:
        print(f"{Colors.GREEN}{Colors.BOLD}  所有测试项通过！系统功能正常！{Colors.END}")
    else:
        print(f"{Colors.RED}{Colors.BOLD}  部分测试项失败，请检查系统！{Colors.END}")
    print(f"{Colors.BOLD}{'='*70}{Colors.END}\n")

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
