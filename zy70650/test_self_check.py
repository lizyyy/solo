import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, timedelta
from database import SessionLocal, init_db
from models import Base
import crud
import analytics
import exporter

def print_test_result(test_name, passed, message=""):
    status = "✓ 通过" if passed else "✗ 失败"
    print(f"{status}: {test_name}")
    if message:
        print(f"   {message}")
    return passed

def test_initialization():
    print("\n=== 1. 初始化测试 ===")
    try:
        if os.path.exists("fuel_abnormal.db"):
            os.remove("fuel_abnormal.db")
        
        init_db()
        return print_test_result("数据库初始化", True)
    except Exception as e:
        return print_test_result("数据库初始化", False, str(e))

def test_create_driver_and_vehicle():
    print("\n=== 2. 数据创建测试 ===")
    db = SessionLocal()
    all_passed = True
    
    try:
        driver = crud.create_driver(db, {
            "name": "张司机",
            "phone": "13800138000",
            "id_card": "110101198001011234"
        })
        all_passed &= print_test_result("创建司机", True, f"司机ID: {driver.id}")
        
        vehicle = crud.create_vehicle(db, {
            "plate_number": "京A12345",
            "vehicle_type": "重型卡车",
            "fuel_type": "柴油",
            "tank_capacity": 500,
            "standard_fuel_consumption": 25.0,
            "driver_id": driver.id
        })
        all_passed &= print_test_result("创建车辆", True, f"车牌号: {vehicle.plate_number}")
        
        vehicle2 = crud.create_vehicle(db, {
            "plate_number": "京B67890",
            "vehicle_type": "中型货车",
            "fuel_type": "柴油",
            "tank_capacity": 300,
            "standard_fuel_consumption": 18.0
        })
        all_passed &= print_test_result("创建第二辆车", True, f"车牌号: {vehicle2.plate_number}")
        
    except Exception as e:
        all_passed &= print_test_result("数据创建", False, str(e))
    finally:
        db.close()
    
    return all_passed

def test_create_fuel_and_mileage_records():
    print("\n=== 3. 记录导入测试 ===")
    db = SessionLocal()
    all_passed = True
    
    try:
        vehicle = crud.get_vehicle_by_plate(db, "京A12345")
        vehicle2 = crud.get_vehicle_by_plate(db, "京B67890")
        
        base_date = datetime.now() - timedelta(days=10)
        
        for i in range(7):
            fuel_date = base_date + timedelta(days=i)
            crud.create_fuel_record(db, {
                "vehicle_id": vehicle.id,
                "card_number": "CARD001",
                "fuel_date": fuel_date,
                "fuel_amount": 200 + (i * 20),
                "fuel_price": 7.5,
                "total_cost": (200 + i * 20) * 7.5,
                "odometer": 10000 + i * 500,
                "station": "中石油XX加油站"
            })
            
            record_date = base_date + timedelta(days=i)
            crud.create_mileage_record(db, {
                "vehicle_id": vehicle.id,
                "gps_device_id": "GPS001",
                "record_date": record_date,
                "start_mileage": 10000 + i * 500,
                "end_mileage": 10000 + (i + 1) * 500,
                "distance": 500,
                "start_location": "北京",
                "end_location": "天津"
            })
        
        for i in range(3):
            fuel_date = base_date + timedelta(days=i)
            crud.create_fuel_record(db, {
                "vehicle_id": vehicle2.id,
                "card_number": "CARD002",
                "fuel_date": fuel_date,
                "fuel_amount": 500,
                "fuel_price": 7.5,
                "total_cost": 3750,
                "odometer": 5000 + i * 100,
                "station": "中石化XX加油站"
            })
            
            record_date = base_date + timedelta(days=i)
            crud.create_mileage_record(db, {
                "vehicle_id": vehicle2.id,
                "gps_device_id": "GPS002",
                "record_date": record_date,
                "start_mileage": 5000 + i * 100,
                "end_mileage": 5000 + (i + 1) * 100,
                "distance": 100,
                "start_location": "北京",
                "end_location": "北京周边"
            })
        
        fuel_records = crud.get_vehicle_fuel_records(db, vehicle.id)
        mileage_records = crud.get_vehicle_mileage_records(db, vehicle.id)
        
        all_passed &= print_test_result("创建加油记录", len(fuel_records) == 7, f"数量: {len(fuel_records)}")
        all_passed &= print_test_result("创建里程记录", len(mileage_records) == 7, f"数量: {len(mileage_records)}")
        
    except Exception as e:
        all_passed &= print_test_result("记录创建", False, str(e))
    finally:
        db.close()
    
    return all_passed

def test_data_filtering():
    print("\n=== 4. 数据筛选测试 ===")
    db = SessionLocal()
    all_passed = True
    
    try:
        vehicle = crud.get_vehicle_by_plate(db, "京A12345")
        
        start_date = datetime.now() - timedelta(days=15)
        end_date = datetime.now() - timedelta(days=5)
        
        fuel_records = crud.get_vehicle_fuel_records(db, vehicle.id, start_date, end_date)
        mileage_records = crud.get_vehicle_mileage_records(db, vehicle.id, start_date, end_date)
        
        all_passed &= print_test_result("按日期筛选加油记录", len(fuel_records) > 0, f"筛选后数量: {len(fuel_records)}")
        all_passed &= print_test_result("按日期筛选里程记录", len(mileage_records) > 0, f"筛选后数量: {len(mileage_records)}")
        
        total_fuel = crud.get_vehicle_total_fuel(db, vehicle.id, start_date, end_date)
        total_mileage = crud.get_vehicle_total_mileage(db, vehicle.id, start_date, end_date)
        
        all_passed &= print_test_result("统计总油耗", total_fuel > 0, f"总油耗: {total_fuel}L")
        all_passed &= print_test_result("统计总里程", total_mileage > 0, f"总里程: {total_mileage}km")
        
    except Exception as e:
        all_passed &= print_test_result("数据筛选", False, str(e))
    finally:
        db.close()
    
    return all_passed

