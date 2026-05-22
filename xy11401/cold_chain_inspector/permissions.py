from .models import Role


ALL_FIELDS = [
    "id", "batch_id", "original_line_no", "source_type",
    "box_no", "original_box_no", "driver_name", "vehicle_no",
    "departure", "destination",
    "shipment_date", "receive_date", "expected_date", "cross_day",
    "quantity", "original_quantity", "unit_price", "amount", "original_amount",
    "min_temp", "max_temp", "avg_temp", "temp_exceed_count",
    "shift_no", "photo_ref", "signatory",
    "status", "created_at", "updated_at", "raw_data"
]


ROLE_FIELD_PERMISSIONS = {
    Role.DATA_ENTRY: [
        "id", "batch_id", "original_line_no", "source_type",
        "box_no", "original_box_no", "driver_name", "vehicle_no",
        "departure", "destination",
        "shipment_date", "receive_date", "expected_date",
        "quantity", "unit_price", "amount",
        "min_temp", "max_temp", "avg_temp",
        "shift_no", "photo_ref", "signatory",
        "status", "created_at"
    ],
    Role.REVIEWER: [
        "id", "batch_id", "original_line_no", "source_type",
        "box_no", "original_box_no", "driver_name", "vehicle_no",
        "departure", "destination",
        "shipment_date", "receive_date", "expected_date", "cross_day",
        "quantity", "original_quantity", "unit_price", "amount", "original_amount",
        "min_temp", "max_temp", "avg_temp", "temp_exceed_count",
        "shift_no", "photo_ref", "signatory",
        "status", "created_at", "updated_at"
    ],
    Role.SUPERVISOR: ALL_FIELDS,
    Role.READ_ONLY: [
        "id", "batch_id", "original_line_no", "source_type",
        "box_no", "driver_name", "vehicle_no",
        "departure", "destination",
        "shipment_date", "receive_date",
        "quantity", "amount",
        "avg_temp",
        "shift_no", "signatory",
        "status", "created_at"
    ]
}


ROLE_ACTION_PERMISSIONS = {
    Role.DATA_ENTRY: [
        "init", "import", "view", "check", "export_own"
    ],
    Role.REVIEWER: [
        "init", "import", "view", "check", "fix", "export"
    ],
    Role.SUPERVISOR: [
        "init", "import", "view", "check", "fix", "report",
        "history", "export", "user_manage", "approve"
    ],
    Role.READ_ONLY: [
        "view", "export_limited"
    ]
}


ISSUE_MANAGEMENT_PERMISSIONS = {
    Role.DATA_ENTRY: ["view_issues", "report_issue"],
    Role.REVIEWER: ["view_issues", "report_issue", "resolve_issue", "mark_fixed"],
    Role.SUPERVISOR: ["view_issues", "report_issue", "resolve_issue", "mark_fixed", "reopen_issue", "batch_resolve"],
    Role.READ_ONLY: ["view_issues"]
}


def can_view_field(role, field_name):
    allowed_fields = ROLE_FIELD_PERMISSIONS.get(role, [])
    return field_name in allowed_fields


def can_perform_action(role, action):
    allowed_actions = ROLE_ACTION_PERMISSIONS.get(role, [])
    return action in allowed_actions


def can_manage_issue(role, action):
    allowed = ISSUE_MANAGEMENT_PERMISSIONS.get(role, [])
    return action in allowed


def filter_fields_by_role(role, data_dict):
    allowed_fields = ROLE_FIELD_PERMISSIONS.get(role, [])
    return {k: v for k, v in data_dict.items() if k in allowed_fields}


def get_role_display_name(role):
    role_names = {
        Role.DATA_ENTRY: "数据录入员",
        Role.REVIEWER: "复核员",
        Role.SUPERVISOR: "运营主管",
        Role.READ_ONLY: "只读查看"
    }
    return role_names.get(role, str(role))
