#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
会展物料管理系统 - 主入口
功能：
1. 物料管理（增删改查）
2. 调拨管理
3. 归还管理
4. 数据导入（CSV物料、YAML调拨单、CSV归还记录）
5. 数据查询筛选（按负责人、时间、状态、异常类型）
6. 报告导出（CSV/Excel）
7. 批量操作和错误重试
"""

import sys
from pathlib import Path
from datetime import datetime
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

from exhibition_material.storage.database import Database
from exhibition_material.models import MaterialType, RecordStatus, AnomalyType
from exhibition_material.services import (
    MaterialService, AllocationService, ReturnService,
    QueryService, BatchService
)
from exhibition_material.importers import CSVImporter, YAMLImporter, ReturnImporter
from exhibition_material.exporters import ReportExporter


class ExhibitionMaterialManager:
    def __init__(self, db_url: str = None):
        self.db = Database(db_url)
        self.db.create_tables()
        self.session = self.db.get_session()
        
        self.material_service = MaterialService(self.session)
        self.allocation_service = AllocationService(self.session)
        self.return_service = ReturnService(self.session)
        self.query_service = QueryService(self.session)
        self.batch_service = BatchService(self.session)
        self.csv_importer = CSVImporter(self.session)
        self.yaml_importer = YAMLImporter(self.session)
        self.return_importer = ReturnImporter(self.session)
        self.exporter = ReportExporter(self.session)
    
    def commit(self):
        self.session.commit()
    
    def rollback(self):
        self.session.rollback()
    
    def close(self):
        self.session.close()
    
    def create_material(self, code: str, name: str, material_type: MaterialType,
                        unit: str, total_quantity: float, specification: str = None,
                        location: str = None, responsible_person: str = None,
                        remarks: str = None):
        """创建物料"""
        material = self.material_service.create_material(
            code=code,
            name=name,
            material_type=material_type,
            unit=unit,
            total_quantity=total_quantity,
            specification=specification,
            location=location,
            responsible_person=responsible_person,
            remarks=remarks
        )
        self.commit()
        return material
    
    def get_material(self, material_id: int = None, code: str = None):
        """获取物料"""
        return self.material_service.get_material(material_id, code)
    
    def list_materials(self, material_type: MaterialType = None,
                       responsible_person: str = None, keyword: str = None,
                       is_active: bool = True):
        """列出物料"""
        return self.material_service.list_materials(
            material_type=material_type,
            responsible_person=responsible_person,
            keyword=keyword,
            is_active=is_active
        )
    
    def create_allocation(self, material_id: int, booth_number: str,
                          quantity: float, responsible_person: str,
                          contact_phone: str = None, remarks: str = None):
        """创建调拨单"""
        allocation, error = self.allocation_service.create_allocation(
            material_id=material_id,
            booth_number=booth_number,
            quantity=quantity,
            responsible_person=responsible_person,
            contact_phone=contact_phone,
            remarks=remarks
        )
        if error:
            raise ValueError(f"创建调拨单失败: {error}")
        self.commit()
        return allocation
    
    def create_return_record(self, allocation_id: int, quantity: float,
                             received_by: str, returned_by: str,
                             condition_remark: str = None, remarks: str = None):
        """创建归还记录"""
        record, error = self.return_service.create_return_record(
            allocation_id=allocation_id,
            quantity=quantity,
            received_by=received_by,
            returned_by=returned_by,
            condition_remark=condition_remark,
            remarks=remarks
        )
        if error:
            raise ValueError(f"创建归还记录失败: {error}")
        self.commit()
        return record
    
    def import_materials_from_csv(self, file_path: str):
        """从CSV导入物料"""
        result = self.csv_importer.import_materials(file_path)
        self.commit()
        return result
    
    def import_allocations_from_yaml(self, file_path: str):
        """从YAML导入调拨单"""
        result = self.yaml_importer.import_allocations(file_path)
        self.commit()
        return result
    
    def import_returns_from_csv(self, file_path: str):
        """从CSV导入归还记录"""
        result = self.return_importer.import_returns(file_path)
        self.commit()
        return result
    
    def query_allocations(self, responsible_person: str = None,
                          booth_number: str = None, status: RecordStatus = None,
                          has_anomaly: bool = None, anomaly_type: AnomalyType = None,
                          start_date: datetime = None, end_date: datetime = None):
        """查询调拨单"""
        return self.query_service.query_allocations(
            responsible_person=responsible_person,
            booth_number=booth_number,
            status=status,
            has_anomaly=has_anomaly,
            anomaly_type=anomaly_type,
            start_date=start_date,
            end_date=end_date
        )
    
    def query_return_records(self, received_by: str = None,
                             returned_by: str = None, booth_number: str = None,
                             status: RecordStatus = None, has_anomaly: bool = None,
                             anomaly_type: AnomalyType = None,
                             start_date: datetime = None, end_date: datetime = None):
        """查询归还记录"""
        return self.query_service.query_return_records(
            received_by=received_by,
            returned_by=returned_by,
            booth_number=booth_number,
            status=status,
            has_anomaly=has_anomaly,
            anomaly_type=anomaly_type,
            start_date=start_date,
            end_date=end_date
        )
    
    def export_allocations_excel(self, file_name: str = None,
                                 responsible_person: str = None,
                                 booth_number: str = None,
                                 status: RecordStatus = None,
                                 has_anomaly: bool = None,
                                 anomaly_type: AnomalyType = None,
                                 start_date: datetime = None,
                                 end_date: datetime = None):
        """导出调拨单到Excel"""
        result = self.exporter.export_allocations_to_excel(
            file_name=file_name,
            responsible_person=responsible_person,
            booth_number=booth_number,
            status=status,
            has_anomaly=has_anomaly,
            anomaly_type=anomaly_type,
            start_date=start_date,
            end_date=end_date
        )
        return result
    
    def export_returns_excel(self, file_name: str = None,
                             received_by: str = None,
                             returned_by: str = None,
                             booth_number: str = None,
                             status: RecordStatus = None,
                             has_anomaly: bool = None,
                             anomaly_type: AnomalyType = None,
                             start_date: datetime = None,
                             end_date: datetime = None):
        """导出归还记录到Excel"""
        result = self.exporter.export_returns_to_excel(
            file_name=file_name,
            received_by=received_by,
            returned_by=returned_by,
            booth_number=booth_number,
            status=status,
            has_anomaly=has_anomaly,
            anomaly_type=anomaly_type,
            start_date=start_date,
            end_date=end_date
        )
        return result
    
    def export_summary_report(self, file_name: str = None):
        """导出汇总报告"""
        return self.exporter.export_summary_report(file_name)
    
    def get_all_anomalies(self):
        """获取所有异常"""
        return self.query_service.get_all_anomalies()
    
    def get_person_summary(self, person_name: str):
        """获取人员汇总"""
        return self.query_service.get_person_summary(person_name)
    
    def get_booth_summary(self, booth_number: str):
        """获取展位汇总"""
        return self.allocation_service.get_booth_summary(booth_number)


def create_sample_data(manager: ExhibitionMaterialManager):
    """创建示例数据"""
    print("创建示例数据...")
    
    materials = [
        ("TRUSS-001", "300x300铝合金桁架", MaterialType.TRUSS, "米", 500, "300x300x4000mm", "A区仓库", "张三"),
        ("TRUSS-002", "400x400铝合金桁架", MaterialType.TRUSS, "米", 300, "400x400x4000mm", "A区仓库", "张三"),
        ("LIGHT-001", "230W光束灯", MaterialType.LIGHT, "台", 100, "230W摇头光束灯", "B区仓库", "李四"),
        ("LIGHT-002", "LED帕灯", MaterialType.LIGHT, "台", 200, "18颗10W四合一", "B区仓库", "李四"),
        ("SCREEN-001", "P3LED显示屏", MaterialType.SCREEN, "平方米", 200, "P3室内全彩", "C区仓库", "王五"),
        ("SCREEN-002", "P2.5LED显示屏", MaterialType.SCREEN, "平方米", 100, "P2.5室内全彩", "C区仓库", "王五"),
    ]
    
    for code, name, mtype, unit, qty, spec, loc, resp in materials:
        manager.create_material(
            code=code,
            name=name,
            material_type=mtype,
            unit=unit,
            total_quantity=qty,
            specification=spec,
            location=loc,
            responsible_person=resp
        )
        print(f"  创建物料: {code} - {name}")
    
    allocations = [
        ("TRUSS-001", "A01", 50, "赵六", "13800138001"),
        ("TRUSS-001", "A02", 30, "赵六", "13800138001"),
        ("TRUSS-002", "B01", 40, "孙七", "13800138002"),
        ("LIGHT-001", "A01", 20, "周八", "13800138003"),
        ("LIGHT-002", "A01", 40, "周八", "13800138003"),
        ("LIGHT-002", "B01", 30, "吴九", "13800138004"),
        ("SCREEN-001", "A01", 30, "郑十", "13800138005"),
        ("SCREEN-002", "C01", 50, "郑十", "13800138005"),
    ]
    
    for code, booth, qty, resp, phone in allocations:
        material = manager.get_material(code=code)
        if material:
            manager.create_allocation(
                material_id=material.id,
                booth_number=booth,
                quantity=qty,
                responsible_person=resp,
                contact_phone=phone
            )
            print(f"  创建调拨: {code} -> 展位{booth}, 数量{qty}")
    
    print("示例数据创建完成!")
    return manager


def main():
    print("=" * 60)
    print("会展物料管理系统 v1.0")
    print("=" * 60)
    
    manager = ExhibitionMaterialManager()
    
    try:
        create_sample_data(manager)
        
        print("\n" + "=" * 60)
        print("功能演示")
        print("=" * 60)
        
        print("\n1. 查询所有物料:")
        materials = manager.list_materials()
        for m in materials:
            print(f"  {m.code} - {m.name}: {m.available_quantity}{m.unit}/{m.total_quantity}{m.unit}")
        
        print("\n2. 查询展位A01的调拨记录:")
        allocations = manager.query_allocations(booth_number="A01")
        for a in allocations:
            print(f"  {a.get('allocation_no')} - {a.get('material', {}).get('name')}: "
                  f"{a.get('quantity')}{a.get('material', {}).get('unit')}, "
                  f"负责人: {a.get('responsible_person')}")
        
        print("\n3. 查询负责人赵六的调拨记录:")
        allocations = manager.query_allocations(responsible_person="赵六")
        for a in allocations:
            print(f"  {a.get('allocation_no')} - 展位{a.get('booth_number')}: "
                  f"{a.get('quantity')}{a.get('material', {}).get('unit')}")
        
        print("\n4. 创建归还记录:")
        all_allocs = manager.allocation_service.list_allocations()
        if all_allocs:
            alloc = all_allocs[0]
            record = manager.create_return_record(
                allocation_id=alloc.id,
                quantity=20,
                received_by="张三",
                returned_by="赵六",
                condition_remark="完好无损"
            )
            print(f"  创建归还记录: {record.return_no} - 数量{record.quantity}")
        
        print("\n5. 导出调拨记录Excel:")
        result = manager.export_allocations_excel("调拨记录演示.xlsx")
        print(f"  导出成功: {result['file_path']}")
        print(f"  记录数: {result['record_count']}")
        
        print("\n6. 导出归还记录Excel:")
        result = manager.export_returns_excel("归还记录演示.xlsx")
        print(f"  导出成功: {result['file_path']}")
        print(f"  记录数: {result['record_count']}")
        
        print("\n7. 获取展位汇总:")
        summary = manager.get_booth_summary("A01")
        print(f"  展位A01:")
        print(f"    调拨总数: {summary['total_allocations']}")
        print(f"    总数量: {summary['total_quantity']}")
        print(f"    已归还: {summary['total_returned']}")
        print(f"    待归还: {summary['pending_return']}")
        
        print("\n8. 获取人员汇总:")
        summary = manager.get_person_summary("赵六")
        print(f"  赵六:")
        print(f"    负责调拨数: {summary['responsible_allocations_count']}")
        print(f"    接收归还数: {summary['received_records_count']}")
        
        print("\n" + "=" * 60)
        print("演示完成!")
        print("=" * 60)
        
    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()
        manager.rollback()
    finally:
        manager.close()


if __name__ == "__main__":
    main()
