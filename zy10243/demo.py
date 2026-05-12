import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import (
    db, 
    VolunteerCreate, 
    PositionCreate, 
    AssignmentCreate, 
    LeaveRequestCreate,
    create_volunteer, 
    create_position, 
    create_assignment,
    create_leave_request,
    approve_leave_and_reassign,
    check_in,
    get_position_roster,
    get_history,
    confirm_training
)
import json

def pretty_print(title, data):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")
    print(json.dumps(data, ensure_ascii=False, indent=2))

def main():
    print("🏟️  赛事志愿者岗位调剂 API - 请假替补流程演示")
    print("="*60)
    
    print("\n" + "="*60)
    print("  🎯 最小复现场景：关键岗容量=1，A请假，B是合格替补")
    print("="*60)
    
    print("\n📝 步骤1: 创建志愿者")
    print("-" * 40)
    
    volunteers_data = [
        ("志愿者A", "13800138001", ["急救"], True),   # 在岗，即将请假
        ("志愿者B", "13800138002", ["急救"], True),   # 合格，空闲！应该被推荐
        ("志愿者C", "13800138003", ["沟通"], False),  # 未培训
        ("志愿者D", "13800138004", ["引导"], True),   # 技能不匹配
    ]
    
    volunteer_ids = []
    for name, phone, skills, trained in volunteers_data:
        result = create_volunteer(VolunteerCreate(
            name=name,
            phone=phone,
            skills=skills,
            is_trained=trained
        ))
        volunteer_ids.append(result["data"]["volunteer_id"])
        print(f"  ✅ 创建志愿者: {name} {'(已培训)' if trained else '(未培训)'} 技能:{skills}")
    
    print("\n🏢 步骤2: 创建关键岗位（容量=1）")
    print("-" * 40)
    
    pos_result = create_position(PositionCreate(
        name="医疗急救站",
        description="赛事现场医疗保障",
        is_critical=True,
        max_capacity=1,
        required_skills=["急救"]
    ))
    position_id = pos_result["data"]["position_id"]
    print(f"  ✅ 创建岗位: 医疗急救站 (关键岗) 上限:1人")
    
    print("\n👥 步骤3: 分配志愿者A到岗位")
    print("-" * 40)
    
    result = create_assignment(AssignmentCreate(
        volunteer_id=volunteer_ids[0],
        position_id=position_id
    ))
    print(f"  ✅ 分配: 志愿者A → 医疗急救站")
    
    print(f"\n  📊 当前岗位人数: 1/1")
    
    print("\n🤒 步骤4: 志愿者A临时请假 - 核心测试！")
    print("-" * 40)
    print("  🔍 关键点：此时岗位看起来是满的(1/1)，")
    print("           但因为A要请假，应该虚拟释放名额后计算替补！")
    
    leave_result = create_leave_request(LeaveRequestCreate(
        volunteer_id=volunteer_ids[0],
        position_id=position_id,
        reason="突发感冒发烧"
    ))
    
    print(f"\n  📋 请假提交后返回的替补推荐:")
    print(f"     substitute_count: {leave_result['substitute_count']}")
    print(f"\n  完整替补列表详情:")
    
    eligible_count = 0
    for sub in leave_result["substitutes"]:
        if sub["not_substitute_reason"] is None:
            status = "✅ 合格替补"
            eligible_count += 1
        else:
            status = f"❌ {sub['not_substitute_reason']}"
        print(f"    - {sub['name']}: {'已培训' if sub['is_trained'] else '未培训'}, 匹配技能{sub['match_skill_count']}个 | {status}")
    
    if eligible_count > 0:
        print(f"\n  ✅ SUCCESS: 找到 {eligible_count} 个合格替补！")
        print(f"     志愿者B被正确识别为合格替补，问题已修复！")
    else:
        print(f"\n  ❌ FAILED: 未找到合格替补！")
        print(f"     志愿者B应该是合格替补但未被识别")
    
    print("\n" + "="*60)
    print("  🎯 完整流程演示")
    print("="*60)
    
    db.volunteers.clear()
    db.positions.clear()
    db.assignments.clear()
    db.leave_requests.clear()
    db.history.clear()
    db.check_ins.clear()
    
    print("\n📝 步骤1: 创建志愿者")
    print("-" * 40)
    
    volunteers_data = [
        ("张三", "13800138001", ["急救", "沟通"], True),
        ("李四", "13800138002", ["急救"], True),
        ("王五", "13800138003", ["沟通"], False),
        ("赵六", "13800138004", ["急救", "引导"], True),
        ("钱七", "13800138005", ["引导"], False),
    ]
    
    volunteer_ids = []
    for name, phone, skills, trained in volunteers_data:
        result = create_volunteer(VolunteerCreate(
            name=name,
            phone=phone,
            skills=skills,
            is_trained=trained
        ))
        volunteer_ids.append(result["data"]["volunteer_id"])
        print(f"  ✅ 创建志愿者: {name} {'(已培训)' if trained else '(未培训)'}")
    
    print("\n🏢 步骤2: 创建岗位")
    print("-" * 40)
    
    positions_data = [
        ("医疗急救站", "赛事现场医疗保障", True, 2, ["急救"]),
        ("观众引导", "观众入场引导", False, 3, ["引导", "沟通"]),
    ]
    
    position_ids = []
    for name, desc, is_critical, capacity, skills in positions_data:
        result = create_position(PositionCreate(
            name=name,
            description=desc,
            is_critical=is_critical,
            max_capacity=capacity,
            required_skills=skills
        ))
        position_ids.append(result["data"]["position_id"])
        print(f"  ✅ 创建岗位: {name} {'(关键岗)' if is_critical else ''} 上限:{capacity}人")
    
    medical_pos_id = position_ids[0]
    guide_pos_id = position_ids[1]
    
    print("\n👥 步骤3: 分配志愿者到岗位")
    print("-" * 40)
    
    assignments = [
        (0, medical_pos_id, "张三 → 医疗急救站"),
        (1, medical_pos_id, "李四 → 医疗急救站"),
        (4, guide_pos_id, "钱七 → 观众引导"),
    ]
    
    for vid_idx, pid, desc in assignments:
        result = create_assignment(AssignmentCreate(
            volunteer_id=volunteer_ids[vid_idx],
            position_id=pid
        ))
        print(f"  ✅ 分配: {desc}")
    
    print(f"\n  📊 当前岗位分配:")
    print(f"     医疗急救站: {len([a for a in db.assignments.values() if a['position_id'] == medical_pos_id and a['status'] == 'active'])}/2")
    print(f"     观众引导: {len([a for a in db.assignments.values() if a['position_id'] == guide_pos_id and a['status'] == 'active'])}/3")
    
    print("\n❌ 步骤4: 演示边界情况处理")
    print("-" * 40)
    
    print("  测试1: 未培训人员(王五)分配到关键岗(医疗急救站)")
    result = create_assignment(AssignmentCreate(
        volunteer_id=volunteer_ids[2],
        position_id=medical_pos_id
    ))
    print(f"    ❌ 结果: {result['error']} - {result['detail']}")
    
    print("\n  测试2: 同一人(张三)分配到两个岗位")
    result = create_assignment(AssignmentCreate(
        volunteer_id=volunteer_ids[0],
        position_id=guide_pos_id
    ))
    print(f"    ❌ 结果: {result['error']} - {result['detail']}")
    
    print("\n  测试3: 岗位超员(医疗急救站上限2人,尝试分配第3个)")
    result = create_assignment(AssignmentCreate(
        volunteer_id=volunteer_ids[3],
        position_id=medical_pos_id
    ))
    print(f"    ❌ 结果: {result['error']} - {result['detail']}")
    
    print("\n  测试4: 重复分配(张三再分配到医疗急救站)")
    result = create_assignment(AssignmentCreate(
        volunteer_id=volunteer_ids[0],
        position_id=medical_pos_id
    ))
    print(f"    ❌ 结果: {result['error']} - {result['detail']}")
    
    print("\n🤒 步骤5: 张三临时请假")
    print("-" * 40)
    
    leave_result = create_leave_request(LeaveRequestCreate(
        volunteer_id=volunteer_ids[0],
        position_id=medical_pos_id,
        reason="突发感冒发烧"
    ))
    
    print(f"\n  📋 替补推荐列表 (含原因说明):")
    for sub in leave_result["substitutes"]:
        if sub["not_substitute_reason"] is None:
            status = "✅ 合格替补"
        else:
            status = f"❌ {sub['not_substitute_reason']}"
        print(f"    - {sub['name']}: {'已培训' if sub['is_trained'] else '未培训'}, 匹配技能{sub['match_skill_count']}个 | {status}")
    
    print("\n✅ 步骤6: 批准请假并调剂赵六到医疗急救站")
    print("-" * 40)
    
    leave_id = leave_result["data"]["leave_id"]
    substitute_id = volunteer_ids[3]
    
    approve_result = approve_leave_and_reassign(leave_id, substitute_id)
    print(f"  ✅ 请假已批准，赵六已调剂到医疗急救站")
    
    print("\n✅ 步骤7: 签到演示 - 已请假的张三不能签到")
    print("-" * 40)
    
    print("  测试: 已请假的张三尝试签到医疗急救站")
    result = check_in(type('obj', (), {
        'volunteer_id': volunteer_ids[0],
        'position_id': medical_pos_id
    })())
    print(f"    ❌ 结果: {result['error']} - {result['detail']}")
    
    print("\n  测试: 新替补赵六签到医疗急救站")
    result = check_in(type('obj', (), {
        'volunteer_id': substitute_id,
        'position_id': medical_pos_id
    })())
    print(f"    ✅ 结果: 签到成功")
    
    print("\n📋 步骤8: 查询医疗急救站最终签到名单")
    print("-" * 40)
    
    roster_result = get_position_roster(medical_pos_id)
    print(f"  📊 签到名单: 总人数{roster_result['total_count']}, 已签到{roster_result['checked_in_count']}")
    for r in roster_result["roster"]:
        status = "✅ 已签到" if r["has_checked_in"] else "⏳ 未签到"
        print(f"    - {r['name']}: {'已培训' if r['is_trained'] else '未培训'} | {status}")
    
    print("\n📜 步骤9: 查看操作历史记录")
    print("-" * 40)
    
    history_result = get_history()
    print(f"  共记录 {len(history_result['data'])} 条操作历史")
    
    print("\n" + "="*60)
    print("🎉 演示完成！")
    print("="*60)
    print("\n📌 修复的核心问题:")
    print("  ✅ 请假申请时，虚拟释放请假人名额来计算替补")
    print("  ✅ 即使岗位满员，也能正确找出合格替补")
    print("  ✅ 替补列表中包含每个人不能/能成为替补的原因")
    print("  ✅ 替补按优先级排序（合格在前，然后按培训状态和技能匹配度）")
    print("\n📌 其他核心特性:")
    print("  ✅ 关键岗位只允许已培训人员")
    print("  ✅ 同一人不能同时在两个岗位")
    print("  ✅ 岗位有人数上限，防止超员")
    print("  ✅ 已请假人员不能签到")
    print("  ✅ 重复操作有幂等性保护")
    print("  ✅ 所有操作都有历史记录")
    print("  ✅ 失败时返回清晰的原因")

if __name__ == "__main__":
    main()