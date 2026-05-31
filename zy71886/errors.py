HUMAN_MESSAGES = {
    "UNIT_MISMATCH": "第 {line} 行温度单位是 {actual_unit}，但标定表用的是 {expected_unit}，请先换算再导入。",
    "DUPLICATE_RECORD": "样本 {sample_id} 在 {timestamp} 已有一条记录，新记录被跳过。如需覆盖，请使用「人工更正」标记。",
    "LATE_ATTACHMENT": "这是晚到的附件（{filename}），已按时间顺序插入，请确认位置是否正确。",
    "MISSING_CALIBRATION": "找不到样本 {sample_id} 对应的标定表记录，请联系标定组（分机 8032）补录。",
    "ZERO_DRIFT_EXPERIMENT": "检测到零点漂移（偏差 {drift_value}），来源：实验记录。请找实验操作员 {operator} 确认基线。",
    "ZERO_DRIFT_CALIBRATION": "检测到零点漂移（偏差 {drift_value}），来源：标定表。请联系标定组（分机 8032）重新标定。",
    "INVALID_VALUE": "第 {line} 行的 {field} 值「{value}」无法识别，请检查是否有多余空格或单位混写。",
    "MISSING_FIELD": "第 {line} 行缺少必要字段「{field}」，请补全后重新导入。",
    "CORRECTION_APPLIED": "人工更正已应用：样本 {sample_id} 在 {timestamp} 的记录已被覆盖，原始值 {old_value} → 新值 {new_value}。",
    "EXPORT_MISMATCH": "导出范围与当前屏幕筛选不一致，请先刷新页面再导出。",
    "FILTER_INCONSISTENCY": "筛选条件已变更，曲线数据正在重新加载，请稍候。",
    "CALIBRATION_VERSION_MISSING": "标定表版本号缺失，无法确认是否为最新版本。请联系标定组（分机 8032）确认。",
}


class UserError(Exception):
    def __init__(self, code, **kwargs):
        self.code = code
        self.params = kwargs
        template = HUMAN_MESSAGES.get(code, code)
        self.human_message = template.format(**kwargs)
        super().__init__(self.human_message)


def humanize(code, **kwargs):
    template = HUMAN_MESSAGES.get(code, code)
    try:
        return template.format(**kwargs)
    except KeyError:
        return template
