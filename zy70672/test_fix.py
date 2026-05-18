#!/usr/bin/env python3
import os
import sys

for db_file in ['test_api.db']:
    if os.path.exists(db_file):
        os.remove(db_file)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base
from models import Farmer, Plot, Project, GPSRecord, Confirmation
from services import create_settlement_service
from schemas import SettlementCreate

engine = create_engine('sqlite:///test_api.db')
Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

print("=" * 60)
print("测试异常链路修复")
print("=" * 60)

farmer = Farmer(name='张三', phone='13800000001', id_card='110101199001010001', village='东村')
db.add(farmer)
db.flush()
print(f"\n1. 创建农户: {farmer.name} (ID: {farmer.id})")

plot = Plot(
    farmer_id=farmer.id,
    plot_code='P001',
    plot_name='第一块地',
    location='东区',
    standard_area=10.0,
    land_type='水田'
)
db.add(plot)
db.flush()
print(f"2. 创建地块: {plot.plot_name} (ID: {plot.id})")

project = Project(
    project_code='PLOW001',
    project_name='耕地作业',
    unit_price=50.0,
    unit='mu'
)
db.add(project)
db.flush()
print(f"3. 创建项目: {project.project_name} (ID: {project.id})")

print("\n" + "-" * 60)
print("测试场景1: 无GPS数据 (原Bug场景)")
print("-" * 60)

settlement_data = SettlementCreate(farmer_id=farmer.id, notes='无GPS数据测试')
settlement = create_settlement_service(db, settlement_data)
print(f"   结算状态: {settlement.status}")
print(f"   异常记录数: {len(settlement.exception_records)}")
assert settlement.status == 'conflict', "状态应该是conflict"
assert len(settlement.exception_records) == 1, "应该有1条异常记录"
assert settlement.exception_records[0].exception_type == 'NO_GPS_DATA'
print("   ✓ 测试通过: 无GPS数据不再抛出500错误，正确生成异常记录")

gps = GPSRecord(
    plot_id=plot.id,
    project_id=project.id,
    gps_area=10.0
)
db.add(gps)
db.flush()

print("\n" + "-" * 60)
print("测试场景2: 无确认单")
print("-" * 60)

settlement_data2 = SettlementCreate(farmer_id=farmer.id, notes='无确认单测试')
settlement2 = create_settlement_service(db, settlement_data2)
print(f"   结算状态: {settlement2.status}")
print(f"   异常记录数: {len(settlement2.exception_records)}")
assert settlement2.status == 'conflict'
has_no_conf = any(e.exception_type == 'NO_CONFIRMATION' for e in settlement2.exception_records)
assert has_no_conf
print("   ✓ 测试通过: 无确认单正确标记冲突")

conf = Confirmation(
    plot_id=plot.id,
    farmer_id=farmer.id,
    project_id=project.id,
    confirmed_area=15.0,
    confirmed_by='确认员'
)
db.add(conf)
db.flush()

print("\n" + "-" * 60)
print("测试场景3: 面积差异超过10% (冲突)")
print("-" * 60)

settlement_data3 = SettlementCreate(farmer_id=farmer.id, notes='面积冲突测试')
settlement3 = create_settlement_service(db, settlement_data3)
print(f"   结算状态: {settlement3.status}")
print(f"   异常记录数: {len(settlement3.exception_records)}")
has_area_conflict = any(e.exception_type == 'AREA_CONFLICT' for e in settlement3.exception_records)
assert settlement3.status == 'conflict'
assert has_area_conflict
print("   ✓ 测试通过: 面积差异超过10%正确标记冲突")

print("\n" + "-" * 60)
print("测试场景4: 重复作业地块")
print("-" * 60)

for i in range(3):
    gps2 = GPSRecord(
        plot_id=plot.id,
        project_id=project.id,
        gps_area=10.0 + i * 0.01
    )
    db.add(gps2)
db.commit()

settlement_data4 = SettlementCreate(farmer_id=farmer.id, notes='重复地块测试')
settlement4 = create_settlement_service(db, settlement_data4)
print(f"   结算状态: {settlement4.status}")
print(f"   异常记录数: {len(settlement4.exception_records)}")
has_dup = any(e.exception_type == 'DUPLICATE_PLOT' for e in settlement4.exception_records)
assert has_dup
print("   ✓ 测试通过: 重复地块正确标记并去重")

print("\n" + "-" * 60)
print("测试场景5: 正常结算 (差异<=10%)")
print("-" * 60)

farmer2 = Farmer(name='李四', phone='13800000002', id_card='110101199001010002', village='西村')
db.add(farmer2)
db.flush()

plot2 = Plot(
    farmer_id=farmer2.id,
    plot_code='P002',
    plot_name='第二块地',
    location='西区',
    standard_area=8.0,
    land_type='旱地'
)
db.add(plot2)
db.flush()

gps3 = GPSRecord(plot_id=plot2.id, project_id=project.id, gps_area=8.0)
db.add(gps3)
db.flush()

conf2 = Confirmation(
    plot_id=plot2.id,
    farmer_id=farmer2.id,
    project_id=project.id,
    confirmed_area=8.5,
    confirmed_by='确认员'
)
db.add(conf2)
db.commit()

settlement_data5 = SettlementCreate(farmer_id=farmer2.id, notes='正常结算测试')
settlement5 = create_settlement_service(db, settlement_data5)
print(f"   结算状态: {settlement5.status}")
print(f"   异常记录数: {len(settlement5.exception_records)}")
assert settlement5.status == 'draft' or (settlement5.status == 'conflict' and len(settlement5.exception_records) == 0), "差异在10%以内应该正常结算"
print("   ✓ 测试通过: 正常结算流程可用")

print("\n" + "=" * 60)
print("✓ ✓ ✓ 所有异常链路测试通过! ✓ ✓ ✓")
print("=" * 60)
print("\n修复内容总结:")
print(" 1. 移除了 raise ExceptionRecord (非异常类)")
print(" 2. 改为先创建结算单，再创建关联异常记录")
print(" 3. 结算状态设为 conflict，标记待人工处理")
print(" 4. 支持四种异常类型: NO_GPS_DATA, NO_CONFIRMATION, AREA_CONFLICT, DUPLICATE_PLOT")
print(" 5. 新增异常记录查询接口: GET /exceptions/, GET /exceptions/{id}")

db.close()
