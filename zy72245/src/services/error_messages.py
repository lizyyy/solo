ERROR_MESSAGES = {
    "DUPLICATE_IMPORT": "这批柜台流水尾号已经导入过了，不会重复计算核验数量",
    "MISSING_TAIL_NUMBER": "柜台流水尾号不能为空",
    "MISSING_APPROVER": "审批人不能为空",
    "MISSING_AMOUNT": "金额不能为空",
    "INVALID_AMOUNT": "金额格式不正确，请输入有效数字",
    "PINYIN_APPROVER_DETECTED": "审批人只有拼音（如「{approver}」），已标记为待客户经理复核，不会自动归为正常",
    "VERIFICATION_NOT_FOUND": "找不到对应的绿色债券投向占比核验记录",
    "TRANSACTION_NOT_FOUND": "找不到对应的柜台流水记录",
    "STEP_ORDER_VIOLATION": "流程步骤顺序不对：{detail}，请按 导入→补看邮件→余额更新 的顺序操作",
    "ROLLBACK_SUCCESS": "已回滚：{detail}",
    "ROLLBACK_FAILED": "回滚失败：{detail}",
    "FIELD_UPDATE_SUCCESS": "{field_name}已从「{old}」改为「{new}」",
    "INVALID_STEP": "核验步骤不正确，有效步骤为：导入、补看邮件、余额更新",
    "BALANCE_UPDATE_CONFLICT": "余额变化表已更新过，如需修改请先回滚",
    "EMAIL_NOT_FOUND": "找不到对应的客户经理补充邮件",
    "APPROVER_FIX_REQUIRES_REVIEW": "修改审批人后仍需客户经理复核确认",
}


def get_error(code: str, **kwargs) -> str:
    template = ERROR_MESSAGES.get(code, code)
    try:
        return template.format(**kwargs)
    except KeyError:
        return template


FIELD_DISPLAY_NAMES = {
    "approver": "审批人",
    "remark": "备注",
    "amount": "金额",
    "approver_status": "审批人状态",
    "tail_number": "柜台流水尾号",
    "green_ratio": "绿色债券投向占比",
    "status": "核验状态",
    "verification_step": "核验步骤",
}


def humanize_field(field_name: str) -> str:
    return FIELD_DISPLAY_NAMES.get(field_name, field_name)
