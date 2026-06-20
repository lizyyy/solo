"""幕墙节点方案比选 - 示例数据模块

包含节点方案、会议纪要、异常碰撞点、历史变更记录四类数据，
与飞书多维表格设计保持一致，可独立在本地运行分析。
"""

NODES = [
    {
        "id": "MQ-001",
        "name": "东立面转角铝合金幕墙节点",
        "calc_spec": "GB50210-2018 幕墙工程验收规范，铝合金型材壁厚≥3mm，埋件间距≤1200mm",
        "current_conclusion": "已通过",
        "drawing_version_status": "已确认最新版",
        "engineer": "老叶",
        "material_attachments": [
            "节点大样图V3-20260601.pdf",
            "计算书-铝合金型材强度校核.xlsx",
        ],
        "minutes_ids": [],
        "collision_ids": [],
        "change_ids": [],
    },
    {
        "id": "MQ-002",
        "name": "西立面入口玻璃肋驳接节点",
        "calc_spec": "JGJ102-2003 玻璃幕墙工程技术规范，钢化玻璃厚度≥12mm，驳接头间距≤300mm",
        "current_conclusion": "存在碰撞待协调",
        "drawing_version_status": "待确认版本",
        "engineer": "老叶",
        "material_attachments": [
            "玻璃肋驳接节点图V2.pdf",
            "驳接件荷载计算书.pdf",
        ],
        "minutes_ids": ["MIN-001"],
        "collision_ids": ["COL-001"],
        "change_ids": [],
    },
    {
        "id": "MQ-003",
        "name": "南立面开启扇密封胶缝节点",
        "calc_spec": "GB/T14683-2017 硅酮建筑密封胶，胶缝厚度≥8mm宽度≥10mm",
        "current_conclusion": "需补录后判断",
        "drawing_version_status": "版本存疑需复核",
        "engineer": "老叶",
        "material_attachments": [
            "开启扇密封节点图V3-20260609.pdf",
            "密封胶产品说明书.pdf",
        ],
        "minutes_ids": ["MIN-002"],
        "collision_ids": ["COL-002"],
        "change_ids": ["CHG-001"],
    },
]

MEETING_MINUTES = [
    {
        "id": "MIN-001",
        "title": "西立面玻璃肋第一次技术评审会",
        "meeting_time": "2026-06-08 14:00",
        "content": """西立面入口玻璃肋驳接节点第一次评审：
发现驳接头与钢龙骨间距不足，需要调整驳接位置。
方案A建议增加垫块厚度，方案B建议下移驳接头20mm。""",
        "supplement_note": "补充备注：设计院反馈方案B会影响外观线条，方案A成本可接受，但需要确认垫块耐久性。",
        "source_location": "文档：幕墙专项评审会议纪要.docx\n段落：第二章 2.1 节\n原文：\"驳接头与钢龙骨净距仅15mm，低于规范要求30mm\"",
        "collision_status": "有碰撞待协调",
        "old_version_screenshot": "旧版节点图V1对比截图（占位图）.png",
        "node_id": "MQ-002",
    },
    {
        "id": "MIN-002",
        "title": "南立面密封胶缝第二轮评审",
        "meeting_time": "2026-06-09 10:30",
        "content": """南立面开启扇密封胶缝节点第二轮评审：
第一轮推荐方案A低模量胶，第二轮复核时发现该批次胶的相容性报告缺失。
需要补录材料相容性检测报告后再判断。""",
        "supplement_note": "补充备注：施工方承诺6月11日前补齐报告；第一轮图纸V2版与第二轮V3版标注不一致，以V3版为准（见旧版本截图对比）。",
        "source_location": "文档：南立面开启扇专项评审纪要-V2.docx\n段落：附录B 第3条\n原文：\"低模量硅酮密封胶需提供与铝合金型材的相容性试验报告\"",
        "collision_status": "碰撞重复出现",
        "old_version_screenshot": "V2与V3版胶缝标注对比截图（占位图）.png",
        "node_id": "MQ-003",
    },
]

COLLISION_POINTS = [
    {
        "id": "COL-001",
        "title": "驳接头与钢龙骨净距不足",
        "impact_scope": "西立面入口玻璃肋全部驳接点（共12个）受影响，需逐一复核调整方案。不影响其他立面。",
        "is_duplicate": False,
        "exclude_from_summary": False,
        "source_minute_id": "MIN-001",
        "node_id": "MQ-002",
    },
    {
        "id": "COL-002",
        "title": "密封胶与型材相容性重复发现（图纸版本冲突）",
        "impact_scope": "南立面开启扇全部胶缝（约280米），且已送检批次与现场实装批次不一致，影响整个南立面施工进度安排。需复核图纸V2和V3版差异。",
        "is_duplicate": True,
        "exclude_from_summary": True,
        "source_minute_id": "MIN-002",
        "node_id": "MQ-003",
    },
]

CHANGE_RECORDS = [
    {
        "id": "CHG-001",
        "change_type": "结论改判",
        "conclusion_before": "推荐方案A（低模量硅酮密封胶）",
        "conclusion_after": "需补录后判断",
        "change_reason": "第二轮复核发现方案A所用批次密封胶与铝合金型材的相容性检测报告缺失，且图纸V2/V3版本标注不一致，需补录检测报告并重新核图后再判断。",
        "old_material_summary": "第一轮提交的比选材料：方案A低模量胶20年质保+相容性送检回执（非最终报告），方案B高模量胶15年质保无报告；成本对比方案A比方案B低约8%。",
        "new_note_content": "补录要求：1）6月11日前提交该批次胶与6063-T5铝合金型材的正式相容性试验报告；2）设计院出具图纸V2与V3版差异说明，确认最新版标注。",
        "change_time": "2026-06-09 16:20",
        "node_id": "MQ-003",
    },
]


def get_node(node_id):
    """按 ID 查找节点"""
    for n in NODES:
        if n["id"] == node_id:
            return n
    return None


def get_minutes(minutes_id):
    """按 ID 查找会议纪要"""
    for m in MEETING_MINUTES:
        if m["id"] == minutes_id:
            return m
    return None


def get_collision(collision_id):
    """按 ID 查找碰撞点"""
    for c in COLLISION_POINTS:
        if c["id"] == collision_id:
            return c
    return None


def get_change(change_id):
    """按 ID 查找变更记录"""
    for c in CHANGE_RECORDS:
        if c["id"] == change_id:
            return c
    return None
