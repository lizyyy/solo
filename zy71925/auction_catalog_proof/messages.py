"""
人性化消息体系
==============

将技术字段名和内部错误转换为一线同事能看懂的人话
"""

from typing import Dict, Optional

FIELD_LABELS: Dict[str, str] = {
    "lot_number": "拍品编号",
    "title_cn": "中文名称",
    "title_en": "英文名称",
    "artist": "艺术家",
    "artist_en": "艺术家（英文）",
    "year": "创作年代",
    "medium": "材质工艺",
    "dimensions": "尺寸",
    "estimate": "估价",
    "provenance": "来源",
    "literature": "文献",
    "exhibition": "展览历史",
    "description": "作品说明",
    "notes": "备注",
    "wall_id": "展墙编号",
    "wall_name": "展墙名称",
    "position_x": "横向位置",
    "position_y": "纵向位置",
    "width": "展示宽度",
    "height": "展示高度",
    "lighting_scheme": "灯光方案",
    "display_sequence": "展示顺序",
}

SEVERITY_LABELS: Dict[str, str] = {
    "critical": "严重",
    "warning": "注意",
    "info": "提示",
}

STATUS_LABELS: Dict[str, str] = {
    "pending": "待处理",
    "confirmed": "已确认",
    "resolved": "已解决",
    "needs_info": "待补充",
    "manual_edited": "人工修改",
}


def get_field_label(field_name: str) -> str:
    return FIELD_LABELS.get(field_name, field_name)


def format_difference_message(
    field_name: str,
    works_list_value: Optional[str],
    wall_layout_value: Optional[str],
) -> str:
    label = get_field_label(field_name)

    if works_list_value is None or str(works_list_value).strip() == "":
        return f"「{label}」在作品清单里是空的，但展墙图里写的是「{wall_layout_value}」"

    if wall_layout_value is None or str(wall_layout_value).strip() == "":
        return f"「{label}」在展墙图里是空的，但作品清单里写的是「{works_list_value}」"

    return (
        f"「{label}」两边对不上——作品清单写的是「{works_list_value}」，"
        f"但展墙图里是「{wall_layout_value}」"
    )


def format_lighting_conflict_message(
    lot_number: str,
    works_list_lighting: Optional[str],
    wall_layout_lighting: Optional[str],
) -> str:
    parts = [f"拍品 {lot_number} 的灯光方案有冲突："]

    if works_list_lighting:
        parts.append(f"• 作品清单要求：{works_list_lighting}")
    else:
        parts.append("• 作品清单里没写灯光要求")

    if wall_layout_lighting:
        parts.append(f"• 展墙图现在用的是：{wall_layout_lighting}")
    else:
        parts.append("• 展墙图里没写灯光方案")

    parts.append("两边不一样，需要确认最后按哪个来。")
    return "\n".join(parts)


def format_import_error(file_path: str, error_type: str, details: str) -> str:
    error_messages = {
        "file_not_found": f"找不到文件「{file_path}」，请检查路径是不是写错了",
        "format_unsupported": f"文件「{file_path}」格式不支持，目前只认 Excel 和 CSV",
        "missing_column": f"导入出错：{details}。请检查表头是不是和模板对得上",
        "empty_file": f"文件「{file_path}」里是空的，至少得有一行数据吧",
        "parse_error": f"文件「{file_path}」读取出错：{details}。试试另存为新文件再导一次",
    }
    return error_messages.get(error_type, f"导入文件「{file_path}」时出错：{details}")


def format_resolution_suggestion(
    field_name: str,
    works_list_value: Optional[str],
    wall_layout_value: Optional[str],
) -> str:
    label = get_field_label(field_name)

    suggestions = []

    if works_list_value and not wall_layout_value:
        suggestions.append(f"建议：如果作品清单的「{label}」是对的，直接沿用就行")
        suggestions.append(f"或者：问问展陈设计师，展墙图里「{label}」是不是漏了")
    elif wall_layout_value and not works_list_value:
        suggestions.append(f"建议：如果展墙图的「{label}」是对的，就用这个值补到图录里")
        suggestions.append(f"或者：问问策展人，作品清单里「{label}」是不是忘了写")
    else:
        suggestions.append(f"建议：先找策展人确认「{label}」应该以哪个为准")
        suggestions.append(f"或者：如果是笔误，直接选对的那个就行")

    return "\n".join(suggestions)


def format_lighting_next_step(
    works_list_has_value: bool,
    wall_layout_has_value: bool,
) -> str:
    if works_list_has_value and wall_layout_has_value:
        return "下一步：先找灯光设计师确认技术可行性，再找策展人定最终方案"
    elif works_list_has_value:
        return "下一步：问问展陈设计师，是不是漏了把灯光要求标到展墙图上"
    else:
        return "下一步：问问策展人，这件作品有没有特殊的灯光要求"


def format_history_action(action: str, field_name: Optional[str], old_value: Optional[str], new_value: Optional[str]) -> str:
    label = get_field_label(field_name) if field_name else ""

    action_text = {
        "import": "导入数据",
        "confirm": "确认无误",
        "edit": f"修改「{label}」",
        "resolve": f"解决「{label}」的差异",
        "reject": f"驳回「{label}」的修改",
        "lighting_resolve": "解决灯光方案冲突",
        "status_change": "变更状态",
    }.get(action, action)

    if action in ["edit", "resolve"] and old_value and new_value:
        return f"{action_text}：从「{old_value}」改成「{new_value}」"
    elif action == "confirm":
        return "确认这条记录两边一致，没有问题"
    elif action == "lighting_resolve":
        return f"确定灯光方案：{new_value}"

    return action_text
