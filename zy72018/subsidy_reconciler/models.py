SOURCE_PAYMENT = "payment"
SOURCE_REFUND = "refund"
SOURCE_APPROVAL_EMAIL = "approval_email"
SOURCE_MANUAL_NOTE = "manual_note"

SOURCE_TYPES = [SOURCE_PAYMENT, SOURCE_REFUND, SOURCE_APPROVAL_EMAIL, SOURCE_MANUAL_NOTE]

SOURCE_TYPE_LABELS = {
    SOURCE_PAYMENT: "收款流水",
    SOURCE_REFUND: "退款申请",
    SOURCE_APPROVAL_EMAIL: "审批邮件",
    SOURCE_MANUAL_NOTE: "手写备注",
}

STATUS_CONFIRMED = "confirmed"
STATUS_PENDING_MATERIAL = "pending_material"
STATUS_PENDING_MANUAL = "pending_manual"
STATUS_OLD_STANDARD = "old_standard"
STATUS_OVERRIDDEN = "overridden"

ALL_STATUSES = [
    STATUS_CONFIRMED,
    STATUS_PENDING_MATERIAL,
    STATUS_PENDING_MANUAL,
    STATUS_OLD_STANDARD,
    STATUS_OVERRIDDEN,
]

STATUS_LABELS = {
    STATUS_CONFIRMED: "已确认",
    STATUS_PENDING_MATERIAL: "待补材料",
    STATUS_PENDING_MANUAL: "待人工确认",
    STATUS_OLD_STANDARD: "旧口径",
    STATUS_OVERRIDDEN: "人工改判",
}

ACTION_IMPORTED = "imported"
ACTION_SKIPPED = "skipped"
ACTION_UPDATED = "updated"
ACTION_CONFLICT = "conflict"
ACTION_CONFIRMED = "confirmed"
ACTION_OVERRIDDEN = "overridden"
ACTION_SUPPLEMENTED = "supplemented"
ACTION_RECONCILED = "reconciled"

ACTION_LABELS = {
    ACTION_IMPORTED: "导入",
    ACTION_SKIPPED: "跳过(重复)",
    ACTION_UPDATED: "更新",
    ACTION_CONFLICT: "冲突",
    ACTION_CONFIRMED: "确认",
    ACTION_OVERRIDDEN: "人工改判",
    ACTION_SUPPLEMENTED: "补录",
    ACTION_RECONCILED: "对账匹配",
}

CSV_COLUMNS = {
    SOURCE_PAYMENT: ["日期", "影片名称", "票数", "补贴金额"],
    SOURCE_REFUND: ["日期", "影片名称", "票数", "退款金额", "退款原因"],
    SOURCE_APPROVAL_EMAIL: ["日期", "影片名称", "票数", "审批金额", "邮件主题", "邮件日期"],
    SOURCE_MANUAL_NOTE: ["日期", "影片名称", "票数", "金额", "备注"],
}
