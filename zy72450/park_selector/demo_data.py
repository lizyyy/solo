from .processor import ParkSiteSelector
from .models import RecordStatus


DEMO_SITES = [
    {
        "id": "site-001",
        "site_name": "幸福小区南侧绿地",
        "address": "幸福路123号南侧",
        "area_sqm": 850.0,
        "accessibility_ramp": {
            "id": "ramp-001",
            "location": "幸福路入口处",
            "has_ramp": True,
            "notes": "坡道坡度适中，轮椅可通行"
        },
        "opinions": [
            {
                "id": "op-001",
                "resident_name": "张大妈",
                "address": "幸福小区3号楼",
                "summary": "希望多放些休息长椅，方便老人聊天",
                "original_text": "我每天都要带小孙子出来玩，这块地要是能改成公园就太好了！能不能多放几条长椅啊？我们这些老头老太太累了能坐下来歇会儿，聊聊天。最好能有个遮阳的地方，夏天太晒了。",
                "status": "完整"
            },
            {
                "id": "op-002",
                "resident_name": "李先生",
                "address": "幸福小区5号楼",
                "summary": "建议增加健身器材",
                "original_text": "作为一个上班族，平时下班了想锻炼一下，家附近要是有个小公园就方便多了。建议装一些单杠、漫步机之类的健身器材，满足我们年轻人的需求。",
                "status": "完整"
            }
        ],
        "source": "日间走访",
        "status": "正常"
    },
    {
        "id": "site-002",
        "site_name": "和平里街角空地",
        "address": "和平街与建设路交叉口西北角",
        "area_sqm": 520.0,
        "accessibility_ramp": {
            "id": "ramp-002",
            "location": "和平街一侧",
            "has_ramp": False,
            "notes": "当前为台阶入口，需改造"
        },
        "opinions": [
            {
                "id": "op-003",
                "resident_name": "王阿姨",
                "address": "和平里2号楼",
                "summary": "居民普遍支持建口袋公园，反映无噪音问题",
                "original_text": "",
                "status": "完整"
            },
            {
                "id": "op-004",
                "resident_name": "赵师傅",
                "address": "和平里4号楼",
                "summary": "担心停车问题，建议不要占用现有停车位",
                "original_text": "这块地旁边本来就不好停车，要是改成公园的话，停车的地方更少了。能不能考虑一下我们有车一族的需求？公园我是支持的，但别把我们的停车位占了。",
                "status": "完整"
            }
        ],
        "source": "日间走访",
        "status": "正常"
    },
    {
        "id": "site-003",
        "site_name": "阳光社区东侧废弃花池",
        "address": "阳光大道456号东侧",
        "area_sqm": 680.0,
        "accessibility_ramp": {
            "id": "ramp-003",
            "location": "阳光大道入口",
            "has_ramp": True,
            "notes": "原有坡道完好"
        },
        "opinions": [
            {
                "id": "op-005",
                "resident_name": "陈奶奶",
                "address": "阳光社区1号楼",
                "summary": "支持改建，希望种些花草",
                "original_text": "这地方荒了好多年了，太可惜了！改成公园多好啊，种点花花草草的，看着也舒服。我年纪大了，也走不远，家门口有个小公园就知足了。",
                "status": "完整"
            }
        ],
        "source": "日间走访",
        "status": "正常"
    }
]


DEMO_NIGHT_POINTS = [
    {
        "id": "night-001",
        "location": "阳光社区门口采样点",
        "sampling_time": "2024-06-15 21:30",
        "old_criteria_data": "按2018年旧口径测算，阳光社区东侧地块实际可用面积为580平米，比日间测量少100平米，因东侧围墙外有2米宽的市政管线通道不能占用",
        "notes": "夜班志愿者小周提供，是之前老书记手上遗留的旧数据",
        "linked_site_id": "site-003"
    },
    {
        "id": "night-002",
        "location": "幸福小区夜宵摊聚集点",
        "sampling_time": "2024-06-15 22:15",
        "old_criteria_data": None,
        "notes": "夜间人流较大，主要是夜宵摊顾客，未收集到反对意见",
        "linked_site_id": None
    }
]


