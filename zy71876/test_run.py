from models import Workspace, Material, DemandPoint, Constraint
from allocation_engine import AllocationEngine
from data_manager import DataManager
from report_generator import ReportGenerator

w = Workspace(name='测试工作区')

# 添加约束
w.constraints['C001'] = Constraint('C001', '优先级规则', '排序', '高优先级优先', 'priority desc', 1, True)

# 添加物资
w.materials['M001'] = Material('M001', '饮用水', '生活物资', 1000, '箱')

# 添加需求点
dp1 = DemandPoint('D001', '重灾区A', '东区', 3, 5000, {'M001': 800})
dp2 = DemandPoint('D002', '安置点B', '西区', 2, 3000, {'M001': 500})
w.demand_points['D001'] = dp1
w.demand_points['D002'] = dp2

# 执行分配
engine = AllocationEngine(w)
allocs = engine.allocate_all()

print(f'生成分配记录: {len(allocs)} 条')
for a in allocs:
    print(f'  {a.material_name} -> {a.demand_point_name}: {a.allocated_quantity}{a.unit}')
    print(f'    理由: {a.judgment_reason}')
    print(f'    下一步: {a.next_step}')
    print(f'    状态: {a.status.value}')

# 测试人工调整
engine.manual_adjust(allocs[0].id, 750, '现场反馈调整')
print(f'\n调整后状态: {w.allocations[allocs[0].id].status.value}')

# 生成报告
report = ReportGenerator(w, engine)
report.generate_model_description('test_report.txt')
print('\n测试报告已生成: test_report.txt')
print('全部正常!')
