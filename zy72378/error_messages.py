HUMAN_READABLE_ERRORS = {
    "duplicate_import": "这条记录之前已经导入过了，请检查是否重复提交。记录编号：{record_id}",
    "negative_direction_written_as_left": "负方向被现场师傅写成了「向左」，这种写法系统无法自动判断正负，已标记为待复核，请实验老师确认。",
    "supplementary_recalc_needed": "补录数据后需要重新计算风速压差，请点击重算按钮后再核验。",
    "export_inconsistency": "导出数据与当前核验结果不一致，可能存在未保存的修改，请重新导出。",
    "wind_speed_exceeds_max": "风速 {value} 超过了安全上限 {threshold}，请立即确认是否为异常工况。",
    "wind_speed_below_min": "风速 {value} 低于安全下限 {threshold}，请确认通风是否正常。",
    "pressure_diff_exceeds_max": "压差 {value} 超过了安全上限 {threshold}，请立即确认是否为异常工况。",
    "pressure_diff_below_min": "压差 {value} 低于安全下限 {threshold}，请确认压差传感器是否正常。",
    "direction_ambiguous": "方向标识「{raw_value}」不明确，无法自动归为正向或负向，已标记为待复核。",
    "conflict_handwritten_vs_threshold": "手写巡检备注中 {field} 的值为 {handwritten_value}，但安全阈值表中规定为 {threshold_value}，两者不一致，请教练确认采纳哪个。",
    "missing_threshold_table": "找不到对应隧道 {tunnel_id} 的安全阈值表，无法完成核验。",
    "invalid_wind_speed": "风速值 {value} 不合法（不能为负数或非数字），请检查原始记录。",
    "invalid_pressure_diff": "压差值 {value} 不合法（不能为非数字），请检查原始记录。",
    "abnormal_condition_mismatch": "异常工况表中的记录 {record_id} 与历史记录对不上，请核查该条异常是否已被修正。",
}


def get_error_message(error_key: str, **kwargs) -> str:
    template = HUMAN_READABLE_ERRORS.get(error_key, f"未知错误（{error_key}）")
    try:
        return template.format(**kwargs)
    except KeyError:
        return template
