#!/usr/bin/env python3
import sys
import os
import time
from datetime import datetime
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, init_db
from models import PipelineTask, WriteSummary
from schemas import PipelineTaskCreate, PipelineTaskUpdate, WriteSummaryCreate, ResumeCommandCreate, TaskStatus
from service import PipelineService


class colors:
    OK = '\033[92m'
    FAIL = '\033[91m'
    WARN = '\033[93m'
    ENDC = '\033[0m'


def print_result(test_name, passed, details=""):
    status = f"{colors.OK}PASS{colors.ENDC}" if passed else f"{colors.FAIL}FAIL{colors.ENDC}"
    print(f"[{status}] {test_name}")
    if details and not passed:
        print(f"      {colors.WARN}{details}{colors.ENDC}")


def run_selftest():
    print("=" * 60)
    print("断点续跑水位保护API - 自检脚本")
    print("=" * 60)

    if os.path.exists("./pipeline_watermark.db"):
        os.remove("./pipeline_watermark.db")

    init_db()
    db = SessionLocal()
    service = PipelineService(db)

    all_passed = True

    print("\n--- 测试1: 创建管道任务 ---")
    try:
        task1 = PipelineTaskCreate(
            pipeline_name="nightly_user_data",
            shard_start=0,
            shard_end=1000,
            watermark=1000
        )
        task, error = service.create_task(task1)
        passed = task is not None and error is None
        print_result("创建任务1", passed, error)
        all_passed = all_passed and passed

        task2 = PipelineTaskCreate(
            pipeline_name="nightly_user_data",
            shard_start=1001,
            shard_end=2000,
            watermark=2000
        )
        task, error = service.create_task(task2)
        passed = task is not None and error is None
        print_result("创建任务2", passed, error)
        all_passed = all_passed and passed
        
        task2_id = task.id
    except Exception as e:
        print_result("创建任务", False, str(e))
        all_passed = False

    print("\n--- 测试2: 分片去重校验 ---")
    try:
        update = PipelineTaskUpdate(status=TaskStatus.RUNNING)
        service.update_task_status(task2_id, update)
        
        task_overlap = PipelineTaskCreate(
            pipeline_name="nightly_user_data",
            shard_start=500,
            shard_end=1500,
            watermark=1500
        )
        task, error = service.create_task(task_overlap)
        passed = task is None and "overlap" in error
        print_result("分片重叠检测", passed, error)
        all_passed = all_passed and passed
    except Exception as e:
        print_result("分片重叠检测", False, str(e))
        all_passed = False

    print("\n--- 测试3: 状态流转 - 标记失败触发人工复核 ---")
    try:
        tasks = service.get_pending_tasks("nightly_user_data")
        task_id = tasks[0].id

        for i in range(3):
            update = PipelineTaskUpdate(
                status=TaskStatus.FAILED,
                fail_reason=f"Network error attempt {i+1}"
            )
            task, error = service.update_task_status(task_id, update)

        task = service.get_task(task_id)
        passed = task.need_manual_review == True and task.retry_count == 3
        print_result("失败3次触发人工复核", passed, f"review={task.need_manual_review}, retry={task.retry_count}")
        all_passed = all_passed and passed
    except Exception as e:
        print_result("人工复核触发", False, str(e))
        all_passed = False

    print("\n--- 测试4: 错误码区分 - 缺字段/状态不允许 ---")
    try:
        update = PipelineTaskUpdate(status=TaskStatus.RUNNING)
        task, error = service.update_task_status(task_id, update)
        passed = "manual review" in error
        print_result("未复核任务无法执行", passed, error)
        all_passed = all_passed and passed

        update = PipelineTaskUpdate(
            status=TaskStatus.RUNNING,
            review_comment="已复核通过"
        )
        task, error = service.update_task_status(task_id, update)
        passed = task is not None and error is None
        print_result("复核后可执行", passed, error)
        all_passed = all_passed and passed
    except Exception as e:
        print_result("人工复核流程", False, str(e))
        all_passed = False

    print("\n--- 测试5: 水位校验 - 不能倒退 ---")
    try:
        update = PipelineTaskUpdate(
            status=TaskStatus.RUNNING,
            need_manual_review=False,
            review_comment="已复核"
        )
        task, error = service.update_task_status(task_id, update)
        
        update = PipelineTaskUpdate(watermark=500)
        task, error = service.update_task_status(task_id, update)
        passed = "Watermark cannot go backward" in error
        print_result("水位倒退检测", passed, error)
        all_passed = all_passed and passed

        update = PipelineTaskUpdate(watermark=1500)
        task, error = service.update_task_status(task_id, update)
        passed = task is not None and task.watermark == 1500
        print_result("水位前进正常", passed, f"watermark={task.watermark if task else None}")
        all_passed = all_passed and passed
        
        update = PipelineTaskUpdate(status=TaskStatus.FAILED, fail_reason="准备续跑测试")
        service.update_task_status(task_id, update)
    except Exception as e:
        print_result("水位校验", False, str(e))
        all_passed = False

    print("\n--- 测试6: 续跑指令 ---")
    try:
        service.update_task_status(task_id, PipelineTaskUpdate(
            need_manual_review=False,
            review_comment="强制续跑前复核"
        ))
        
        cmd = ResumeCommandCreate(
            pipeline_name="nightly_user_data",
            target_watermark=3000,
            force=True,
            created_by="oncall_duty"
        )
        tasks, error = service.execute_resume_command(cmd)
        passed = len(tasks) > 0 and all(t.status == TaskStatus.PENDING for t in tasks)
        print_result("续跑重置待处理", passed, f"tasks={len(tasks)}, first_status={tasks[0].status if tasks else None}")
        all_passed = all_passed and passed
    except Exception as e:
        print_result("续跑指令", False, str(e))
        all_passed = False

    print("\n--- 测试7: 写入摘要导入 ---")
    try:
        service.update_task_status(task2_id, PipelineTaskUpdate(status=TaskStatus.FAILED))
        tasks = service.get_pending_tasks("nightly_user_data")

        summaries_data = [
            {"task_id": tasks[0].id, "write_count": 950, "update_count": 50, "skip_count": 0, "error_count": 0, "data_size_bytes": 1024000},
            {"task_id": tasks[1].id, "write_count": 800, "update_count": 200, "skip_count": 0, "error_count": 0, "data_size_bytes": 2048000},
        ]

        created_summaries = []
        for i, data in enumerate(summaries_data):
            summary_create = WriteSummaryCreate(
                pipeline_name="nightly_user_data",
                shard_start=i*1000,
                shard_end=(i+1)*1000,
                start_time=datetime.utcnow(),
                end_time=datetime.utcnow(),
                **data
            )
            summary = service.create_write_summary(summary_create)
            created_summaries.append(summary)

        passed = len(created_summaries) == 2
        print_result("写入摘要创建", passed, f"count={len(created_summaries)}")
        all_passed = all_passed and passed

        summaries = service.get_write_summaries("nightly_user_data")
        passed = len(summaries) == 2
        print_result("写入摘要查询", passed, f"count={len(summaries)}")
        all_passed = all_passed and passed
    except Exception as e:
        print_result("写入摘要导入", False, str(e))
        all_passed = False

    print("\n--- 测试8: 写入摘要导出 ---")
    try:
        filename, result = service.export_summaries_to_csv("nightly_user_data")
        passed = filename != "" and result["export_count"] == 2
        details = f"file={filename}, writes={result['total_writes']}, updates={result['total_updates']}"
        print_result("CSV导出摘要", passed, details)
        all_passed = all_passed and passed

        if "content" in result:
            print(f"\n导出CSV内容预览:")
            lines = result["content"].split("\n")[:3]
            for line in lines:
                print(f"  {line}")
    except Exception as e:
        print_result("写入摘要导出", False, str(e))
        all_passed = False

    print("\n--- 测试9: 待处理任务筛选 ---")
    try:
        tasks = service.get_pending_tasks("nightly_user_data", min_watermark=1500)
        passed = len(tasks) >= 1
        print_result("按水位筛选待处理", passed, f"found={len(tasks)}")
        all_passed = all_passed and passed
    except Exception as e:
        print_result("任务筛选", False, str(e))
        all_passed = False

    print("\n--- 测试10: 已成功任务无法修改 ---")
    try:
        tasks = service.get_pending_tasks("nightly_user_data")
        task_id = tasks[0].id

        update = PipelineTaskUpdate(status=TaskStatus.SUCCESS)
        task, error = service.update_task_status(task_id, update)

        update = PipelineTaskUpdate(status=TaskStatus.RUNNING)
        task, error = service.update_task_status(task_id, update)
        passed = "already completed" in error
        print_result("已成功任务保护", passed, error)
        all_passed = all_passed and passed
    except Exception as e:
        print_result("已完成任务保护", False, str(e))
        all_passed = False

    db.close()

    print("\n" + "=" * 60)
    if all_passed:
        print(f"{colors.OK}所有测试通过！系统正常运行！{colors.ENDC}")
    else:
        print(f"{colors.FAIL}部分测试失败，请检查代码！{colors.ENDC}")
    print("=" * 60)

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(run_selftest())
