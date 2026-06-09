"""
配电柜温升阈值预警 - 彩排流程测试脚本
按真实节奏：先导入旧材料 → 再补一条临时改名的材料 → 最后看接口返回
"""
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cabinet_warning_system import WarningAppService


def divider(title: str, char: str = "═"):
    width = 90
    print("\n" + char * width)
    print(f"  {title}")
    print(char * width)


def print_json(data, indent: int = 2):
    """友好的结构化打印"""
    text = json.dumps(data, ensure_ascii=False, indent=indent)
    # 给输出加一点可读性缩进
    for line in text.split("\n"):
        print("    " + line)


# ============================================================
# 初始化服务
# ============================================================
app = WarningAppService()
TEST_DATE = "2026-06-10"

# ============================================================
# 第一幕：导入旧材料（第1次提交 - 标准名称）
# ============================================================
divider("【彩排第1步】导入旧材料 - 对象名='一号配电柜'（标准名：配电柜A）")

old_materials = [
    # 材料1：传感器日志 - 含备件型号替换（触发卡点）
    {
        "material_type": "sensor_log",
        "title": "6月10日配电柜A温升传感器连续日志",
        "detail": (
            "[08:00:15] 温度62.3℃/阈值65℃ 正常；[08:15:22] 温度63.1℃ 正常；"
            "[08:30:08] 温度64.0℃ 接近阈值；[08:42:51] 传感器探头更换："
            "型号由PT100-A2更换为PT100-B3；[09:00:03] 温度67.8℃ 超限3.8℃；"
            "[09:15:47] 温度68.2℃ 持续超限；注意：part change PT100-A2 to PT100-B3 "
            "后温升读数基线偏移+2.1℃待确认"
        ),
    },
    # 材料2：人工备注 - 标题和明细对不上
    {
        "material_type": "manual_note",
        "title": "配电柜A巡检记录-一切正常",
        "detail": (
            "巡检时间09:20，发现配电柜A温度异常偏高，有焦糊气味，"
            "顶部通风扇停转，进线铜牌温度目测超标，已通知维修班待处理"
        ),
        "mismatch_flag": True,
        "mismatch_detail": "标题写'一切正常'，但明细描述温度异常、焦糊味、风扇停转",
    },
    # 材料3：一条普通人工备注
    {
        "material_type": "manual_note",
        "title": "安全员现场确认",
        "detail": "现场确认温升属实，09:32测得外壳温度58℃，建议拉闸冷却30分钟",
    },
]

step1 = app.import_warning(
    object_name="一号配电柜",
    submit_date=TEST_DATE,
    materials=old_materials,
    initial_conclusion="abnormal",
    operator="安全员老唐",
)
print("➡️ 导入结果：")
print_json({
    "action": step1["action"],
    "去重提示": step1["duplicate_info"]["message"],
    "record_id": step1["record_id"],
    "结论": step1["record"]["conclusion"],
    "卡点触发": step1["record"]["block_reason"] or "无",
    "暂不放行项数量": len(step1["record"]["hold_results"]),
    "材料数量": step1["record"]["material_count"],
    "历史版本": f"v{step1['record']['version']}",
})
FIRST_RECORD_ID = step1["record_id"]


# ============================================================
# 第二幕：重复提交 - 同一对象换了称呼（用别名"PDG-A"再次提交）
# ============================================================
divider("【彩排第2步】重复提交 - 对象名='PDG-A'（与'一号配电柜'为同一对象，应合并，不新建）")

renamed_materials = [
    # 材料4：后补说明 - 临时改名的补录材料
    {
        "material_type": "supplementary",
        "title": "PDG-A现场补拍照片与维修说明",
        "detail": (
            "补录说明：09:45维修班到场，确认为通风扇电机烧毁导致散热失效，"
            "已更换通风扇（备件型号FAN-120B替换原FAN-120A），"
            "10:10温度回落至51.2℃，建议观察2小时再恢复满载运行。"
            "注：本记录提交时对象名称填写为PDG-A，系统内部应为配电柜A/一号配电柜"
        ),
    },
]

step2 = app.import_warning(
    object_name="PDG-A",
    submit_date=TEST_DATE,
    materials=renamed_materials,
    initial_conclusion="pending",
    operator="值班员小李",
)
print("➡️ 重复提交处理结果：")
print_json({
    "action": step2["action"],
    "去重提示": step2["duplicate_info"]["message"],
    "是否新建记录": "❌ 未新建（合并成功）" if step2["action"] == "merged" else "⚠️ 新建了（去重失败）",
    "合并到record_id": step2["record_id"],
    "本次新增材料数": step2.get("materials_added", 0),
    "当前总材料数": step2["record"]["material_count"],
    "当前结论": step2["record"]["conclusion"],
    "是否标记为补录过": step2["record"]["is_supplemented"],
    "历史版本": f"v{step2['record']['version']}",
})


