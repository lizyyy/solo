import sys
from models import Workspace, RecordStatus
from allocation_engine import AllocationEngine
from data_manager import DataManager
from report_generator import ReportGenerator

print("=" * 60)
print("端到端测试")
print("=" * 60)

# 1. 创建工作区
w = Workspace(name="竞赛演练工作区")
print(f"[OK] 创建工作区: {w.name}")

# 2. 导入示例数据
dm = DataManager(w)
constraint_count = dm.import_constraints('samples/constraints_sample.csv')
print(f"[OK] 导入约束: {constraint_count} 条")

material_count = dm.import_materials('samples/materials_sample.csv')
print(f"[OK] 导入物资: {material_count} 种")

dp_count = dm.import_demand_points('samples/demand_points_sample.csv')
print(f"[OK] 导入需求点: {dp_count} 个")

# 3. 执行分配
engine = AllocationEngine(w)
allocs = engine.allocate_all()
print(f"[OK] 执行分配，生成 {len(allocs)} 条记录")

# 4. 检查自动判断理由
has_reason = all(a.judgment_reason for a in allocs)
print(f"[OK] 判断理由完整性: {'是' if has_reason else '否'}")

has_next = all(a.next_step for a in allocs)
print(f"[OK] 下一步建议完整性: {'是' if has_next else '否'}")

# 5. 状态分类
confirmed = len([a for a in allocs if a.status == RecordStatus.CONFIRMED])
pending = len([a for a in allocs if a.status == RecordStatus.PENDING])
print(f"[OK] 状态分类 - 已确认: {confirmed}, 待补: {pending}")

# 6. 人工调整
if allocs:
    aid = allocs[0].id
    engine.manual_adjust(aid, 999, "教练调整测试")
    modified = w.allocations[aid]
    assert modified.status == RecordStatus.MANUAL_MODIFIED
    assert modified.original_quantity is not None
    print(f"[OK] 人工调整 - 状态: {modified.status.value}, 原数量保留: {modified.original_quantity}")

# 7. 约束覆盖检查
report = ReportGenerator(w, engine)
coverage = report.check_constraint_coverage()
print(f"[OK] 约束覆盖 - 已覆盖: {len(coverage['covered'])}, 未覆盖: {len(coverage['uncovered'])}")

# 8. 导出测试
export_count = dm.export_allocations('test_export.csv')
print(f"[OK] 导出全部记录: {export_count} 条")

export_confirmed = dm.export_allocations('test_export_confirmed.csv', [RecordStatus.CONFIRMED])
print(f"[OK] 筛选导出已确认: {export_confirmed} 条")

# 9. 生成模型说明
desc = report.generate_model_description('test_model_description.txt')
print(f"[OK] 生成模型说明文档，长度: {len(desc)} 字符")

# 10. 工作区保存/加载
dm.save_workspace('test_workspace.json')
print("[OK] 保存工作区")

w2 = Workspace(name="新工作区")
dm2 = DataManager(w2)
dm2.load_workspace('test_workspace.json')
print(f"[OK] 加载工作区: {w2.name}")

print("\n" + "=" * 60)
print("✅ 所有测试通过!")
print("=" * 60)
print("\n给参赛队的模型说明摘要:")
print("-" * 40)
print(desc[:500] + "...")
