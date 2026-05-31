from datetime import datetime, timedelta
from typing import List
from enum import Enum

from ..models import CallLog


class TestScenario(str, Enum):
    NORMAL = "normal"
    DUPLICATE = "duplicate"
    LATE_ARRIVAL = "late_arrival"
    INVALID_PERMISSION = "invalid_permission"
    MIXED = "mixed"


def generate_test_batch(
    tenant_id: str,
    batch_id: str,
    scenario: TestScenario = TestScenario.MIXED,
    total_records: int = 20,
) -> List[CallLog]:
    logs = []
    base_time = datetime.now()

    if scenario == TestScenario.NORMAL:
        for i in range(total_records):
            logs.append(_create_normal_log(tenant_id, batch_id, i, base_time))

    elif scenario == TestScenario.DUPLICATE:
        for i in range(total_records // 2):
            log = _create_normal_log(tenant_id, batch_id, i, base_time)
            logs.append(log)
            duplicate_log = _create_duplicate_log(log, base_time + timedelta(seconds=30))
            logs.append(duplicate_log)

    elif scenario == TestScenario.LATE_ARRIVAL:
        for i in range(total_records // 2):
            logs.append(_create_normal_log(tenant_id, batch_id, i, base_time))
        for i in range(total_records // 2, total_records):
            logs.append(_create_late_log(tenant_id, batch_id, i, base_time))

    elif scenario == TestScenario.INVALID_PERMISSION:
        for i in range(total_records // 2):
            logs.append(_create_normal_log(tenant_id, batch_id, i, base_time))
        for i in range(total_records // 2, total_records):
            logs.append(_create_invalid_permission_log(tenant_id, batch_id, i, base_time))

    elif scenario == TestScenario.MIXED:
        normal_count = total_records // 2
        duplicate_count = total_records // 5
        late_count = total_records // 5
        invalid_count = total_records - normal_count - duplicate_count - late_count

        idx = 0
        for i in range(normal_count):
            logs.append(_create_normal_log(tenant_id, batch_id, idx, base_time))
            idx += 1

        for i in range(duplicate_count):
            log = _create_normal_log(tenant_id, batch_id, idx, base_time)
            logs.append(log)
            duplicate_log = _create_duplicate_log(log, base_time + timedelta(seconds=15 + i))
            logs.append(duplicate_log)
            idx += 1

        for i in range(late_count):
            logs.append(_create_late_log(tenant_id, batch_id, idx, base_time))
            idx += 1

        for i in range(invalid_count):
            logs.append(_create_invalid_permission_log(tenant_id, batch_id, idx, base_time))
            idx += 1

    return logs


def _create_normal_log(
    tenant_id: str, batch_id: str, index: int, base_time: datetime
) -> CallLog:
    permissions = [
        "can_view_dashboard",
        "can_edit_users",
        "can_export_data",
        "can_manage_roles",
        "can_access_reports",
    ]
    return CallLog(
        tenant_id=tenant_id,
        user_id=f"user_{index % 10 + 1}",
        action="grant_permission",
        request_body={
            "user_id": f"user_{index % 10 + 1}",
            "permission_code": permissions[index % len(permissions)],
            "change_type": "grant",
            "new_value": True,
            "batch_id": batch_id,
        },
        timestamp=base_time + timedelta(seconds=index),
        source_system="api_gateway",
        response_status=200,
        response_body={"status": "accepted"},
    )


def _create_duplicate_log(original_log: CallLog, new_time: datetime) -> CallLog:
    return CallLog(
        tenant_id=original_log.tenant_id,
        user_id=original_log.user_id,
        action=original_log.action,
        request_body=original_log.request_body.copy(),
        idempotency_key=original_log.generate_idempotency_key(),
        timestamp=new_time,
        source_system="retry_job",
        response_status=200,
        response_body={"status": "accepted", "retry": True},
    )


def _create_late_log(
    tenant_id: str, batch_id: str, index: int, base_time: datetime
) -> CallLog:
    return CallLog(
        tenant_id=tenant_id,
        user_id=f"user_late_{index % 5 + 1}",
        action="grant_permission",
        request_body={
            "user_id": f"user_late_{index % 5 + 1}",
            "permission_code": "can_view_dashboard",
            "change_type": "grant",
            "new_value": True,
            "batch_id": batch_id,
        },
        timestamp=base_time - timedelta(hours=2, minutes=index),
        source_system="delayed_queue",
        response_status=200,
        response_body={"status": "accepted", "delayed": True},
    )


def _create_invalid_permission_log(
    tenant_id: str, batch_id: str, index: int, base_time: datetime
) -> CallLog:
    invalid_permissions = [
        "can_do_magic",
        "nonexistent_permission",
        "admin_access_override",
        "invalid_code_123",
        "wrong_permission_name",
    ]
    return CallLog(
        tenant_id=tenant_id,
        user_id=f"user_invalid_{index % 5 + 1}",
        action="grant_permission",
        request_body={
            "user_id": f"user_invalid_{index % 5 + 1}",
            "permission_code": invalid_permissions[index % len(invalid_permissions)],
            "change_type": "grant",
            "new_value": True,
            "batch_id": batch_id,
        },
        timestamp=base_time + timedelta(seconds=100 + index),
        source_system="third_party_api",
        response_status=200,
        response_body={"status": "accepted"},
    )
