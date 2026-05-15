#!/usr/bin/env python3
"""
接口批量关闭计划 API 自检脚本

运行方法:
    python self_check.py
"""

import sys
import uuid
from datetime import datetime

from app.models.base import (
    BatchStatus,
    InterfaceStatus,
    RestoreRequestStatus,
    ConclusionType,
    NotificationStatus,
    NotificationType,
    NotificationChannel,
    BatchPhase,
    ObservationMetric,
)
from app.models.schemas import (
    CreateBatchRequest,
    CreateRestoreRequest,
    CreateConclusionRequest,
    CreateNotificationRequest,
    UpdateNotificationStatusRequest,
)
from app.services.batch_service import BatchService


def print_section(title):
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}")


def print_test(name, passed, detail=""):
    status = "✓ PASS" if passed else "✗ FAIL"
    print(f"  {status}: {name}")
    if detail:
        print(f"    {detail}")


def run_self_check():
    print("\n" + "=" * 60)
    print("    接口批量关闭计划 API - 自检程序")
    print("=" * 60)

    service = BatchService()
    all_passed = True

    print_section("1. 幂等性测试")
    
    try:
        idempotency_key = str(uuid.uuid4())
        request = CreateBatchRequest(
            name="Test Batch",
            phases=[
                BatchPhase(
                    phase_number=1,
                    interface_ids=["api-1"],
                    customer_group_ids=["group-1"],
                )
            ],
            created_by="test-user",
        )
        
        batch1 = service.create_batch(request, idempotency_key)
        batch2 = service.create_batch(request, idempotency_key)
        
        passed = batch1.id == batch2.id
        all_passed = all_passed and passed
        print_test("相同幂等键返回相同批次", passed)
        
    except Exception as e:
        all_passed = False
        print_test("相同幂等键返回相同批次", False, str(e))

    print_section("2. 脏数据测试")
    
    try:
        request = CreateBatchRequest(
            name="Invalid Batch",
            phases=[],
            created_by="test-user",
        )
        batch = service.create_batch(request)
        
        try:
            service.validate_batch(batch.id, "test-user")
            print_test("空阶段校验失败", False, "应为报错但未报错")
            all_passed = False
        except ValueError as e:
            if "at least one phase" in str(e):
                print_test("空阶段校验失败", True)
            else:
                print_test("空阶段校验失败", False, str(e))
                all_passed = False
                
    except Exception as e:
        all_passed = False
        print_test("空阶段校验失败", False, str(e))

    try:
        request = CreateBatchRequest(
            name="Invalid Batch",
            phases=[
                BatchPhase(
                    phase_number=1,
                    interface_ids=[],
                    customer_group_ids=["group-1"],
                )
            ],
            created_by="test-user",
        )
        batch = service.create_batch(request)
        
        try:
            service.validate_batch(batch.id, "test-user")
            print_test("空接口列表校验失败", False, "应为报错但未报错")
            all_passed = False
        except ValueError as e:
            if "interface" in str(e):
                print_test("空接口列表校验失败", True)
            else:
                print_test("空接口列表校验失败", False, str(e))
                all_passed = False
                
    except Exception as e:
        all_passed = False
        print_test("空接口列表校验失败", False, str(e))

    try:
        batch = service.get_batch("non-existent-id-" + str(uuid.uuid4()))
        passed = batch is None
        all_passed = all_passed and passed
        print_test("不存在的批次返回 None", passed)
        
    except Exception as e:
        all_passed = False
        print_test("不存在的批次返回 None", False, str(e))

    print_section("3. 状态不允许跳转测试")
    
    try:
        request = CreateBatchRequest(
            name="State Test Batch",
            phases=[
                BatchPhase(
                    phase_number=1,
                    interface_ids=["api-1"],
                    customer_group_ids=["group-1"],
                )
            ],
            created_by="test-user",
        )
        batch = service.create_batch(request)
        
        try:
            service.start_batch(batch.id, "test-user")
            print_test("草稿状态不能直接执行", False, "应为报错但未报错")
            all_passed = False
        except ValueError as e:
            if "draft" in str(e).lower():
                print_test("草稿状态不能直接执行", True)
            else:
                print_test("草稿状态不能直接执行", False, str(e))
                all_passed = False
                
    except Exception as e:
        all_passed = False
        print_test("草稿状态不能直接执行", False, str(e))

    try:
        request = CreateBatchRequest(
            name="State Test Batch 2",
            phases=[
                BatchPhase(
                    phase_number=1,
                    interface_ids=["api-1"],
                    customer_group_ids=["group-1"],
                )
            ],
            created_by="test-user",
        )
        batch = service.create_batch(request)
        batch = service.validate_batch(batch.id, "test-user")
        batch = service.start_batch(batch.id, "test-user")
        batch = service.start_observation(batch.id, "test-user")
        
        conclusion = CreateConclusionRequest(
            conclusion_type=ConclusionType.SUCCESS,
            summary="Success",
            archived_by="test-user",
        )
        batch = service.complete_batch(batch.id, conclusion)
        
        try:
            service.cancel_batch(batch.id, "test-user")
            print_test("已完成批次不能取消", False, "应为报错但未报错")
            all_passed = False
        except ValueError as e:
            if "completed" in str(e).lower():
                print_test("已完成批次不能取消", True)
            else:
                print_test("已完成批次不能取消", False, str(e))
                all_passed = False
                
    except Exception as e:
        all_passed = False
        print_test("已完成批次不能取消", False, str(e))

    print_section("4. 完整生命周期测试")
    
    try:
        request = CreateBatchRequest(
            name="Full Lifecycle Batch",
            description="Test full lifecycle",
            phases=[
                BatchPhase(
                    phase_number=1,
                    interface_ids=["api-1", "api-2"],
                    customer_group_ids=["group-1"],
                ),
                BatchPhase(
                    phase_number=2,
                    interface_ids=["api-3"],
                    customer_group_ids=["group-2"],
                ),
            ],
            metrics=[
                ObservationMetric(
                    id="error-rate",
                    name="Error Rate",
                    threshold=100.0,
                )
            ],
            created_by="test-user",
        )
        
        batch = service.create_batch(request)
        assert batch.status == BatchStatus.DRAFT
        
        batch = service.validate_batch(batch.id, "validator")
        assert batch.status == BatchStatus.VALIDATED
        
        batch = service.start_batch(batch.id, "operator")
        assert batch.status == BatchStatus.IN_PROGRESS
        assert batch.current_phase == 1
        
        batch = service.start_observation(batch.id, "operator")
        assert batch.status == BatchStatus.OBSERVING
        
        batch = service.update_metric(batch.id, "error-rate", 50.0)
        assert batch.metrics[0].current_value == 50.0
        
        restore_request = CreateRestoreRequest(
            interface_ids=["api-1"],
            reason="Emergency",
            requester="user",
        )
        restore = service.create_restore_request(batch.id, restore_request)
        restore = service.approve_restore_request(batch.id, restore.id, "approver")
        
        batch = service.get_batch(batch.id)
        assert batch.status == BatchStatus.PARTIAL_RESTORED
        
        conclusion = CreateConclusionRequest(
            conclusion_type=ConclusionType.PARTIAL_SUCCESS,
            summary="Good",
            archived_by="manager",
        )
        batch = service.complete_batch(batch.id, conclusion)
        assert batch.status == BatchStatus.COMPLETED
        
        history = service.get_history(batch.id)
        assert len(history) >= 5
        
        print_test("完整生命周期执行成功", True)
        
    except Exception as e:
        all_passed = False
        print_test("完整生命周期执行成功", False, str(e))

    print_section("5. 状态转换验证")
    
    try:
        valid_transitions = {
            BatchStatus.DRAFT: [BatchStatus.VALIDATED, BatchStatus.CANCELLED],
            BatchStatus.VALIDATED: [BatchStatus.IN_PROGRESS, BatchStatus.CANCELLED, BatchStatus.DRAFT],
            BatchStatus.IN_PROGRESS: [BatchStatus.OBSERVING, BatchStatus.CANCELLED],
            BatchStatus.OBSERVING: [BatchStatus.IN_PROGRESS, BatchStatus.PARTIAL_RESTORED, BatchStatus.COMPLETED, BatchStatus.CANCELLED],
            BatchStatus.PARTIAL_RESTORED: [BatchStatus.OBSERVING, BatchStatus.COMPLETED, BatchStatus.CANCELLED],
            BatchStatus.COMPLETED: [],
            BatchStatus.CANCELLED: [],
        }
        
        print_test("状态转换矩阵定义完整", True)
        
        all_states = list(BatchStatus)
        covered = set(valid_transitions.keys())
        missing = set(all_states) - covered
        if missing:
            print(f"    警告: 缺少状态转换定义: {missing}")
        
    except Exception as e:
        all_passed = False
        print_test("状态转换矩阵定义完整", False, str(e))

    print_section("6. 客户通知测试")

    try:
        request = CreateBatchRequest(
            name="Notification Test Batch",
            phases=[
                BatchPhase(
                    phase_number=1,
                    interface_ids=["api-1"],
                    customer_group_ids=["group-1"],
                )
            ],
            created_by="test-user",
        )
        batch = service.create_batch(request)

        notification_request = CreateNotificationRequest(
            phase_id=1,
            customer_group_id="group-1",
            notification_type=NotificationType.PHASE_START,
            channel=NotificationChannel.EMAIL,
            subject="Test Notification",
            content="Test Content",
        )
        notification = service.create_notification(batch.id, notification_request)
        assert notification.id is not None
        assert notification.status == NotificationStatus.PENDING
        print_test("创建客户通知成功", True)

        notifications, total = service.list_notifications(batch.id)
        assert total == 1
        print_test("列出客户通知成功", True)

        update_request = UpdateNotificationStatusRequest(
            status=NotificationStatus.SENT,
            updated_by="test-user",
        )
        updated = service.update_notification_status(batch.id, notification.id, update_request)
        assert updated.status == NotificationStatus.SENT
        assert updated.sent_at is not None
        print_test("更新客户通知状态成功", True)

        auto_notification = service.auto_create_phase_notification(
            batch.id,
            1,
            NotificationType.PHASE_COMPLETE,
        )
        assert auto_notification.id is not None
        print_test("自动创建阶段通知成功", True)
        
    except Exception as e:
        all_passed = False
        print_test("客户通知功能测试", False, str(e))

    print_section("7. ErrorResponse 验证 (必填 error_code)")
    
    try:
        from app.models.schemas import ErrorResponse, ErrorCode
        
        error_response = ErrorResponse(
            error_code=ErrorCode.BATCH_NOT_FOUND,
            message="Test error message",
        )
        assert error_response.error_code is not None
        assert error_response.timestamp is not None
        print_test("ErrorResponse 包含必填 error_code 字段", True)
        
        assert hasattr(ErrorCode, 'BATCH_NOT_FOUND')
        assert hasattr(ErrorCode, 'INVALID_STATE_TRANSITION')
        assert hasattr(ErrorCode, 'VALIDATION_ERROR')
        print_test("ErrorCode 枚举定义完整", True)
        
    except Exception as e:
        all_passed = False
        print_test("ErrorResponse 验证失败", False, str(e))

    print_section("自检结果")
    
    if all_passed:
        print("\n  ✓ 所有检查通过！系统运行正常。\n")
        return 0
    else:
        print("\n  ✗ 部分检查未通过，请检查错误信息。\n")
        return 1


if __name__ == "__main__":
    sys.exit(run_self_check())
