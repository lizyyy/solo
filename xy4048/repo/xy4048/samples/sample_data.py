from datetime import datetime, timedelta
from typing import Optional
import random

from config import TaskStatus
from database import (
    DatabaseManager,
    CoolerBox, DrugBatch, DeliveryRoute, DeliveryPoint,
    DeliveryTask, PackingItem, TemperatureReading, Attachment,
    AuditLog, ExceptionRecord, ExceptionType
)


def create_sample_data(db: DatabaseManager):
    cooler_boxes = create_cooler_boxes(db)
    drug_batches = create_drug_batches(db)
    routes = create_delivery_routes(db)
    points = create_delivery_points(db, routes)
    tasks = create_delivery_tasks(db, cooler_boxes, points)
    create_packing_items(db, tasks, drug_batches)
    create_temperature_readings(db, tasks, cooler_boxes)
    create_audit_logs(db, tasks)
    
    return {
        "cooler_boxes": cooler_boxes,
        "drug_batches": drug_batches,
        "routes": routes,
        "points": points,
        "tasks": tasks,
    }


def create_cooler_boxes(db: DatabaseManager):
    boxes = []
    
    box1 = CoolerBox(
        box_number="CB-001",
        device_id="TEMP-001",
        description="医用冷藏箱 A型 - 容量 50L",
        is_active=True
    )
    db.create(box1)
    boxes.append(box1)
    
    box2 = CoolerBox(
        box_number="CB-002",
        device_id="TEMP-002",
        description="医用冷藏箱 B型 - 容量 30L",
        is_active=True
    )
    db.create(box2)
    boxes.append(box2)
    
    box3 = CoolerBox(
        box_number="CB-003",
        device_id="TEMP-003",
        description="备用冷藏箱 - 便携式",
        is_active=True
    )
    db.create(box3)
    boxes.append(box3)
    
    return boxes


def create_drug_batches(db: DatabaseManager):
    batches = []
    
    batch1 = DrugBatch(
        batch_number="INS-2024001",
        drug_name="重组人胰岛素注射液",
        specification="300U/3ml",
        manufacturer="某制药有限公司",
        quantity=100,
        unit="支",
        storage_condition="2-8°C冷藏",
        notes="门冬胰岛素"
    )
    db.create(batch1)
    batches.append(batch1)
    
    batch2 = DrugBatch(
        batch_number="VAC-2024001",
        drug_name="流感疫苗",
        specification="0.5ml/支",
        manufacturer="某生物制品公司",
        quantity=200,
        unit="支",
        storage_condition="2-8°C冷藏",
        notes="季节性流感疫苗"
    )
    db.create(batch2)
    batches.append(batch2)
    
    batch3 = DrugBatch(
        batch_number="INS-2024002",
        drug_name="甘精胰岛素注射液",
        specification="300U/3ml",
        manufacturer="某制药有限公司",
        quantity=80,
        unit="支",
        storage_condition="2-8°C冷藏",
        notes="长效胰岛素"
    )
    db.create(batch3)
    batches.append(batch3)
    
    batch4 = DrugBatch(
        batch_number="REA-2024001",
        drug_name="新冠病毒核酸检测试剂",
        specification="20人份/盒",
        manufacturer="某诊断试剂公司",
        quantity=50,
        unit="盒",
        storage_condition="2-8°C冷藏",
        notes="PCR检测试剂"
    )
    db.create(batch4)
    batches.append(batch4)
    
    batch5 = DrugBatch(
        batch_number="VAC-2024002",
        drug_name="乙肝疫苗",
        specification="10μg/0.5ml",
        manufacturer="某生物科技公司",
        quantity=150,
        unit="支",
        storage_condition="2-8°C冷藏",
        notes="重组乙肝疫苗"
    )
    db.create(batch5)
    batches.append(batch5)
    
    return batches


def create_delivery_routes(db: DatabaseManager):
    routes = []
    
    route1 = DeliveryRoute(
        route_name="城东路线",
        description="覆盖城东社区卫生服务中心、城东门诊部",
        is_active=True
    )
    db.create(route1)
    routes.append(route1)
    
    route2 = DeliveryRoute(
        route_name="城西路线",
        description="覆盖城西社区卫生服务中心、城西门诊部",
        is_active=True
    )
    db.create(route2)
    routes.append(route2)
    
    return routes


def create_delivery_points(db: DatabaseManager, routes):
    points = []
    
    point1 = DeliveryPoint(
        point_name="城东社区卫生服务中心",
        address="城东区健康路100号",
        contact_person="张护士",
        contact_phone="13800138001",
        route_id=routes[0].id if routes else None,
        is_active=True
    )
    db.create(point1)
    points.append(point1)
    
    point2 = DeliveryPoint(
        point_name="城东门诊部",
        address="城东区门诊路50号",
        contact_person="李医生",
        contact_phone="13800138002",
        route_id=routes[0].id if routes else None,
        is_active=True
    )
    db.create(point2)
    points.append(point2)
    
    point3 = DeliveryPoint(
        point_name="城西社区卫生服务中心",
        address="城西区健康大道200号",
        contact_person="王护士",
        contact_phone="13800138003",
        route_id=routes[1].id if routes else None,
        is_active=True
    )
    db.create(point3)
    points.append(point3)
    
    point4 = DeliveryPoint(
        point_name="城西专科门诊",
        address="城西区门诊路88号",
        contact_person="赵医生",
        contact_phone="13800138004",
        route_id=routes[1].id if routes else None,
        is_active=True
    )
    db.create(point4)
    points.append(point4)
    
    return points


