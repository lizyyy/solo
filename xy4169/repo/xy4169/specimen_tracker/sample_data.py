"""示例数据生成器

用于生成测试用的示例数据，包含各种场景：
- 正常流程的标本
- 多部位标本（用于测试混淆检测）
- 超时标本
- 缺照片标本
- 待复核标本
"""

import random
from datetime import datetime, timedelta
from typing import List, Tuple

from .models import (
    Patient, Specimen, SpecimenEvent, 
    SpecimenStatus, EventType
)
from .database import DatabaseManager


class SampleDataGenerator:
    """示例数据生成器"""
    
    SURNAMES = ['王', '李', '张', '刘', '陈', '杨', '黄', '赵', '周', '吴']
    GIVEN_NAMES = ['明', '华', '伟', '芳', '娜', '秀英', '敏', '静', '丽', '强']
    LOCATIONS = [
        '左侧甲状腺', '右侧甲状腺', '乳腺', '肺叶', '肝脏',
        '胃', '结肠', '直肠', '子宫', '卵巢', '前列腺',
        '淋巴结', '皮下肿物', '骨骼'
    ]
    SPECIMEN_TYPES = ['冰冻切片', '快速石蜡', '术中快速']
    OPERATION_ROOMS = ['手术室1', '手术室2', '手术室3', '手术室4', '手术室5']
    SURGEONS = ['张医师', '李医师', '王医师', '刘医师', '陈医师']
    
    def __init__(self):
        self._specimen_counter = 0
        self._patient_counter = 0
    
    def generate_patients(self, count: int) -> List[Patient]:
        """生成指定数量的患者"""
        patients = []
        
        for i in range(count):
            surname = random.choice(self.SURNAMES)
            given_name = random.choice(self.GIVEN_NAMES)
            if random.random() > 0.5:
                given_name += random.choice(self.GIVEN_NAMES)
            
            patient = Patient(
                patient_id=f"P{datetime.now().strftime('%Y%m%d')}{self._patient_counter + 1:04d}",
                name=f"{surname}{given_name}",
                age=random.randint(18, 85),
                gender=random.choice(['男', '女']),
                bed_number=f"{random.randint(1, 20)}{random.choice(['A', 'B', 'C'])}",
                admission_number=f"ZY{datetime.now().strftime('%Y')}{random.randint(10000, 99999)}",
            )
            
            patients.append(patient)
            self._patient_counter += 1
        
        return patients
    
    def generate_specimens(self, patients: List[Patient], 
                           include_multi_part: bool = True,
                           include_anomalies: bool = True) -> Tuple[List[Specimen], List[SpecimenEvent]]:
        """生成标本数据及事件
        
        Args:
            patients: 患者列表
            include_multi_part: 是否包含多部位标本
            include_anomalies: 是否包含异常标本
            
        Returns:
            (标本列表, 事件列表)
        """
        specimens: List[Specimen] = []
        events: List[SpecimenEvent] = []
        
        for patient in patients:
            specimen_count = 1
            if include_multi_part and random.random() < 0.3:
                specimen_count = random.randint(2, 3)
            
            for i in range(specimen_count):
                specimen_no = f"BD{datetime.now().strftime('%Y%m%d')}{self._specimen_counter + 1:04d}"
                
                status_choices = list(SpecimenStatus)
                if include_anomalies:
                    status_weights = [0.15, 0.2, 0.15, 0.15, 0.1, 0.1, 0.05, 0.1]
                    status = random.choices(status_choices, weights=status_weights, k=1)[0]
                else:
                    status = SpecimenStatus.REGISTERED
                
                registered_time = datetime.now() - timedelta(
                    minutes=random.randint(5, 120)
                )
                
                location = random.choice(self.LOCATIONS)
                if specimen_count > 1:
                    other_locations = [l for l in self.LOCATIONS if l != location]
                    if other_locations:
                        location = random.choice(other_locations) if i > 0 else location
                
                has_csv = random.random() > 0.2
                has_specimen_bag = random.random() > 0.15
                photo_count = 0
                
                if status in [SpecimenStatus.PHOTO_COMPLETE, SpecimenStatus.PENDING_REVIEW,
                             SpecimenStatus.REVIEWED, SpecimenStatus.RELEASED]:
                    photo_count = random.randint(2, 8)
                elif status == SpecimenStatus.PENDING_PHOTO:
                    photo_count = random.randint(0, 1)
                else:
                    if random.random() > 0.5:
                        photo_count = random.randint(0, 2)
                
                reviewed_at = None
                released_at = None
                reviewed_by = ""
                
                if status in [SpecimenStatus.REVIEWED, SpecimenStatus.RELEASED]:
                    reviewed_at = registered_time + timedelta(minutes=random.randint(20, 40))
                    reviewed_by = random.choice(self.SURGEONS)
                
                if status == SpecimenStatus.RELEASED:
                    released_at = reviewed_at + timedelta(minutes=random.randint(5, 15)) if reviewed_at else None
                
                urgent_level = random.choice(['常规', '急诊']) if random.random() > 0.7 else '常规'
                
                specimen = Specimen(
                    specimen_no=specimen_no,
                    patient_id=patient.patient_id,
                    patient_name=patient.name,
                    location=location,
                    specimen_type=random.choice(self.SPECIMEN_TYPES),
                    operation_room=random.choice(self.OPERATION_ROOMS),
                    surgeon=random.choice(self.SURGEONS),
                    status=status,
                    photo_count=photo_count,
                    has_csv=has_csv,
                    has_specimen_bag=has_specimen_bag,
                    phone_remark="" if random.random() > 0.3 else "术中电话：需确认切缘",
                    urgent_level=urgent_level,
                    registered_at=registered_time,
                    reviewed_at=reviewed_at,
                    released_at=released_at,
                    due_time=registered_time + timedelta(minutes=30),
                    reviewed_by=reviewed_by,
                )
                
                specimen_events = self._generate_events_for_specimen(specimen, registered_time)
                events.extend(specimen_events)
                
                specimens.append(specimen)
                self._specimen_counter += 1
        
        return specimens, events
    
    def _generate_events_for_specimen(self, specimen: Specimen, 
                                        registered_time: datetime) -> List[SpecimenEvent]:
        """为标本生成时间线事件"""
        events: List[SpecimenEvent] = []
        
        events.append(SpecimenEvent(
            event_type=EventType.REGISTER,
            description=f"标本登记: {specimen.specimen_no}",
            operator=random.choice(self.SURGEONS),
            event_time=registered_time,
        ))
        
        current_time = registered_time
        
        if specimen.status != SpecimenStatus.REGISTERED:
            current_time += timedelta(minutes=random.randint(2, 10))
            events.append(SpecimenEvent(
                event_type=EventType.RECEIVE,
                description="标本接收确认",
                operator=random.choice(self.SURGEONS),
                event_time=current_time,
            ))
        
        if specimen.photo_count > 0:
            current_time += timedelta(minutes=random.randint(5, 15))
            events.append(SpecimenEvent(
                event_type=EventType.PHOTOGRAPH,
                description=f"完成拍照 {specimen.photo_count} 张",
                operator=random.choice(self.SURGEONS),
                event_time=current_time,
            ))
        
        if specimen.status in [SpecimenStatus.PENDING_REVIEW, SpecimenStatus.REVIEWED, SpecimenStatus.RELEASED]:
            current_time += timedelta(minutes=random.randint(10, 25))
            events.append(SpecimenEvent(
                event_type=EventType.REMARK,
                description="提交复核",
                operator=random.choice(self.SURGEONS),
                event_time=current_time,
            ))
        
        if specimen.reviewed_by and specimen.reviewed_at:
            events.append(SpecimenEvent(
                event_type=EventType.REVIEW,
                description=f"复核通过，签名: {specimen.reviewed_by}",
                operator=specimen.reviewed_by,
                event_time=specimen.reviewed_at,
            ))
        
        if specimen.released_at:
            events.append(SpecimenEvent(
                event_type=EventType.RELEASE,
                description="标本放行",
                operator=random.choice(self.SURGEONS),
                event_time=specimen.released_at,
            ))
        
        if specimen.phone_remark:
            events.append(SpecimenEvent(
                event_type=EventType.PHONE_CALL,
                description=specimen.phone_remark,
                operator=random.choice(self.SURGEONS),
                event_time=registered_time + timedelta(minutes=random.randint(15, 45)),
            ))
        
        if specimen.status == SpecimenStatus.DELAYED:
            events.append(SpecimenEvent(
                event_type=EventType.DELAY,
                description="标记延迟，等待进一步处理",
                operator=random.choice(self.SURGEONS),
                event_time=datetime.now(),
            ))
        
        return events
    
    def generate_sample_csv(self, file_path: str) -> bool:
        """生成示例 CSV 申请单文件
        
        Args:
            file_path: 输出文件路径
            
        Returns:
            是否成功生成
        """
        import csv
        
        patients = self.generate_patients(5)
        specimens, _ = self.generate_specimens(patients, include_multi_part=True, include_anomalies=False)
        
        try:
            with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    '标本号', '患者ID', '患者姓名', '年龄', '性别',
                    '床位号', '住院号', '部位', '标本类型',
                    '手术间', '手术医师', '紧急程度'
                ])
                
                for specimen in specimens:
                    patient = next((p for p in patients if p.patient_id == specimen.patient_id), None)
                    if patient:
                        writer.writerow([
                            specimen.specimen_no,
                            patient.patient_id,
                            patient.name,
                            patient.age,
                            patient.gender,
                            patient.bed_number,
                            patient.admission_number,
                            specimen.location,
                            specimen.specimen_type,
                            specimen.operation_room,
                            specimen.surgeon,
                            specimen.urgent_level,
                        ])
            
            return True
        except Exception:
            return False


def populate_database(db_manager: DatabaseManager, 
                       patient_count: int = 8,
                       include_multi_part: bool = True,
                       include_anomalies: bool = True) -> Tuple[List[Patient], List[Specimen]]:
    """将示例数据填充到数据库
    
    Args:
        db_manager: 数据库管理器
        patient_count: 患者数量
        include_multi_part: 是否包含多部位标本
        include_anomalies: 是否包含异常标本
        
    Returns:
        (患者列表, 标本列表)
    """
    generator = SampleDataGenerator()
    
    patients = generator.generate_patients(patient_count)
    specimens, events = generator.generate_specimens(patients, include_multi_part, include_anomalies)
    
    for patient in patients:
        db_manager.save_patient(patient)
    
    specimen_id_map = {}
    for specimen in specimens:
        db_manager.save_specimen(specimen)
        if specimen.id:
            specimen_id_map[specimen.specimen_no] = specimen.id
    
    for event in events:
        specimen_no = ""
        if "标本登记: " in event.description:
            specimen_no = event.description.replace("标本登记: ", "")
        
        if specimen_no and specimen_no in specimen_id_map:
            event.specimen_id = specimen_id_map[specimen_no]
            db_manager.save_event(event)
    
    return patients, specimens