def run_full_demo(state_file: str = "park_state.json"):
    print("=" * 60)
    print("  社区口袋公园选址 - 完整演示流程")
    print("  交通协管老马带你走一遍")
    print("=" * 60)
    print()

    selector = ParkSiteSelector("阳光街道口袋公园选址演示项目")

    print("【第一步】导入日间走访的选址记录")
    print("-" * 50)
    imported, flagged = selector.import_sites(DEMO_SITES)
    print(f"导入了 {imported} 条选址记录")
    print(f"其中 {flagged} 条标记为需复核（居民意见只剩汇总无原文）")
    print()

    print("【第二步】查看导入结果，注意三种不同情况")
    print("-" * 50)
    for i, site in enumerate(selector.state.sites, 1):
        print(f"{i}. [{site.status.value}] {site.site_name}")
        print(f"   数据来源: {site.source.value}")
        if site.review_notes:
            print(f"   👉 {site.review_notes}")
        for j, op in enumerate(site.opinions, 1):
            status_icon = "✅" if op.status.value == "完整" else "⚠️"
            print(f"   {status_icon} 意见{j}: [{op.status.value}] {op.resident_name} - {op.summary}")
            if op.original_text:
                print(f"      原文: {op.original_text[:50]}...")
            else:
                print(f"      原文: (空，只剩汇总)")
        print()

    print("【第三步】老马深夜值守，补录夜间采样点数据")
    print("-" * 50)
    imported, conflicts = selector.import_night_sampling(DEMO_NIGHT_POINTS)
    print(f"导入了 {imported} 个夜间采样点")
    print(f"发现 {conflicts} 个冲突，已自动加入冲突复核表")
    print()

    print("【第四步】查看冲突复核表（补录夜间数据后自动更新）")
    print("-" * 50)
    for item in selector.get_conflict_review():
        print(f"[{item.status}] {item.id} - {item.conflict_type}")
        print(f"  选址点: {item.site_name}")
        print(f"  说明: {item.description}")
        print(f"  变更: {item.source_before} → {item.source_after}")
        if item.conflict_type == "口径差异":
            site = selector._find_site_by_id(item.site_id)
            if site:
                print(f"  冲突备注: {site.conflict_notes}")
    print()

    print("【第五步】老马发现site-002面积录入有误，进行人工修正")
    print("-" * 50)
    selector.manual_correct(
        "site-002",
        {"area_sqm": 560.0, "review_notes": "老马现场复测，实际面积比之前多40平米"},
        handler="老马"
    )
    print("人工修正完成！修正内容:")
    site2 = selector._find_site_by_id("site-002")
    print(f"  和平里街角空地面积: 520 → {site2.area_sqm} 平米")
    print(f"  复核备注: {site2.review_notes}")
    print()

    print("【第六步】重跑一次所有检查，看看最新状态")
    print("-" * 50)
    summary = selector.rerun()
    print("重跑结果:")
    print(f"  总记录数: {summary['total_sites']}")
    print(f"  正常/已解决: {summary['normal']}")
    print(f"  需书记复核: {summary['needs_review']}")
    print(f"  有冲突: {summary['conflicts']}")
    print(f"  夜间采样点: {summary['night_points']}")
    print(f"  冲突复核条目: {summary['conflict_review_items']}")
    print()

    print("【第七步】重点关注：待书记复核的记录")
    print("-" * 50)
    need_review = selector.get_sites_need_review()
    if need_review:
        for site in need_review:
            print(f"⚠️  {site.site_name}")
            print(f"   原因: {site.review_notes}")
            print(f"   涉及居民意见:")
            for op in site.opinions:
                if op.status.value == "只剩汇总无原文":
                    print(f"   - {op.resident_name}: {op.summary}")
                    print(f"     (原文缺失，待书记确认是否采信汇总意见)")
    else:
        print("暂无待复核记录")
    print()

    print("【总结】三种处理结果对比:")
    print("-" * 50)
    print("1. ✅ site-001 幸福小区南侧绿地 - 顺利记录")
    print("   · 居民意见完整，无障碍坡道齐全")
    print("   · 状态: 正常，可进入下一流程")
    print()
    print("2. ⚠️  site-002 和平里街角空地 - 待书记复核")
    print("   · 王阿姨的意见只剩汇总没有原文")
    print("   · 状态: 需复核，留给社区书记拍板")
    print("   · 老马已做了人工修正（面积520→560平米）")
    print()
    print("3. 🔄 site-003 阳光社区东侧废弃花池 - 有冲突")
    print("   · 夜间采样点补录了旧口径数据")
    print("   · 面积680平米 vs 旧口径580平米，差了100平")
    print("   · 状态: 有冲突，已记录在冲突复核表")
    print()

    selector.save_state(state_file)
    print(f"💾 演示数据已保存到: {state_file}")
    print()
    print("=" * 60)
    print("  演示完毕！老马说：")
    print("  『记住喽，居民意见没原文的别瞎拍板，留给书记！")
    print("   夜间采样点一来，以前的结论就得重新看，")
    print("   所有改动都在冲突复核表里记着，谁也赖不掉。』")
    print("=" * 60)
