"""幕墙节点方案比选 - 分析逻辑模块

实现异常判断、碰撞点隔离、历史追溯等核心业务逻辑，
与飞书多维表格中的公式字段、视图筛选规则保持一致。
"""

from data import (
    NODES,
    MEETING_MINUTES,
    COLLISION_POINTS,
    CHANGE_RECORDS,
    get_node,
    get_minutes,
    get_collision,
    get_change,
)


def is_abnormal(node):
    """判断节点是否异常（与飞书公式字段「异常标记」逻辑一致）

    异常条件（满足任一即异常）：
    - 存在碰撞点（异常碰撞点数 > 0）
    - 图纸版本确认 = 版本存疑需复核
    - 当前结论 = 存在碰撞待协调
    - 当前结论 = 需补录后判断
    """
    has_collision = len(node["collision_ids"]) > 0
    version_doubt = node["drawing_version_status"] == "版本存疑需复核"
    conclusion_pending = node["current_conclusion"] == "存在碰撞待协调"
    conclusion_need_more = node["current_conclusion"] == "需补录后判断"
    return has_collision or version_doubt or conclusion_pending or conclusion_need_more


def get_node_detail(node_id):
    """组装节点详情：关联的纪要、碰撞点、变更记录"""
    node = get_node(node_id)
    if not node:
        return None

    minutes_list = [get_minutes(mid) for mid in node["minutes_ids"]]
    minutes_list = [m for m in minutes_list if m]

    collisions = [get_collision(cid) for cid in node["collision_ids"]]
    collisions = [c for c in collisions if c]

    changes = [get_change(cid) for cid in node["change_ids"]]
    changes = [c for c in changes if c]

    return {
        **node,
        "minutes_list": minutes_list,
        "collision_list": collisions,
        "change_list": changes,
        "is_abnormal": is_abnormal(node),
        "minutes_count": len(minutes_list),
        "collision_count": len(collisions),
        "change_count": len(changes),
    }


def get_all_nodes_with_detail():
    """获取所有节点的详情列表"""
    return [get_node_detail(n["id"]) for n in NODES]


def get_normal_summary_nodes():
    """正常汇总结点：图纸版本 = 已确认最新版（对应飞书「① 正常汇总看板」）

    注意：碰撞点标记了「排除正常汇总」的，不进入结论，但节点本身仍可能
    出现在列表里（只要版本已确认）。重复碰撞点需在独立区域展示。
    """
    all_nodes = get_all_nodes_with_detail()
    return [n for n in all_nodes if n["drawing_version_status"] == "已确认最新版"]


def get_abnormal_nodes():
    """异常节点列表（对应飞书「② 异常标记视图」）"""
    all_nodes = get_all_nodes_with_detail()
    return [n for n in all_nodes if n["is_abnormal"]]


def get_excluded_collisions():
    """标记了「排除正常汇总」的碰撞点 - 需单独看，不能合并进正常结论

    对应飞书异常碰撞点表的「已排除正常汇总（需单独看）」视图
    """
    return [c for c in COLLISION_POINTS if c.get("exclude_from_summary", False)]


def get_normal_collisions():
    """正常碰撞点（未标记排除的）"""
    return [c for c in COLLISION_POINTS if not c.get("exclude_from_summary", False)]


def get_changes_by_node(node_id):
    """按节点查变更记录（变更追溯）"""
    return [c for c in CHANGE_RECORDS if c["node_id"] == node_id]


def get_all_changes_sorted():
    """所有变更记录，按时间倒序"""
    return sorted(CHANGE_RECORDS, key=lambda x: x["change_time"], reverse=True)


def get_export_summary():
    """生成可导出的比选结果摘要"""
    rows = []
    for node in get_all_nodes_with_detail():
        rows.append({
            "节点编号": node["id"],
            "节点名称": node["name"],
            "当前结论": node["current_conclusion"],
            "图纸版本状态": node["drawing_version_status"],
            "计算口径": node["calc_spec"],
            "异常状态": "⚠️ 异常" if node["is_abnormal"] else "正常",
            "关联纪要数": node["minutes_count"],
            "异常碰撞点数": node["collision_count"],
            "历史变更次数": node["change_count"],
            "结构工程师": node["engineer"],
        })
    return rows


def validate_data():
    """数据一致性校验：检查关联 ID 是否都存在"""
    errors = []
    for node in NODES:
        for mid in node["minutes_ids"]:
            if not get_minutes(mid):
                errors.append(f"节点 {node['id']} 关联了不存在的纪要 {mid}")
        for cid in node["collision_ids"]:
            if not get_collision(cid):
                errors.append(f"节点 {node['id']} 关联了不存在的碰撞点 {cid}")
        for cid in node["change_ids"]:
            if not get_change(cid):
                errors.append(f"节点 {node['id']} 关联了不存在的变更 {cid}")
    return errors
