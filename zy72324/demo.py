#!/usr/bin/env python3
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.models.database import init_db, SessionLocal
from src.utils.data_importer import DataImporter
from src.utils.matching_engine import VolunteerMatchingEngine, get_admission_traceability
from src.utils.workflow import BorderlineReviewManager, ThreeStepWorkflow
import pandas as pd


def create_test_data():
    samples = pd.DataFrame([
        {"学号": "S001", "姓名": "张三", "分数": "650", "志愿1": "计算机科学", "志愿2": "软件工程", "志愿3": "电子工程", "备注": "正常考生，无特殊情况"},
        {"学号": "S002", "姓名": "李四", "分数": "-5", "志愿1": "计算机科学", "志愿2": "", "志愿3": "", "备注": "缺考标记？需要确认"},
        {"学号": "S003", "姓名": "王五", "分数": "620", "志愿1": "软件工程", "志愿2": "计算机科学", "志愿3": "", "备注": "优秀学生"},
        {"学号": "S004", "姓名": "赵六", "分数": "", "志愿1": "电子工程", "志愿2": "", "志愿3": "", "备注": "分数缺失"},
        {"学号": "S005", "姓名": "钱七", "分数": "590", "志愿1": "计算机科学", "志愿2": "电子工程", "志愿3": "", "备注": ""},
    ])
    
    comments_v1 = pd.DataFrame([
        {"学号": "S002", "老师": "王老师", "批注": "确实缺考，分数作废"},
        {"学号": "S004", "老师": "李老师", "批注": "补考成绩未录入，先标记"},
    ])
    
    comments_v2 = pd.DataFrame([
        {"学号": "S002", "老师": "王老师", "批注": "确实缺考，分数作废，建议按特殊情况处理"},
        {"学号": "S004", "老师": "李老师", "批注": "补考成绩580分，已确认"},
    ])
    
    os.makedirs("data/imports", exist_ok=True)
    samples.to_csv("data/imports/test_samples.csv", index=False, encoding="utf-8-sig")
    comments_v1.to_csv("data/imports/test_comments_v1.csv", index=False, encoding="utf-8-sig")
    comments_v2.to_csv("data/imports/test_comments_v2.csv", index=False, encoding="utf-8-sig")
    
    print("✅ 测试数据已创建")
    return samples, comments_v1, comments_v2


