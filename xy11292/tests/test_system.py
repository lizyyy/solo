#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
会展物料管理系统 - 功能测试
"""

import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from exhibition_material.main import ExhibitionMaterialManager
from exhibition_material.models import MaterialType, RecordStatus, AnomalyType


def test_material_management(manager):
    """测试物料管理功能"""
    print("\n" + "=" * 60)
    print("测试1: 物料管理功能")
    print("=" * 60)
    
    try:
        material = manager.create_material(
            code="TEST-001",
            name="测试物料",
            material_type=MaterialType.TRUSS,
            unit="件",
            total_quantity=100,
            specification="测试规格",
            location="测试仓库",
            responsible_person="测试员"
        )
        print(f"  ✓ 创建物料成功: {material.code} - {material.name}")
        
        retrieved = manager.get_material(code="TEST-001")
        assert retrieved is not None, "应该能找到创建的物料"
        assert retrieved.code == "TEST-001", "物料编码应该匹配"
        print(f"  ✓ 查询物料成功: {retrieved.code}")
        
        materials = manager.list_materials(responsible_person="测试员")
        assert len(materials) >= 1, "应该至少有一个物料"
        print(f"  ✓ 列出物料成功: {len(materials)} 个")
        
        print("  物料管理功能测试通过!")
        return True
    except Exception as e:
        print(f"  ✗ 物料管理功能测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_allocation_management(manager):
    """测试调拨管理功能"""
    print("\n" + "=" * 60)
    print("测试2: 调拨管理功能")
    print("=" * 60)
    
    try:
        material = manager.get_material(code="TEST-001")
        assert material is not None, "应该能找到测试物料"
        
        allocation = manager.create_allocation(
            material_id=material.id,
            booth_number="T01",
            quantity=50,
            responsible_person="测试负责人",
            contact_phone="13800000000",
            remarks="测试调拨"
        )
        print(f"  ✓ 创建调拨单成功: {allocation.allocation_no}")
        
        material_after = manager.get_material(code="TEST-001")
        assert material_after.available_quantity == 50, f"可用数量应该是50, 实际是{material_after.available_quantity}"
        assert material_after.allocated_quantity == 50, f"已调拨数量应该是50, 实际是{material_after.allocated_quantity}"
        print(f"  ✓ 库存更新正确: 可用={material_after.available_quantity}, 已调拨={material_after.allocated_quantity}")
        
        allocations = manager.query_allocations(booth_number="T01")
        assert len(allocations) >= 1, "应该至少有一个调拨单"
        print(f"  ✓ 查询调拨单成功: {len(allocations)} 个")
        
        print("  调拨管理功能测试通过!")
        return True
    except Exception as e:
        print(f"  ✗ 调拨管理功能测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_return_management(manager):
    """测试归还管理功能"""
    print("\n" + "=" * 60)
    print("测试3: 归还管理功能")
    print("=" * 60)
    
    try:
        allocations = manager.query_allocations(booth_number="T01")
        assert len(allocations) >= 1, "应该至少有一个调拨单"
        allocation_id = allocations[0]['id']
        
        record = manager.create_return_record(
            allocation_id=allocation_id,
            quantity=20,
            received_by="接收员",
            returned_by="归还员",
            condition_remark="完好无损",
            remarks="测试归还"
        )
        print(f"  ✓ 创建归还记录成功: {record.return_no}")
        
        material = manager.get_material(code="TEST-001")
        assert material.available_quantity == 70, f"可用数量应该是70, 实际是{material.available_quantity}"
        assert material.returned_quantity == 20, f"已归还数量应该是20, 实际是{material.returned_quantity}"
        print(f"  ✓ 库存更新正确: 可用={material.available_quantity}, 已归还={material.returned_quantity}")
        
        records = manager.query_return_records(returned_by="归还员")
        assert len(records) >= 1, "应该至少有一个归还记录"
        print(f"  ✓ 查询归还记录成功: {len(records)} 个")
        
        print("  归还管理功能测试通过!")
        return True
    except Exception as e:
        print(f"  ✗ 归还管理功能测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_query_filtering(manager):
    """测试查询筛选功能"""
    print("\n" + "=" * 60)
    print("测试4: 查询筛选功能")
    print("=" * 60)
    
    try:
        by_person = manager.query_allocations(responsible_person="测试负责人")
        assert len(by_person) >= 1, "按负责人查询应该有结果"
        print(f"  ✓ 按负责人筛选: {len(by_person)} 条记录")
        
        by_booth = manager.query_allocations(booth_number="T01")
        assert len(by_booth) >= 1, "按展位查询应该有结果"
        print(f"  ✓ 按展位筛选: {len(by_booth)} 条记录")
        
        by_status = manager.query_allocations(status=RecordStatus.APPROVED)
        assert len(by_status) >= 1, "按状态查询应该有结果"
        print(f"  ✓ 按状态筛选: {len(by_status)} 条记录")
        
        person_summary = manager.get_person_summary("测试负责人")
        assert person_summary['responsible_allocations_count'] >= 1, "人员汇总应该有数据"
        print(f"  ✓ 人员汇总: 负责调拨数={person_summary['responsible_allocations_count']}")
        
        booth_summary = manager.get_booth_summary("T01")
        assert booth_summary['total_allocations'] >= 1, "展位汇总应该有数据"
        print(f"  ✓ 展位汇总: 调拨总数={booth_summary['total_allocations']}, 待归还={booth_summary['pending_return']}")
        
        print("  查询筛选功能测试通过!")
        return True
    except Exception as e:
        print(f"  ✗ 查询筛选功能测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_import_function(manager):
    """测试数据导入功能"""
    print("\n" + "=" * 60)
    print("测试5: 数据导入功能")
    print("=" * 60)
    
    try:
        base_dir = Path(__file__).parent.parent.parent
        sample_dir = base_dir / "sample_data"
        
        csv_file = sample_dir / "sample_materials.csv"
        if csv_file.exists():
            result = manager.import_materials_from_csv(str(csv_file))
            print(f"  ✓ 物料CSV导入成功: 成功={result['success_count']}, 失败={result['failure_count']}")
        else:
            print(f"  ⚠ 示例CSV文件不存在，跳过导入测试")
        
        yaml_file = sample_dir / "sample_allocations.yaml"
        if yaml_file.exists():
            result = manager.import_allocations_from_yaml(str(yaml_file))
            print(f"  ✓ 调拨YAML导入成功: 成功={result['success_count']}, 失败={result['failure_count']}")
        else:
            print(f"  ⚠ 示例YAML文件不存在，跳过导入测试")
        
        anomalies = manager.get_all_anomalies()
        print(f"  ✓ 异常查询成功: 总异常数={anomalies['total_anomalies']}")
        
        print("  数据导入功能测试通过!")
        return True
    except Exception as e:
        print(f"  ✗ 数据导入功能测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_export_function(manager):
    """测试报告导出功能"""
    print("\n" + "=" * 60)
    print("测试6: 报告导出功能")
    print("=" * 60)
    
    try:
        alloc_result = manager.export_allocations_excel("测试调拨记录.xlsx")
        assert alloc_result['record_count'] >= 1, "应该导出至少一条记录"
        print(f"  ✓ 调拨记录导出成功: 文件={alloc_result['file_name']}, 记录数={alloc_result['record_count']}")
        
        return_result = manager.export_returns_excel("测试归还记录.xlsx")
        assert return_result['record_count'] >= 0, "导出应该成功"
        print(f"  ✓ 归还记录导出成功: 文件={return_result['file_name']}, 记录数={return_result['record_count']}")
        
        summary_result = manager.export_summary_report("测试汇总报告.xlsx")
        assert 'summary' in summary_result, "应该有汇总数据"
        print(f"  ✓ 汇总报告导出成功: 文件={summary_result['file_name']}")
        
        print("  报告导出功能测试通过!")
        return True
    except Exception as e:
        print(f"  ✗ 报告导出功能测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_batch_operation(manager):
    """测试批量操作功能"""
    print("\n" + "=" * 60)
    print("测试7: 批量操作和错误处理")
    print("=" * 60)
    
    try:
        material = manager.get_material(code="TEST-001")
        
        items = [
            {"material_id": material.id, "booth_number": "B01", "quantity": 10, "responsible_person": "批量测试1"},
            {"material_id": material.id, "booth_number": "B02", "quantity": 9999, "responsible_person": "批量测试2"},
            {"material_id": 99999, "booth_number": "B03", "quantity": 5, "responsible_person": "批量测试3"},
            {"material_id": material.id, "booth_number": "B04", "quantity": 15, "responsible_person": "批量测试4"},
        ]
        
        def create_alloc(item):
            return manager.allocation_service.create_allocation(
                material_id=item['material_id'],
                booth_number=item['booth_number'],
                quantity=item['quantity'],
                responsible_person=item['responsible_person']
            )
        
        result = manager.batch_service.execute_batch_operation(items, create_alloc)
        manager.commit()
        
        print(f"  ✓ 批量操作完成: 成功={result.success_count}, 失败={result.failure_count}")
        
        assert result.success_count == 3, f"应该成功3条，实际成功{result.success_count}"
        assert result.failure_count == 1, f"应该失败1条，实际失败{result.failure_count}"
        print(f"  ✓ 部分成功部分失败，符合预期")
        
        errors = manager.batch_service.get_import_errors()
        print(f"  ✓ 导入错误记录数: {len(errors)}")
        
        print("  批量操作功能测试通过!")
        return True
    except Exception as e:
        print(f"  ✗ 批量操作功能测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    print("\n" + "=" * 60)
    print("会展物料管理系统 - 全面功能测试")
    print("=" * 60)
    
    test_db_path = Path(__file__).parent.parent.parent / "test_exhibition.db"
    if test_db_path.exists():
        test_db_path.unlink()
    
    manager = ExhibitionMaterialManager(f"sqlite:///{test_db_path}")
    
    results = []
    
    try:
        results.append(("物料管理", test_material_management(manager)))
        results.append(("调拨管理", test_allocation_management(manager)))
        results.append(("归还管理", test_return_management(manager)))
        results.append(("查询筛选", test_query_filtering(manager)))
        results.append(("数据导入", test_import_function(manager)))
        results.append(("报告导出", test_export_function(manager)))
        results.append(("批量操作", test_batch_operation(manager)))
        
        print("\n" + "=" * 60)
        print("测试结果汇总")
        print("=" * 60)
        
        for name, passed in results:
            status = "✓ 通过" if passed else "✗ 失败"
            print(f"  {name}: {status}")
        
        passed_count = sum(1 for _, passed in results if passed)
        total_count = len(results)
        
        print(f"\n总计: {passed_count}/{total_count} 项测试通过")
        
        if passed_count == total_count:
            print("\n🎉 所有测试通过! 系统功能正常。")
        else:
            print(f"\n⚠ 有 {total_count - passed_count} 项测试失败，请检查。")
        
    except Exception as e:
        print(f"测试过程发生错误: {e}")
        import traceback
        traceback.print_exc()
        manager.rollback()
    finally:
        manager.close()


if __name__ == "__main__":
    main()
