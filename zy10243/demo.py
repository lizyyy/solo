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
    
    pretty_print("志愿者列表", {"volunteers": list(db.volunteers.values())})
    
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
    
    pretty_print("岗位列表", {"positions": list(db.positions.values())})
    
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
    
    pretty_print("当前岗位分配情况", {
        "医疗急救站": len([a for a in db.assignments.values() if a["position_id"] == medical_pos_id and a["status"] == "active"]),
        "观众引导": len([a for a in db.assignments.values() if a["position_id"] == guide_pos_id and a["status"] == "active"])
    })
    
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
    
    pretty_print("请假申请提交结果", leave_result)
    
    print("\n  📋 替补推荐说明:")
    for sub in leave_result["substitutes"]:
        print(f"    - {sub['name']}: {'已培训' if sub['is_trained'] else '未培训'}, 匹配技能{sub['match_skill_count']}个")
    
    print("\n  ❌ 说明为什么其他人不能替补:")
    print(f"    - 王五(未培训): 医疗急救站是关键岗位，未培训人员不能调剂")
    print(f"    - 李四: 已在医疗急救站岗位，不能重复分配")
    print(f"    - 钱七: 已在观众引导岗位，不能同时在两个岗位")
    
    print("\n✅ 步骤6: 批准请假并调剂赵六到医疗急救站")
    print("-" * 40)
    
    leave_id = leave_result["data"]["leave_id"]
    substitute_id = volunteer_ids[3]
    
    approve_result = approve_leave_and_reassign(leave_id, substitute_id)
    pretty_print("请假批准和调剂结果", approve_result)
    
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
    pretty_print("签到名单", roster_result)
    
    print("\n📜 步骤9: 查看操作历史记录")
    print("-" * 40)
    
    history_result = get_history()
    print(f"  共记录 {len(history_result['data'])} 条操作历史")
    for h in history_result["data"]:
        print(f"  - {h['timestamp'][:19]} | {h['action']:15} | {h['entity_type']:10} | {h['entity_id'][:8]}...")
    
    print("\n" + "="*60)
    print("🎉 演示完成！")
    print("="*60)
    print("\n📌 核心特性总结:")
    print("  ✅ 关键岗位只允许已培训人员")
    print("  ✅ 同一人不能同时在两个岗位")
    print("  ✅ 岗位有人数上限，防止超员")
    print("  ✅ 已请假人员不能签到")
    print("  ✅ 重复操作有幂等性保护")
    print("  ✅ 所有操作都有历史记录")
    print("  ✅ 失败时返回清晰的原因")
    print("  ✅ 请假时自动推荐合适替补")

if __name__ == "__main__":
    main()