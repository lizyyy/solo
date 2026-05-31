ERROR_MESSAGES = {
    "MISSING_KB_FILE": "找不到知识库文件，请确认文件路径是否正确。如果还没有导出知识库，请先从系统导出。",
    "MISSING_CONV_FILE": "找不到对话记录文件，请确认文件路径是否正确。",
    "EMPTY_KB": "知识库文件是空的，没有任何知识条目。请检查导出时是否选对了范围。",
    "EMPTY_CONV": "对话记录文件是空的，没有任何对话数据。请检查导出时是否选对了范围。",
    "INVALID_FORMAT": "文件格式有问题，无法正常解析。请确认是系统导出的原始文件，没有被手动改动过。",
    "KB_PARSE_ERROR": "知识库里有条目读不出来，可能是格式不统一。问题条目已跳过，详细内容见下方提示。",
    "CONV_PARSE_ERROR": "对话记录里有条目读不出来，可能是格式不统一。问题条目已跳过，详细内容见下方提示。",
    "MISSING_FIELD": "缺少必要字段「{field}」。请检查数据来源是否完整，这个字段对分析很关键。",
    "DUPLICATE_ID": "发现重复编号「{id}」，后出现的会被跳过。如果是有意为之，请先去重再导入。",
    "MISSING_KB_FOR_CONV": "这条对话没有匹配到任何知识库条目，可能是知识库缺少相关内容，建议考虑新增。",
    "DUPLICATE_OVERRIDE": "这条对话之前已被人工改判过（{prev_reviewer} 于 {prev_time}），再次改判会覆盖原判断。",
    "LOW_CONFIDENCE": "匹配置信度只有 {confidence:.0%}，不够确定，建议人工复核。",
    "BOUNDARY_AMBIGUOUS": "这条对话属于边界情况，自动判定可能不准确，请人工确认。",
    "MULTIPLE_MATCH": "这条对话匹配到多个知识条目（{count} 个），请确认哪个更合适。",
    "NO_ACTIVE_KB": "知识库里没有处于启用状态的条目，请检查是否有条目被误设为停用。",
    "DB_LOCKED": "历史数据库被其他程序占用，请关闭其他正在使用此数据库的程序后重试。",
    "DB_CORRUPT": "历史数据库可能已损坏，建议备份后删除重建。如需恢复数据，请联系技术支持。",
    "EXPORT_NO_DATA": "当前没有可导出的数据，请先完成分析或复核。",
    "EXPORT_WRITE_ERROR": "导出文件写入失败，可能是磁盘空间不足或没有写入权限。",
    "SESSION_NOT_FOUND": "找不到指定的复核批次「{session_id}」，可能已被清理或编号有误。",
    "GENERAL": "出了点问题：{detail}",
}


def get_error(code: str, **kwargs) -> str:
    template = ERROR_MESSAGES.get(code, ERROR_MESSAGES["GENERAL"])
    if code == "GENERAL" and "detail" not in kwargs:
        kwargs["detail"] = "未知错误"
    try:
        return template.format(**kwargs)
    except KeyError:
        return template
