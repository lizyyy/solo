import os
import sys
from typing import Optional
from models import Workspace, RecordStatus
from allocation_engine import AllocationEngine
from data_manager import DataManager
from report_generator import ReportGenerator


class RescueAllocationCLI:
    def __init__(self):
        self.workspace = Workspace(name="默认工作区")
        self.engine = AllocationEngine(self.workspace)
        self.data_mgr = DataManager(self.workspace)
        self.report_mgr = ReportGenerator(self.workspace, self.engine)

    def run(self):
        self._print_banner()
        while True:
            self._print_menu()
            choice = input("\n请选择操作: ").strip()
            if choice == 'q':
                print("再见！")
                break
            self._handle_choice(choice)

    def _print_banner(self):
        print("=" * 60)
        print("  救援物资分配工具 - 竞赛教练版")
        print("=" * 60)

    def _print_menu(self):
        print("\n" + "=" * 60)
        print("【主菜单】")
        print("  1. 导入约束说明")
        print("  2. 导入物资清单")
        print("  3. 导入需求点")
        print("  4. 执行自动分配")
        print("  5. 查看分配记录")
        print("  6. 人工调整分配")
        print("  7. 确认分配记录")
        print("  8. 导入分配记录")
        print("  9. 导出分配记录")
        print(" 10. 撤回导入批次")
        print(" 11. 查看约束覆盖情况")
        print(" 12. 生成模型说明文档")
        print(" 13. 保存工作区")
        print(" 14. 加载工作区")
        print("  q. 退出")
        print("=" * 60)

    def _handle_choice(self, choice: str):
        handlers = {
            '1': self._import_constraints,
            '2': self._import_materials,
            '3': self._import_demand_points,
            '4': self._run_allocation,
            '5': self._view_allocations,
            '6': self._manual_adjust,
            '7': self._confirm_record,
            '8': self._import_allocations,
            '9': self._export_allocations,
            '10': self._revoke_batch,
            '11': self._check_constraint_coverage,
            '12': self._generate_report,
            '13': self._save_workspace,
            '14': self._load_workspace,
        }
        
        handler = handlers.get(choice)
        if handler:
            try:
                handler()
            except Exception as e:
                print(f"操作失败: {e}")
        else:
            print("无效选项，请重新选择")

    def _import_constraints(self):
        path = input("约束说明CSV路径: ").strip()
        if os.path.exists(path):
            count = self.data_mgr.import_constraints(path)
            print(f"成功导入 {count} 条约束规则")
        else:
            print("文件不存在")

    def _import_materials(self):
        path = input("物资清单CSV路径: ").strip()
        if os.path.exists(path):
            count = self.data_mgr.import_materials(path)
            print(f"成功导入 {count} 种物资")
        else:
            print("文件不存在")

    def _import_demand_points(self):
        path = input("需求点CSV路径: ").strip()
        if os.path.exists(path):
            count = self.data_mgr.import_demand_points(path)
            print(f"成功导入 {count} 个需求点")
        else:
            print("文件不存在")

    def _run_allocation(self):
        if not self.workspace.materials:
            print("请先导入物资清单")
            return
        if not self.workspace.demand_points:
            print("请先导入需求点")
            return
        
        allocations = self.engine.allocate_all()
        print(f"完成分配，共生成 {len(allocations)} 条记录")

    def _view_allocations(self):
        print("\n【分配记录】")
        print(f"{'ID':<10} {'物资':<15} {'需求点':<15} {'数量':<10} {'状态':<10}")
        print("-" * 60)
        
        for alloc in self.workspace.allocations.values():
            print(f"{alloc.id:<10} {alloc.material_name:<15} {alloc.demand_point_name:<15} "
                  f"{alloc.allocated_quantity:>6}{alloc.unit:<3} {alloc.status.value:<10}")
        
        print(f"\n共 {len(self.workspace.allocations)} 条记录")
        
        detail_id = input("\n输入记录ID查看详情(回车跳过): ").strip()
        if detail_id:
            self._show_record_detail(detail_id)

    def _show_record_detail(self, record_id: str):
        alloc = self.workspace.allocations.get(record_id)
        if alloc:
            print(f"\n【记录详情】")
            print(f"记录ID: {alloc.id}")
            print(f"物资: {alloc.material_name} ({alloc.material_id})")
            print(f"需求点: {alloc.demand_point_name} ({alloc.demand_point_id})")
            print(f"分配数量: {alloc.allocated_quantity} {alloc.unit}")
            print(f"分配类型: {alloc.allocation_type.value}")
            print(f"状态: {alloc.status.value}")
            print(f"判断理由: {alloc.judgment_reason}")
            print(f"下一步: {alloc.next_step}")
            if alloc.manual_modified:
                print(f"原数量: {alloc.original_quantity}")
                print(f"修改人: {alloc.modified_by}")
                print(f"修改时间: {alloc.modified_at}")
        else:
            print("记录不存在")

    def _manual_adjust(self):
        record_id = input("记录ID: ").strip()
        alloc = self.workspace.allocations.get(record_id)
        if not alloc:
            print("记录不存在")
            return
        
        print(f"当前数量: {alloc.allocated_quantity} {alloc.unit}")
        new_qty = float(input("新数量: ").strip())
        reason = input("修改理由: ").strip()
        
        self.engine.manual_adjust(record_id, new_qty, reason)
        print("修改成功")

    def _confirm_record(self):
        record_id = input("记录ID: ").strip()
        alloc = self.workspace.allocations.get(record_id)
        if alloc:
            self.engine.confirm_record(record_id)
            print("已确认")
        else:
            print("记录不存在")

    def _import_allocations(self):
        path = input("分配记录CSV路径: ").strip()
        if os.path.exists(path):
            count = self.data_mgr.import_allocations(path)
            print(f"成功导入 {count} 条记录")
        else:
            print("文件不存在")

    def _export_allocations(self):
        path = input("导出CSV路径: ").strip()
        print("\n筛选状态:")
        print("1. 全部")
        print("2. 已确认")
        print("3. 待补充")
        print("4. 人工修改")
        
        status_choice = input("请选择(默认全部): ").strip()
        
        status_filter = None
        if status_choice == '2':
            status_filter = [RecordStatus.CONFIRMED]
        elif status_choice == '3':
            status_filter = [RecordStatus.PENDING]
        elif status_choice == '4':
            status_filter = [RecordStatus.MANUAL_MODIFIED]
        
        count = self.data_mgr.export_allocations(path, status_filter)
        print(f"成功导出 {count} 条记录")

    def _revoke_batch(self):
        print("\n【导入批次列表】")
        for batch_id, batch in self.workspace.import_batches.items():
            status = "有效" if batch.is_active else "已撤回"
            print(f"{batch_id}: {batch.filename} ({batch.record_count}条) [{status}]")
        
        batch_id = input("\n输入批次ID撤回(回车取消): ").strip()
        if batch_id:
            count = self.data_mgr.revoke_batch(batch_id)
            print(f"已撤回 {count} 条记录")

    def _check_constraint_coverage(self):
        result = self.report_mgr.check_constraint_coverage()
        print("\n【约束覆盖情况】")
        print(f"已覆盖: {len(result['covered'])} 条")
        for c in result['covered']:
            print(f"  ✓ {c.name}")
        print(f"\n未覆盖: {len(result['uncovered'])} 条")
        for c in result['uncovered']:
            print(f"  ✗ {c.name}: {c.description}")

    def _generate_report(self):
        path = input("模型说明文档输出路径: ").strip()
        self.report_mgr.generate_model_description(path)
        print(f"模型说明已生成: {path}")

    def _save_workspace(self):
        path = input("工作区保存路径: ").strip()
        self.data_mgr.save_workspace(path)
        print(f"工作区已保存: {path}")

    def _load_workspace(self):
        path = input("工作区文件路径: ").strip()
        if os.path.exists(path):
            self.data_mgr.load_workspace(path)
            print("工作区已加载")
        else:
            print("文件不存在")


def main():
    cli = RescueAllocationCLI()
    cli.run()


if __name__ == "__main__":
    main()