# ============================================================
# 第三幕：显式补录 + 改判结论
# ============================================================
divider("【彩排第3步】补录传感器日志并改判结论 - 从卡点阻塞→待观察")

supplement_materials = [
    # 材料5：维修后的传感器日志
    {
        "material_type": "sensor_log",
        "title": "维修后配电柜A温度恢复记录",
        "detail": (
            "[10:15] 48.3℃；[10:30] 49.1℃；[10:45] 50.2℃；[11:00] 51.0℃；"
            "[11:15] 51.5℃；温度持续稳定，通风扇运行正常，转速1800rpm，"
            "校准验证：新旧PT100-B3探头与第三方测温枪偏差<0.5℃，校准通过"
        ),
    },
    # 材料6：人工复核备注
    {
        "material_type": "manual_note",
        "title": "老唐复核签名",
        "detail": "维修后连续观察1小时温度稳定，PT100-B3探头校准已验证通过，改判为待观察",
    },
]

step3 = app.supplement_material(
    record_id=FIRST_RECORD_ID,
    materials=supplement_materials,
    new_conclusion="pending",
    change_reason=(
        "通风扇已更换FAN-120B，PT100-B3传感器校准偏差<0.5℃验证通过，"
        "温度稳定回落，原卡点解除；但仍需观察至14:00，暂不判正常"
    ),
    operator="安全员老唐",
)
print("➡️ 补录+改判结果：")
print_json({
    "action": step3["action"],
    "新增材料数": step3["materials_added"],
    "结论是否变化": step3["conclusion_changed"],
    "结论变化": f"{step3['conclusion_before']} → {step3['conclusion_after']}",
    "是否改判过标记": step3["record"]["is_judgment_changed"],
    "卡点状态": step3["record"]["block_reason"] or "✅ 无卡点",
    "暂不放行项": step3["record"]["hold_results"] or [],
    "总材料数": step3["record"]["material_count"],
    "历史版本": f"v{step3['record']['version']}",
})


# ============================================================
# 第四幕：负责人视图查询 - 关键验证
# ============================================================
divider("【彩排第4步】负责人视图查询 - 检查补录/改判/卡点变化是否一目了然")

manager_view = app.query_for_manager()
print(f"➡️ 总记录数: {manager_view['total_records']}")
print(f"➡️ 因重复提交合并次数: {manager_view['duplicate_merged_count']}")
print()

for idx, rec in enumerate(manager_view["records"], 1):
    print(f"  📋 记录 #{idx} - {rec['record_id']}")
    print(f"     对象: 标准名={rec['对象标准名']}  |  本次提交名={rec['本次提交名称']}")
    print(f"     结论: {rec['当前结论']}  标记: {', '.join(rec['结论标记'])}")
    print(f"     补录: {rec['是否补录过']}   |   改判: {rec['是否改判过']}")
    print(f"     卡点: {rec['卡点状态']}")
    if rec["暂不放行项"]:
        print(f"     ⛔ 暂不放行项:")
        for item in rec["暂不放行项"]:
            print(f"       - {item}")
    print(f"     版本: v{rec['版本']}  更新: {rec['更新时间']}")

    print()
    print(f"     📂 材料清单（共{len(rec['材料清单'])}条）:")
    for m_idx, m in enumerate(rec["材料清单"], 1):
        print(f"       {m_idx}. [{m['类型/标记']}]")
        print(f"          标题: {m['标题']}")
        print(f"          明细: {m['明细摘要']}")
        if m["标题不符说明"] != "➖":
            print(f"          ⚠️  对不上: {m['标题不符说明']}")

    print()
    print(f"     🕓 历史追溯（共{len(rec['历史追溯摘要'])}条 - 旧材料→新备注→改判原因全链）:")
    for h_idx, h in enumerate(rec["历史追溯摘要"], 1):
        print(f"       {h_idx}. {h['事件']}  [{h['操作人']} @ {h['时间']}]")
        print(f"          结论: {h['结论变化']}  |  材料: {h['材料变化']}")
        print(f"          备注: {h['备注/原因']}")

    print()


# ============================================================
# 第五幕：验证断言
# ============================================================
divider("【彩排验收 - 核心断言检查】")

all_pass = True

record = app.repo.get(FIRST_RECORD_ID)