def create_delivery_tasks(db: DatabaseManager, cooler_boxes, points):
    tasks = []
    
    now = datetime.now()
    
    task1 = DeliveryTask(
        task_number="TASK-2024-001",
        status=TaskStatus.IN_TRANSIT,
        cooler_box_id=cooler_boxes[0].id if cooler_boxes else None,
        delivery_point_id=points[0].id if points else None,
        pharmacist="张药师",
        courier="李配送员",
        packing_time=now - timedelta(hours=2),
        departure_time=now - timedelta(hours=1),
        notes="常规配送 - 胰岛素和疫苗"
    )
    db.create(task1)
    tasks.append(task1)
    
    task2 = DeliveryTask(
        task_number="TASK-2024-002",
        status=TaskStatus.TO_PACK,
        cooler_box_id=cooler_boxes[1].id if cooler_boxes else None,
        delivery_point_id=points[2].id if points else None,
        pharmacist="王药师",
        courier="",
        notes="待装箱 - 检测试剂",
        packing_time=None,
        departure_time=None
    )
    db.create(task2)
    tasks.append(task2)
    
    task3 = DeliveryTask(
        task_number="TASK-2024-003",
        status=TaskStatus.TO_SIGN,
        cooler_box_id=cooler_boxes[2].id if cooler_boxes else None,
        delivery_point_id=points[1].id if points else None,
        pharmacist="张药师",
        courier="赵配送员",
        packing_time=now - timedelta(hours=4),
        departure_time=now - timedelta(hours=3),
        arrival_time=now - timedelta(minutes=30),
        notes="已送达，待签收"
    )
    db.create(task3)
    tasks.append(task3)
    
    return tasks


def create_packing_items(db: DatabaseManager, tasks, drug_batches):
    if not tasks or not drug_batches:
        return
    
    item1 = PackingItem(
        task_id=tasks[0].id,
        drug_batch_id=drug_batches[0].id,
        quantity=10,
        unit="支",
        notes="门冬胰岛素"
    )
    db.create(item1)
    
    item2 = PackingItem(
        task_id=tasks[0].id,
        drug_batch_id=drug_batches[1].id,
        quantity=50,
        unit="支",
        notes="流感疫苗"
    )
    db.create(item2)
    
    item3 = PackingItem(
        task_id=tasks[1].id,
        drug_batch_id=drug_batches[3].id,
        quantity=10,
        unit="盒",
        notes="新冠检测试剂"
    )
    db.create(item3)
    
    item4 = PackingItem(
        task_id=tasks[2].id,
        drug_batch_id=drug_batches[2].id,
        quantity=15,
        unit="支",
        notes="甘精胰岛素"
    )
    db.create(item4)
    
    item5 = PackingItem(
        task_id=tasks[2].id,
        drug_batch_id=drug_batches[4].id,
        quantity=30,
        unit="支",
        notes="乙肝疫苗"
    )
    db.create(item5)


def create_temperature_readings(db: DatabaseManager, tasks, cooler_boxes):
    if not tasks or not cooler_boxes:
        return
    
    now = datetime.now()
    
    for task_idx, task in enumerate(tasks):
        if task.status == TaskStatus.TO_PACK:
            continue
        
        cooler_box = cooler_boxes[task_idx % len(cooler_boxes)]
        base_time = now - timedelta(hours=2)
        
        is_overtemp_case = (task_idx == 2)
        
        for i in range(20):
            reading_time = base_time + timedelta(minutes=i * 5)
            
            if is_overtemp_case and 8 <= i <= 12:
                temperature = random.uniform(10.5, 12.0)
                is_overtemp = True
            else:
                temperature = random.uniform(3.0, 7.0)
                is_overtemp = False
            
            reading = TemperatureReading(
                task_id=task.id,
                device_id=cooler_box.device_id,
                reading_time=reading_time,
                temperature=round(temperature, 2),
                box_number=cooler_box.box_number,
                battery=round(random.uniform(85, 95), 1),
                is_overtemp=is_overtemp,
                source_file="sample_data_generated"
            )
            db.create(reading)
            
            if is_overtemp:
                exception = ExceptionRecord(
                    task_id=task.id,
                    exception_type=ExceptionType.OVER_TEMPERATURE,
                    reading_id=reading.id,
                    details=f"超温记录: {temperature:.2f}°C (正常范围 2-8°C)",
                    is_resolved=False
                )
                db.create(exception)


def create_audit_logs(db: DatabaseManager, tasks):
    if not tasks:
        return
    
    for task in tasks:
        log1 = AuditLog(
            task_id=task.id,
            action="创建任务",
            operator=task.pharmacist or "系统",
            details=f"任务 {task.task_number} 已创建"
        )
        db.create(log1)
        
        if task.packing_time:
            log2 = AuditLog(
                task_id=task.id,
                action="完成装箱",
                operator=task.pharmacist or "系统",
                details="装箱清单已确认"
            )
            db.create(log2)
        
        if task.departure_time:
            log3 = AuditLog(
                task_id=task.id,
                action="开始运输",
                operator=task.courier or "系统",
                details=f"配送员 {task.courier} 已出发"
            )
            db.create(log3)