def test_abnormal_detection():
    print("\n=== 5. 异常检测测试 ===")
    db = SessionLocal()
    all_passed = True
    
    try:
        vehicle = crud.get_vehicle_by_plate(db, "京A12345")
        vehicle2 = crud.get_vehicle_by_plate(db, "京B67890")
        
        abnormal_results1 = analytics.analyze_vehicle_abnormal(db, vehicle.id)
        abnormal_results2 = analytics.analyze_vehicle_abnormal(db, vehicle2.id)
        
        all_passed &= print_test_result("车辆1异常检测", True, f"检测到异常: {len(abnormal_results1)} 条")
        all_passed &= print_test_result("车辆2异常检测", True, f"检测到异常: {len(abnormal_results2)} 条")
        
        reports = analytics.generate_abnormal_reports(db)
        all_passed &= print_test_result("生成异常报告", True, f"共生成 {len(reports)} 份报告")
        
        pending_reports = crud.get_abnormal_reports(db, status="待处理")
        all_passed &= print_test_result("查询待处理报告", True, f"待处理报告数量: {len(pending_reports)}")
        
        if pending_reports:
            report = pending_reports[0]
            updated_report = crud.update_abnormal_report_status(
                db, report.id, "已处理", "管理员", "已核实异常"
            )
            all_passed &= print_test_result("更新报告状态", updated_report.status == "已处理", f"新状态: {updated_report.status}")
        
    except Exception as e:
        all_passed &= print_test_result("异常检测", False, str(e))
    finally:
        db.close()
    
    return all_passed

def test_export_functions():
    print("\n=== 6. 导出功能测试 ===")
    db = SessionLocal()
    all_passed = True
    
    try:
        csv_fuel = exporter.export_fuel_records_to_csv(db)
        all_passed &= print_test_result("导出加油记录CSV", csv_fuel is not None and len(csv_fuel) > 0, f"CSV大小: {len(csv_fuel)} 字符")
        
        csv_mileage = exporter.export_mileage_records_to_csv(db)
        all_passed &= print_test_result("导出里程记录CSV", csv_mileage is not None and len(csv_mileage) > 0, f"CSV大小: {len(csv_mileage)} 字符")
        
        csv_abnormal = exporter.export_abnormal_reports_to_csv(db)
        all_passed &= print_test_result("导出异常报告CSV", csv_abnormal is not None and len(csv_abnormal) > 0, f"CSV大小: {len(csv_abnormal)} 字符")
        
        md_abnormal = exporter.export_abnormal_reports_to_markdown(db)
        all_passed &= print_test_result("导出异常报告Markdown", md_abnormal is not None and len(md_abnormal) > 0, f"Markdown大小: {len(md_abnormal)} 字符")
        
        with open("test_export_fuel.csv", "w", encoding="utf-8") as f:
            f.write(csv_fuel)
        with open("test_export_abnormal.md", "w", encoding="utf-8") as f:
            f.write(md_abnormal)
        
        all_passed &= print_test_result("导出文件保存", True, "文件已保存到 test_export_*")
        
    except Exception as e:
        all_passed &= print_test_result("导出功能", False, str(e))
    finally:
        db.close()
    
    return all_passed

def test_statistics():
    print("\n=== 7. 统计功能测试 ===")
    db = SessionLocal()
    all_passed = True
    
    try:
        from sqlalchemy import func
        from models import FuelRecord, MileageRecord, AbnormalReport
        
        total_fuel = db.query(func.sum(FuelRecord.fuel_amount)).scalar() or 0
        total_mileage = db.query(func.sum(MileageRecord.distance)).scalar() or 0
        avg_consumption = analytics.calculate_fuel_consumption_per_100km(total_fuel, total_mileage)
        
        all_passed &= print_test_result("统计总油耗", total_fuel > 0, f"总油耗: {total_fuel:.2f}L")
        all_passed &= print_test_result("统计总里程", total_mileage > 0, f"总里程: {total_mileage:.2f}km")
        all_passed &= print_test_result("计算百公里油耗", avg_consumption > 0, f"百公里油耗: {avg_consumption:.2f}L")
        
    except Exception as e:
        all_passed &= print_test_result("统计功能", False, str(e))
    finally:
        db.close()
    
    return all_passed

def main():
    print("=" * 60)
    print("         油耗异常GPS里程系统 - 自检脚本")
    print("=" * 60)
    
    results = []
    
    results.append(test_initialization())
    results.append(test_create_driver_and_vehicle())
    results.append(test_create_fuel_and_mileage_records())
    results.append(test_data_filtering())
    results.append(test_abnormal_detection())
    results.append(test_export_functions())
    results.append(test_statistics())
    
    print("\n" + "=" * 60)
    passed_count = sum(1 for r in results if r)
    total_count = len(results)
    
    print(f"测试结果: {passed_count}/{total_count} 项通过")
    
    if passed_count == total_count:
        print("✓ 所有测试通过！系统运行正常。")
    else:
        print("✗ 部分测试失败，请检查错误信息。")
    print("=" * 60)
    
    print("\n测试数据库文件: fuel_abnormal.db")
    print("测试导出文件: test_export_*.csv, test_export_*.md")
    
    return passed_count == total_count

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