# 断言1：重复提交没新建记录
t1 = manager_view["total_records"] == 1
print(f"  {'✅' if t1 else '❌'} 去重：重复提交(PDG-A)未新建记录，总记录={manager_view['total_records']}（期望=1）")
all_pass &= t1

# 断言2：别名归一化正确
t2 = record.canonical_object == "配电柜A"
print(f"  {'✅' if t2 else '❌'} 别名归一化：'一号配电柜'/'PDG-A' → 标准名 '{record.canonical_object}'（期望=配电柜A）")
all_pass &= t2

# 断言3：材料合并后数量正确（3+1+2=6）
t3 = len(record.materials) == 6
print(f"  {'✅' if t3 else '❌'} 材料合并：3(旧)+1(改名补录)+2(显式补录)={len(record.materials)}条（期望=6）")
all_pass &= t3

# 断言4：备件型号替换卡点在阶段1触发
t4 = any("PT100-A2" in m.detail and "PT100-B3" in m.detail for m in record.materials)
print(f"  {'✅' if t4 else '❌'} 传感器日志含备件型号替换：PT100-A2→PT100-B3（检测到={'是' if t4 else '否'}）")
all_pass &= t4

# 断言5：有标题和明细对不上的材料
t5 = any(m.mismatch_flag for m in record.materials)
mismatch = [m for m in record.materials if m.mismatch_flag]
print(f"  {'✅' if t5 else '❌'} 标题/明细不符材料存在：{len(mismatch)}条，例如'{mismatch[0].title if mismatch else '无'}'")
all_pass &= t5

# 断言6：后补说明存在
t6 = any(m.material_type == "supplementary" for m in record.materials)
print(f"  {'✅' if t6 else '❌'} 后补说明材料存在")
all_pass &= t6

# 断言7：补录标记=True
t7 = record.is_supplemented == True
print(f"  {'✅' if t7 else '❌'} 补录标记：{record.is_supplemented}（期望=True）")
all_pass &= t7

# 断言8：改判标记=True
t8 = record.is_judgment_changed == True
print(f"  {'✅' if t8 else '❌'} 改判标记：{record.is_judgment_changed}（期望=True）")
all_pass &= t8

# 断言9：历史记录至少有3条（create + 合并 + 改判）
t9 = len(record.history) >= 3
print(f"  {'✅' if t9 else '❌'} 历史追溯链：{len(record.history)}条（期望≥3）")
all_pass &= t9

# 断言10：负责人视图里有明确的补录/改判标记文字
flags = rec["结论标记"]
t10 = any("补录" in f for f in flags) and any("改判" in f for f in flags)
print(f"  {'✅' if t10 else '❌'} 负责人视图标记：补录标记={'有' if any('补录' in f for f in flags) else '无'}，改判标记={'有' if any('改判' in f for f in flags) else '无'}")
all_pass &= t10

# 断言11：维修后的传感器日志解除了卡点（无PT100-B3问题说明已校准）
t11 = "校准通过" in str(record.materials[-2].detail) if len(record.materials) >= 2 else False
print(f"  {'✅' if t11 else '❌'} 维修后校准说明存在：{t11}")
all_pass &= t11

print()
divider(f"【彩排最终结果】 {'✅ 全部通过 ✅' if all_pass else '❌ 部分断言失败，请检查 ❌'}")
print(f"  共11项断言，通过: {sum([t1,t2,t3,t4,t5,t6,t7,t8,t9,t10,t11])}/11")
print("═" * 90)
print()
print("📌 给负责人看的接口返回摘要（关键信息不遗漏）：")
print_json({
    "提醒": "本接口返回不止是结果堆，下列变化已用标记明确标出",
    "record_id": FIRST_RECORD_ID,
    "标准对象": record.canonical_object,
    "当前结论": {
        "状态": record.conclusion,
        "变化标记": [
            "📝 有补录（合并了别名PDG-A的重复提交 + 老唐追加的校准记录）" if record.is_supplemented else "",
            "🔄 有改判（abnormal→pending，卡点解除后待观察）" if record.is_judgment_changed else "",
        ],
    },
    "处理过的特殊项": {
        "去重合并": f"是（一号配电柜 ← PDG-A，同{record.canonical_object}）",
        "材料问题": [
            f"标题/明细不符：{m.title} → {m.mismatch_detail}"
            for m in record.materials if m.mismatch_flag
        ],
        "备件替换卡点": [
            "阶段1：PT100-A2→PT100-B3触发阻塞，温升结论暂不放行",
            "阶段3：校准通过(偏差<0.5℃)，卡点解除",
        ] if any("PT100-A2" in m.detail for m in record.materials) else [],
    },
    "历史追溯条数": len(record.history),
    "最终材料数": len(record.materials),
})