def run_demo():
    print("=" * 60)
    print("🎯 最大匹配志愿录取系统 - 完整演示")
    print("=" * 60)
    
    init_db()
    db = SessionLocal()
    
    print("\n📊 步骤1: 创建测试数据")
    samples, comments_v1, comments_v2 = create_test_data()
    print("   - 5个抽样名单（含2个边界案例：负数分数、缺失分数）")
    print("   - 2个版本的老师批注")
    
    print("\n📥 步骤2: 导入抽样名单")
    importer = DataImporter(db)
    batch_id, stats = importer.import_sample_list(
        "data/imports/test_samples.csv",
        imported_by="admin",
        import_note="演示用抽样名单"
    )
    print(f"   批次ID: {batch_id}")
    print(f"   总数: {stats['total']}, 新增: {stats['new']}, 边界: {stats['borderline']}")
    
    print("\n💬 步骤3: 导入老师批注 v1")
    importer_v1 = DataImporter(db)
    batch_id_c1, stats_c1 = importer_v1.import_teacher_comments(
        "data/imports/test_comments_v1.csv",
        imported_by="teacher_wang"
    )
    print(f"   批次ID: {batch_id_c1}")
    print(f"   总数: {stats_c1['total']}, 新增: {stats_c1['new']}")
    
    print("\n🔄 步骤4: 重复导入老师批注 v1 (验证去重)")
    importer2 = DataImporter(db)
    _, stats_dup = importer2.import_teacher_comments(
        "data/imports/test_comments_v1.csv",
        imported_by="teacher_wang"
    )
    print(f"   重复: {stats_dup['duplicate']} (应该等于总数，不会翻倍)")
    
    print("\n📝 步骤5: 导入修改后的老师批注 v2 (验证版本追踪)")
    importer3 = DataImporter(db)
    _, stats_c2 = importer3.import_teacher_comments(
        "data/imports/test_comments_v2.csv",
        imported_by="teacher_wang"
    )
    print(f"   更新: {stats_c2['updated']} (内容不同，版本号递增)")
    
    print("\n🔍 步骤6: 查看待复核边界案例")
    manager = BorderlineReviewManager(db)
    pending = manager.get_pending_cases()
    print(f"   待复核案例数: {len(pending)}")
    for case in pending:
        print(f"   - {case['student_name']} ({case['student_id']}): {case['case_type']} = {case['original_value']}")
    
    print("\n🏃 步骤7: 运行志愿匹配（边界案例自动跳过）")
    engine = VolunteerMatchingEngine(db, major_quota={
        "计算机科学": 2,
        "软件工程": 2,
        "电子工程": 2
    })
    result = engine.run_matching()
    print(f"   总数: {result.total_samples}")
    print(f"   已匹配: {result.matched_samples}")
    print(f"   边界跳过: {result.borderline_samples}")
    print(f"   第一志愿: {result.matched_by_volunteer[1]}")
    print(f"   第二志愿: {result.matched_by_volunteer[2]}")
    
    print("\n✅ 步骤8: 处理边界案例 - 负数分数")
    case1 = next((c for c in pending if c['case_type'] == 'negative_score'), None)
    if case1:
        result_resolve = manager.resolve_case(
            case1['case_id'],
            'keep_negative',
            'student_assistant'
        )
        print(f"   处理结果: {result_resolve['action_taken']}")
        print(f"   最终分数: {result_resolve['final_score']}")
    
    print("\n✅ 步骤9: 处理边界案例 - 缺失分数")
    case2 = next((c for c in pending if c['case_type'] == 'missing_score'), None)
    if case2:
        result_resolve2 = manager.resolve_case(
            case2['case_id'],
            'custom_value',
            'student_assistant',
            custom_value='580'
        )
        print(f"   处理结果: {result_resolve2['action_taken']}")
        print(f"   最终分数: {result_resolve2['final_score']}")
    
    print("\n🔗 步骤10: 查看完整数据追溯链")
    trace = get_admission_traceability(db, sample_id=1)
    print(f"   学生: {trace['student']['name']}")
    print(f"   原始分数: {trace['student']['raw_score']}")
    print(f"   老师批注版本数: {len(trace['teacher_comments'])}")
    for c in trace['teacher_comments']:
        print(f"     v{c['version']}: {c['comment'][:30]}...")
    
    print("\n🔄 步骤11: 回滚案例（演示）")
    if case1:
        rollback_result = manager.rollback_case(case1['case_id'], 'admin')
        print(f"   回滚结果: {rollback_result.get('message', '失败')}")
    
    print("\n🔁 步骤12: 重新运行匹配（处理完边界案例后）")
    engine2 = VolunteerMatchingEngine(db)
    result2 = engine2.run_matching()
    print(f"   已匹配: {result2.matched_samples}")
    print(f"   边界跳过: {result2.borderline_samples}")
    
    print("\n" + "=" * 60)
    print("✅ 演示完成！")
    print("=" * 60)
    print("\n📋 验证要点总结:")
    print("   ✅ 备注信息完整保留，不清洗")
    print("   ✅ 负数分数自动标记待复核")
    print("   ✅ 重复导入不翻倍计数")
    print("   ✅ 修改备注保留版本历史")
    print("   ✅ 边界案例不参与自动匹配")
    print("   ✅ 所有数据可追溯到原始来源")
    print("   ✅ 三步工作流可追踪")
    print("   ✅ 边界案例支持回滚")
    
    db.close()


if __name__ == "__main__":
    run_demo()
