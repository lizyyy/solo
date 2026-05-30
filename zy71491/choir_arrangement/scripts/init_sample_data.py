#!/usr/bin/env python3
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.database import SessionLocal, engine, Base
from app.models import Member, Absence, Rehearsal, SubstitutePool
from app.business.orchestrator import ArrangementOrchestrator


def init_sample_data():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    print("=" * 60)
    print("合唱缺勤补位排表 - 样例数据初始化")
    print("=" * 60)

    members_data = [
        {"name": "张小明", "voice_part": "soprano"},
        {"name": "李小红", "voice_part": "soprano"},
        {"name": "王小芳", "voice_part": "soprano"},
        {"name": "赵小娟", "voice_part": "soprano"},
        {"name": "陈小燕", "voice_part": "soprano"},
        {"name": "刘小英", "voice_part": "soprano"},
        {"name": "杨小燕", "voice_part": "alto"},
        {"name": "周小丽", "voice_part": "alto"},
        {"name": "吴小敏", "voice_part": "alto"},
        {"name": "郑小芳", "voice_part": "alto"},
        {"name": "孙小莉", "voice_part": "alto"},
        {"name": "马小英", "voice_part": "alto"},
        {"name": "朱小军", "voice_part": "tenor"},
        {"name": "胡小明", "voice_part": "tenor"},
        {"name": "何小强", "voice_part": "tenor"},
        {"name": "何小华", "voice_part": "tenor"},
        {"name": "郭大伟", "voice_part": "bass"},
        {"name": "林大勇", "voice_part": "bass"},
        {"name": "徐大强", "voice_part": "bass"},
        {"name": "徐大明", "voice_part": "bass"},
        {"name": "新人A", "voice_part": None},
        {"name": "新人B", "voice_part": None},
    ]

    print("\n【1】创建成员名单 (22人，含2名未分配声部)")
    members = []
    for m in members_data:
        member = Member(**m)
        db.add(member)
        db.flush()
        members.append(member)
    db.commit()
    print(f"  已创建 {len(members)} 名成员")

    print("\n【2】创建替补池")
    soprano_members = [m for m in members if m.voice_part == "soprano"]
    alto_members = [m for m in members if m.voice_part == "alto"]
    tenor_members = [m for m in members if m.voice_part == "tenor"]
    bass_members = [m for m in members if m.voice_part == "bass"]

    substitutes_data = [
        {"member_id": soprano_members[0].id, "voice_part": "soprano", "priority": 1},
        {"member_id": soprano_members[1].id, "voice_part": "alto", "priority": 0},
        {"member_id": alto_members[0].id, "voice_part": "soprano", "priority": 0},
        {"member_id": tenor_members[0].id, "voice_part": "tenor", "priority": 1},
        {"member_id": bass_members[0].id, "voice_part": "bass", "priority": 1},
    ]

    substitutes = []
    for s in substitutes_data:
        sub = SubstitutePool(**s)
        db.add(sub)
        db.flush()
        substitutes.append(sub)
    db.commit()
    print(f"  已创建 {len(substitutes)} 条替补记录")

    print("\n【3】创建3种排练场景")

    print("\n  场景A: 顺利流程 - 2026-06-01")
    rehearsal_a = Rehearsal(
        rehearsal_date="2026-06-01",
        difficulty=2,
        notes="常规排练",
        status="draft"
    )
    db.add(rehearsal_a)
    db.flush()

    absences_a = [
        Absence(member_id=soprano_members[2].id, rehearsal_date="2026-06-01", reason="感冒"),
        Absence(member_id=tenor_members[1].id, rehearsal_date="2026-06-01", reason="出差"),
    ]
    for a in absences_a:
        db.add(a)
    db.commit()
    print("    2人缺勤，声部平衡，替补可用")

    print("\n  场景B: 边界记录 - 2026-06-08")
    rehearsal_b = Rehearsal(
        rehearsal_date="2026-06-08",
        difficulty=3,
        notes="高难度曲目",
        status="draft"
    )
    db.add(rehearsal_b)
    db.flush()

    absences_b = [
        Absence(member_id=soprano_members[0].id, rehearsal_date="2026-06-08", reason="请假"),
        Absence(member_id=soprano_members[1].id, rehearsal_date="2026-06-08", reason="请假"),
        Absence(member_id=soprano_members[2].id, rehearsal_date="2026-06-08", reason="请假"),
        Absence(member_id=soprano_members[3].id, rehearsal_date="2026-06-08", reason="请假"),
        Absence(member_id=tenor_members[0].id, rehearsal_date="2026-06-08", reason="请假"),
        Absence(member_id=tenor_members[1].id, rehearsal_date="2026-06-08", reason="请假"),
        Absence(member_id=bass_members[0].id, rehearsal_date="2026-06-08", reason="请假"),
    ]
    for a in absences_b:
        db.add(a)
    db.commit()
    print("    7人缺勤，女高缺额严重，声部失衡")

    print("\n  场景C: 需人工补资料 - 2026-06-15")
    rehearsal_c = Rehearsal(
        rehearsal_date="2026-06-15",
        difficulty=1,
        notes="需要补全声部信息",
        status="draft"
    )
    db.add(rehearsal_c)
    db.flush()

    new_members = [m for m in members if m.voice_part is None]
    absences_c = [
        Absence(member_id=new_members[0].id, rehearsal_date="2026-06-15", reason="待确认"),
    ]
    for a in absences_c:
        db.add(a)
    db.commit()
    print("    新人缺勤但声部未分配")

    db.commit()

    print("\n【4】生成各场景排表结果")

    orchestrator = ArrangementOrchestrator(db)

    print("\n  --- 场景A 排表生成 ---")
    result_a = orchestrator.generate_arrangement("2026-06-01")
    print(f"    成功: {result_a['success']}")
    print(f"    缺勤人数: {result_a['absence_summary']['total_absences']}")
    print(f"    声部平衡: {'正常' if result_a['balance_result']['is_balanced'] else '失衡'}")
    print(f"    替补匹配: {len(result_a['substitute_result']['recommendations'])}")
    print(f"    是否需要人工: {result_a['needs_manual']}")

    print("\n  --- 场景B 排表生成 ---")
    result_b = orchestrator.generate_arrangement("2026-06-08")
    print(f"    成功: {result_b['success']}")
    print(f"    缺勤人数: {result_b['absence_summary']['total_absences']}")
    print("    声部问题:")
    for issue in result_b["balance_result"]["balance_issues"]:
        print(f"      - {issue.message}")

    print("\n  --- 场景C 排表生成 ---")
    result_c = orchestrator.generate_arrangement("2026-06-15")
    print(f"    成功: {result_c['success']}")
    print("    缺失数据:")
    for missing in result_c["missing_data"]:
        print(f"      - {missing['message']}")

    arrangement_data_a = []
    row = 1
    col = 1
    for voice, members_list in result_a["balance_result"]["voice_members"].items():
        for m in members_list:
            arrangement_data_a.append({
                "member_id": m["id"],
                "position_row": row,
                "position_col": col,
                "is_substitute": False,
                "is_manual": False
            })
            col += 1
            if col > 8:
                col = 1
                row += 1

    for rec in result_a["substitute_result"]["recommendations"]:
        if rec["recommended_substitutes"] and not rec.get("cross_voice"):
            sub = rec["recommended_substitutes"][0]
            arrangement_data_a.append({
                "member_id": sub["member_id"],
                "position_row": row,
                "position_col": col,
                "is_substitute": True,
                "substituted_for": rec["absent_member_id"],
                "is_manual": False
            })
            col += 1
            if col > 8:
                col = 1
                row += 1

    save_result = orchestrator.save_arrangement(rehearsal_a.id, arrangement_data_a, is_manual=False)
    print(f"\n  场景A排表已保存，{save_result['saved_count']}个站位，有冲突: {save_result['has_conflicts']}")

    db.close()

    print("\n" + "=" * 60)
    print("样例数据初始化完成！")
    print("=" * 60)
    print("\n测试接口地址: http://localhost:8000")
    print("API文档: http://localhost:8000/docs")
    print("\n场景说明:")
    print("  顺利流程: /arrangements/generate/1 - 正常排表")
    print("  边界记录: /arrangements/generate/2 - 声部严重失衡")
    print("  需人工补资料: /arrangements/generate/3 - 成员缺少声部信息")


if __name__ == "__main__":
    init_sample_data()
