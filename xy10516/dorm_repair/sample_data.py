from datetime import datetime, timedelta
from pathlib import Path
import csv
import os
import sqlite3

from .database import DatabaseManager
from .models import (
    Dormitory, RepairPerson, Material, RepairOrder,
    RepairStatus, ResponsibilityType, FollowUpResult
)
from .services import RepairService, ImportService


def generate_sample_csvs(output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)
    
    dormitories = [
        {'dorm_id': 'A1-101', 'building': 'A1', 'room_number': '101', 'floor': '1', 'capacity': '4',
         'students': '["张三", "李四", "王五", "赵六"]', 'counselor': '刘老师', 'remarks': '男生宿舍'},
        {'dorm_id': 'A1-102', 'building': 'A1', 'room_number': '102', 'floor': '1', 'capacity': '4',
         'students': '["钱七", "孙八", "周九", "吴十"]', 'counselor': '刘老师', 'remarks': '男生宿舍'},
        {'dorm_id': 'A1-201', 'building': 'A1', 'room_number': '201', 'floor': '2', 'capacity': '4',
         'students': '["郑一", "冯二", "陈三", "褚四"]', 'counselor': '王老师', 'remarks': '男生宿舍'},
        {'dorm_id': 'A2-101', 'building': 'A2', 'room_number': '101', 'floor': '1', 'capacity': '4',
         'students': '["卫一", "蒋二", "沈三", "韩四"]', 'counselor': '李老师', 'remarks': '女生宿舍'},
        {'dorm_id': 'A2-102', 'building': 'A2', 'room_number': '102', 'floor': '1', 'capacity': '4',
         'students': '["杨五", "朱六", "秦七", "尤八"]', 'counselor': '李老师', 'remarks': '女生宿舍'},
        {'dorm_id': 'B1-101', 'building': 'B1', 'room_number': '101', 'floor': '1', 'capacity': '4',
         'students': '["许九", "何十", "吕一", "施二"]', 'counselor': '张老师', 'remarks': '研究生宿舍'},
        {'dorm_id': 'B1-201', 'building': 'B1', 'room_number': '201', 'floor': '2', 'capacity': '4',
         'students': '["张一", "孔二", "曹三", "严四"]', 'counselor': '张老师', 'remarks': '研究生宿舍'},
    ]
    
    with open(output_dir / 'dormitories.csv', 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['dorm_id', 'building', 'room_number', 'floor', 'capacity', 'students', 'counselor', 'remarks'])
        writer.writeheader()
        writer.writerows(dormitories)
    
    repair_persons = [
        {'staff_id': 'P001', 'name': '王师傅', 'phone': '13800138001',
         'skills': '["水电", "管道"]', 'work_area': '["A1", "A2"]'},
        {'staff_id': 'P002', 'name': '李师傅', 'phone': '13800138002',
         'skills': '["家具", "门锁"]', 'work_area': '["B1", "A1"]'},
        {'staff_id': 'P003', 'name': '张师傅', 'phone': '13800138003',
         'skills': '["电路", "电器"]', 'work_area': '["A2", "B1"]'},
        {'staff_id': 'P004', 'name': '赵师傅', 'phone': '13800138004',
         'skills': '["综合", "门窗"]', 'work_area': '["A1", "A2", "B1"]'},
    ]
    
    with open(output_dir / 'repair_persons.csv', 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['staff_id', 'name', 'phone', 'skills', 'work_area'])
        writer.writeheader()
        writer.writerows(repair_persons)
    
    materials = [
        {'material_id': 'M001', 'name': '水龙头(冷)', 'unit': '个', 'unit_price': '45.0', 'current_stock': '20', 'min_stock': '5', 'category': 'plumbing'},
        {'material_id': 'M002', 'name': '水龙头(热)', 'unit': '个', 'unit_price': '55.0', 'current_stock': '15', 'min_stock': '5', 'category': 'plumbing'},
        {'material_id': 'M003', 'name': '生料带', 'unit': '卷', 'unit_price': '5.0', 'current_stock': '50', 'min_stock': '20', 'category': 'plumbing'},
        {'material_id': 'M004', 'name': '门锁芯', 'unit': '个', 'unit_price': '85.0', 'current_stock': '10', 'min_stock': '3', 'category': 'door_lock'},
        {'material_id': 'M005', 'name': '门把手', 'unit': '个', 'unit_price': '35.0', 'current_stock': '25', 'min_stock': '10', 'category': 'door_lock'},
        {'material_id': 'M006', 'name': 'LED灯泡(15W)', 'unit': '个', 'unit_price': '18.0', 'current_stock': '40', 'min_stock': '15', 'category': 'electrical'},
        {'material_id': 'M007', 'name': '五孔插座', 'unit': '个', 'unit_price': '22.0', 'current_stock': '30', 'min_stock': '10', 'category': 'electrical'},
        {'material_id': 'M008', 'name': '空气开关', 'unit': '个', 'unit_price': '45.0', 'current_stock': '8', 'min_stock': '5', 'category': 'electrical'},
        {'material_id': 'M009', 'name': '椅子螺丝套装', 'unit': '套', 'unit_price': '8.0', 'current_stock': '100', 'min_stock': '30', 'category': 'furniture'},
        {'material_id': 'M010', 'name': '床架加固件', 'unit': '套', 'unit_price': '25.0', 'current_stock': '15', 'min_stock': '5', 'category': 'furniture'},
        {'material_id': 'M011', 'name': '抽屉滑轨', 'unit': '副', 'unit_price': '30.0', 'current_stock': '12', 'min_stock': '5', 'category': 'furniture'},
        {'material_id': 'M012', 'name': '密封圈', 'unit': '个', 'unit_price': '3.0', 'current_stock': '100', 'min_stock': '30', 'category': 'plumbing'},
    ]
    
    with open(output_dir / 'materials.csv', 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['material_id', 'name', 'unit', 'unit_price', 'current_stock', 'min_stock', 'category'])
        writer.writeheader()
        writer.writerows(materials)


