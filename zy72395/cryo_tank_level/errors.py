class CryoTankError(Exception):
    def __init__(self, message: str, code: str = None, details: dict = None):
        super().__init__(message)
        self.code = code
        self.details = details or {}


_ERROR_MESSAGES = {
    "DUPLICATE_IMPORT": "这批巡检备注已经导入过了，不需要重复导入。如果是修改内容，请使用'修改单条备注'功能。",
    "SENSOR_ID_CHANGED": "检测到传感器编号可能发生了变化（传感器重启后常见现象）。已标记待安全员复核，请勿直接覆盖原有数据。",
    "SENSOR_NOT_FOUND": "找不到编号为 {sensor_id} 的传感器，请先确认传感器是否已注册。",
    "THRESHOLD_NOT_FOUND": "找不到对应的安全阈值表，请先导入或确认阈值编号是否正确。",
    "INVALID_LEVEL_VALUE": "液位值 {value} 不在合理范围内（0-100），请检查手写记录是否正确。",
    "WORKFLOW_NOT_READY": "当前步骤还没完成，不能跳到下一步。请先完成 {current_step}。",
    "CANNOT_ROLLBACK": "无法回滚到该状态，因为中间有其他修改已经过安全员确认。",
    "NO_HISTORY": "没有找到这条记录的修改历史。",
    "NOTE_NOT_FOUND": "找不到编号为 {note_id} 的巡检备注。",
    "MISSING_REQUIRED_FIELD": "缺少必填信息：{field_name}。请补充完整后再提交。",
    "RECORD_UNDER_REVIEW": "这条记录当前正在等待安全员复核，暂时不能修改。",
}


def error_message(code: str, **kwargs) -> str:
    template = _ERROR_MESSAGES.get(code, "发生了未知错误，请联系系统管理员。")
    try:
        return template.format(**kwargs)
    except KeyError:
        return template