def _create_order_with_custom_id(
    db: DatabaseManager,
    custom_order_id: str,
    dorm_id: str,
    reporter: str,
    reporter_phone: str,
    description: str,
    submit_time: datetime,
    operator: str
) -> RepairOrder:
    from .services import classify_category, determine_responsibility
    
    category = classify_category(description)
    responsibility = determine_responsibility(description, category)
    
    order = RepairOrder(
        order_id=custom_order_id,
        dorm_id=dorm_id,
        submit_time=submit_time,
        reporter=reporter,
        reporter_phone=reporter_phone,
        description=description,
        category=category,
        responsibility=responsibility,
        status=RepairStatus.SUBMITTED
    )
    
    entry = {
        'timestamp': datetime.now().isoformat(),
        'action': '创建报修单',
        'operator': operator,
        'details': f"描述: {description}",
        'status': order.status.value,
        'responsibility': order.responsibility.value,
    }
    order.history.append(entry)
    
    db.save_repair_order(order, operator, reason="创建报修单")
    return order


def populate_sample_data(db: DatabaseManager):
    service = RepairService(db)
    now = datetime.now()
    
    order1 = _create_order_with_custom_id(
        db=db,
        custom_order_id='RO-20260507-A101PL',
        dorm_id='A1-101',
        reporter='张三',
        reporter_phone='13900139001',
        description='卫生间水龙头漏水，滴漏严重',
        submit_time=now - timedelta(days=5),
        operator='sample-data'
    )
    service.assign_order(order1.order_id, 'P001', operator='sample-data')
    service.start_repair(order1.order_id, operator='sample-data')
    service.add_material(order1.order_id, 'M001', 1, operator='sample-data')
    service.add_material(order1.order_id, 'M003', 1, operator='sample-data')
    service.complete_repair(order1.order_id, ['更换水龙头', '缠绕生料带防漏'], operator='sample-data')
    service.do_follow_up(order1.order_id, FollowUpResult.SATISFIED, '维修效果很好，不再漏水', operator='sample-data')
    service.close_order(order1.order_id, operator='sample-data')
    
    order2 = _create_order_with_custom_id(
        db=db,
        custom_order_id='RO-20260509-A101RP',
        dorm_id='A1-101',
        reporter='张三',
        reporter_phone='13900139001',
        description='卫生间水龙头又开始漏水',
        submit_time=now - timedelta(days=3),
        operator='sample-data'
    )
    
    fresh_order2 = db.get_repair_order('RO-20260509-A101RP')
    if fresh_order2 and not fresh_order2.is_repeat:
        repeat_check = service.check_repeat_order(fresh_order2)
        if repeat_check:
            fresh_order2.is_repeat = True
            fresh_order2.original_order_id = repeat_check.order_id
            fresh_order2.status = RepairStatus.REPEAT
            entry = {
                'timestamp': datetime.now().isoformat(),
                'action': '检测为重复报修',
                'operator': 'sample-data',
                'details': f"关联原单: {repeat_check.order_id}",
                'status': fresh_order2.status.value,
                'responsibility': fresh_order2.responsibility.value,
            }
            fresh_order2.history.append(entry)
            db.save_repair_order(fresh_order2, 'sample-data', reason="重复报修检测")
    
    order3 = _create_order_with_custom_id(
        db=db,
        custom_order_id='RO-20260508-A102LK',
        dorm_id='A1-102',
        reporter='钱七',
        reporter_phone='13900139002',
        description='门锁钥匙打不开，学生自己弄坏的，撞坏的锁芯',
        submit_time=now - timedelta(days=4),
        operator='sample-data'
    )
    service.assign_order(order3.order_id, 'P002', operator='sample-data')
    service.start_repair(order3.order_id, operator='sample-data')
    service.add_material(order3.order_id, 'M004', 1, operator='sample-data')
    service.complete_repair(order3.order_id, ['更换门锁芯'], operator='sample-data')
    
    order4 = _create_order_with_custom_id(
        db=db,
        custom_order_id='RO-20260509-A201EL',
        dorm_id='A2-101',
        reporter='卫一',
        reporter_phone='13900139003',
        description='房间灯不亮，电路老化，开关也有问题',
        submit_time=now - timedelta(days=3),
        operator='sample-data'
    )
    service.assign_order(order4.order_id, 'P003', operator='sample-data')
    service.start_repair(order4.order_id, operator='sample-data')
    service.add_material(order4.order_id, 'M006', 2, operator='sample-data')
    service.add_material(order4.order_id, 'M007', 1, operator='sample-data')
    service.complete_repair(order4.order_id, ['更换2个灯泡', '更换插座'], operator='sample-data')
    service.do_follow_up(order4.order_id, FollowUpResult.NEEDS_REWORK, '还有一个灯闪烁', operator='sample-data')
    
    order5 = _create_order_with_custom_id(
        db=db,
        custom_order_id='RO-20260510-B101FR',
        dorm_id='B1-101',
        reporter='许九',
        reporter_phone='13900139004',
        description='椅子螺丝松动，摇晃厉害',
        submit_time=now - timedelta(days=2),
        operator='sample-data'
    )
    service.assign_order(order5.order_id, 'P002', operator='sample-data')
    
    order6 = _create_order_with_custom_id(
        db=db,
        custom_order_id='RO-20260511-B102FR',
        dorm_id='B1-201',
        reporter='张一',
        reporter_phone='13900139005',
        description='床架松动，晚上睡觉响',
        submit_time=now - timedelta(days=1),
        operator='sample-data'
    )
    
    order7 = _create_order_with_custom_id(
        db=db,
        custom_order_id='RO-20260512-A202PL',
        dorm_id='A2-102',
        reporter='杨五',
        reporter_phone='13900139006',
        description='花洒出水小，水管可能堵塞',
        submit_time=now - timedelta(hours=5),
        operator='sample-data'
    )
    
    db.commit()


if __name__ == '__main__':
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        generate_sample_csvs(Path(tmpdir))
        print(f"Sample CSVs generated in {tmpdir}")
