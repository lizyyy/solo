import uuid
from datetime import datetime, timedelta, date
from clinic_congestion.models import Database, AppointmentStatus, DoctorStatus


class SampleDataGenerator:
    def __init__(self, db: Database):
        self.db = db
        self.today = date.today().isoformat()

    def generate_basic_structure(self):
        self.db.insert_department('DEPT_INTERNAL', '内科门诊', '1-1', 'clinic')
        self.db.insert_department('DEPT_PEDIATRICS', '儿科门诊', '1-2', 'clinic')
        self.db.insert_department('DEPT_LAB', '检验窗口', '2-1', 'lab')

        self.db.insert_doctor('DOC_ZHANG', '张医生', 'DEPT_INTERNAL', '主任医师')
        self.db.insert_doctor('DOC_LI', '李医生', 'DEPT_INTERNAL', '副主任医师')
        self.db.insert_doctor('DOC_WANG', '王医生', 'DEPT_PEDIATRICS', '主治医师')
        self.db.insert_doctor('DOC_ZHAO', '赵医生', 'DEPT_LAB', '检验师')

        self.db.insert_doctor_status('DOC_ZHANG', DoctorStatus.ON_DUTY.value, '正常出诊', 'system')
        self.db.insert_doctor_status('DOC_LI', DoctorStatus.ON_DUTY.value, '正常出诊', 'system')
        self.db.insert_doctor_status('DOC_WANG', DoctorStatus.ON_DUTY.value, '正常出诊', 'system')
        self.db.insert_doctor_status('DOC_ZHAO', DoctorStatus.ON_DUTY.value, '正常出诊', 'system')

        return True

    def generate_internal_medicine_sample(self):
        base_date = self.today
        appointments = [
            {'id': 'APPT_A001', 'patient_name': '张三', 'patient_id': 'P001',
             'department_id': 'DEPT_INTERNAL', 'doctor_id': 'DOC_ZHANG',
             'appointment_date': base_date, 'appointment_time': '08:00',
             'queue_number': 'A001', 'source_type': 'booking'},
            {'id': 'APPT_A002', 'patient_name': '李四', 'patient_id': 'P002',
             'department_id': 'DEPT_INTERNAL', 'doctor_id': 'DOC_ZHANG',
             'appointment_date': base_date, 'appointment_time': '08:20',
             'queue_number': 'A002', 'source_type': 'booking'},
            {'id': 'APPT_A003', 'patient_name': '王五', 'patient_id': 'P003',
             'department_id': 'DEPT_INTERNAL', 'doctor_id': 'DOC_ZHANG',
             'appointment_date': base_date, 'appointment_time': '08:40',
             'queue_number': 'A003', 'source_type': 'booking'},
            {'id': 'APPT_A004', 'patient_name': '赵六', 'patient_id': 'P004',
             'department_id': 'DEPT_INTERNAL', 'doctor_id': 'DOC_ZHANG',
             'appointment_date': base_date, 'appointment_time': '09:00',
             'queue_number': 'A004', 'source_type': 'booking'},
            {'id': 'APPT_A005', 'patient_name': '孙七', 'patient_id': 'P005',
             'department_id': 'DEPT_INTERNAL', 'doctor_id': 'DOC_ZHANG',
             'appointment_date': base_date, 'appointment_time': '09:20',
             'queue_number': 'A005', 'source_type': 'booking'},
            {'id': 'APPT_A006', 'patient_name': '周八', 'patient_id': 'P006',
             'department_id': 'DEPT_INTERNAL', 'doctor_id': 'DOC_LI',
             'appointment_date': base_date, 'appointment_time': '08:30',
             'queue_number': 'A006', 'source_type': 'booking'},
            {'id': 'APPT_A007', 'patient_name': '吴九', 'patient_id': 'P007',
             'department_id': 'DEPT_INTERNAL', 'doctor_id': 'DOC_LI',
             'appointment_date': base_date, 'appointment_time': '08:50',
             'queue_number': 'A007', 'source_type': 'booking'},
            {'id': 'APPT_A008', 'patient_name': '郑十', 'patient_id': 'P008',
             'department_id': 'DEPT_INTERNAL', 'doctor_id': 'DOC_LI',
             'appointment_date': base_date, 'appointment_time': '09:10',
             'queue_number': 'A008', 'source_type': 'booking'},
            {'id': 'APPT_W001', 'patient_name': '现场患者1', 'patient_id': 'PW001',
             'department_id': 'DEPT_INTERNAL', 'doctor_id': None,
             'appointment_date': base_date, 'appointment_time': None,
             'queue_number': 'W001', 'source_type': 'walkin'},
            {'id': 'APPT_W002', 'patient_name': '现场患者2', 'patient_id': 'PW002',
             'department_id': 'DEPT_INTERNAL', 'doctor_id': None,
             'appointment_date': base_date, 'appointment_time': None,
             'queue_number': 'W002', 'source_type': 'walkin'},
            {'id': 'APPT_W003', 'patient_name': '现场患者3', 'patient_id': 'PW003',
             'department_id': 'DEPT_INTERNAL', 'doctor_id': None,
             'appointment_date': base_date, 'appointment_time': None,
             'queue_number': 'W003', 'source_type': 'walkin'},
        ]

        for appt in appointments:
            self.db.insert_appointment(appt)

        base_time = datetime.now().replace(hour=8, minute=0, second=0, microsecond=0)
        arrivals = [
            {'id': 'ARR_A001', 'appointment_id': 'APPT_A001',
             'arrival_time': (base_time - timedelta(minutes=15)).isoformat(), 'queue_position': 1},
            {'id': 'ARR_A002', 'appointment_id': 'APPT_A002',
             'arrival_time': (base_time - timedelta(minutes=10)).isoformat(), 'queue_position': 2},
            {'id': 'ARR_A003', 'appointment_id': 'APPT_A003',
             'arrival_time': (base_time - timedelta(minutes=5)).isoformat(), 'queue_position': 3},
            {'id': 'ARR_A004', 'appointment_id': 'APPT_A004',
             'arrival_time': base_time.isoformat(), 'queue_position': 4},
            {'id': 'ARR_A006', 'appointment_id': 'APPT_A006',
             'arrival_time': (base_time - timedelta(minutes=20)).isoformat(), 'queue_position': 5},
            {'id': 'ARR_A007', 'appointment_id': 'APPT_A007',
             'arrival_time': (base_time + timedelta(minutes=5)).isoformat(), 'queue_position': 6},
            {'id': 'ARR_W001', 'appointment_id': 'APPT_W001',
             'arrival_time': (base_time + timedelta(minutes=10)).isoformat(), 'queue_position': 7},
            {'id': 'ARR_W002', 'appointment_id': 'APPT_W002',
             'arrival_time': (base_time + timedelta(minutes=12)).isoformat(), 'queue_position': 8},
            {'id': 'ARR_W003', 'appointment_id': 'APPT_W003',
             'arrival_time': (base_time + timedelta(minutes=15)).isoformat(), 'queue_position': 9},
        ]

        for arr in arrivals:
            self.db.insert_arrival(arr)

        call_logs = [
            {'id': 'CALL_A001', 'appointment_id': 'APPT_A001',
             'call_time': base_time.isoformat(), 'queue_number': 'A001', 'window_number': '1-1'},
            {'id': 'CALL_A006', 'appointment_id': 'APPT_A006',
             'call_time': base_time.isoformat(), 'queue_number': 'A006', 'window_number': '1-1'},
            {'id': 'CALL_A002', 'appointment_id': 'APPT_A002',
             'call_time': (base_time + timedelta(minutes=10)).isoformat(),
             'queue_number': 'A002', 'window_number': '1-1'},
        ]

        for call in call_logs:
            self.db.insert_call_log(call)

        self.db.update_appointment_status('APPT_A001', AppointmentStatus.ARRIVED.value)
        self.db.update_appointment_status('APPT_A002', AppointmentStatus.ARRIVED.value)
        self.db.update_appointment_status('APPT_A003', AppointmentStatus.ARRIVED.value)
        self.db.update_appointment_status('APPT_A004', AppointmentStatus.ARRIVED.value)
        self.db.update_appointment_status('APPT_A005', AppointmentStatus.PENDING.value)
        self.db.update_appointment_status('APPT_A006', AppointmentStatus.CALLED.value)
        self.db.update_appointment_status('APPT_A007', AppointmentStatus.ARRIVED.value)
        self.db.update_appointment_status('APPT_A008', AppointmentStatus.PENDING.value)
        self.db.update_appointment_status('APPT_W001', AppointmentStatus.ARRIVED.value)
        self.db.update_appointment_status('APPT_W002', AppointmentStatus.ARRIVED.value)
        self.db.update_appointment_status('APPT_W003', AppointmentStatus.ARRIVED.value)

        return len(appointments)

    def generate_pediatrics_sample(self):
        base_date = self.today
        appointments = [
            {'id': 'APPT_P001', 'patient_name': '小明', 'patient_id': 'PP001',
             'department_id': 'DEPT_PEDIATRICS', 'doctor_id': 'DOC_WANG',
             'appointment_date': base_date, 'appointment_time': '08:00',
             'queue_number': 'P001', 'source_type': 'booking'},
            {'id': 'APPT_P002', 'patient_name': '小红', 'patient_id': 'PP002',
             'department_id': 'DEPT_PEDIATRICS', 'doctor_id': 'DOC_WANG',
             'appointment_date': base_date, 'appointment_time': '08:20',
             'queue_number': 'P002', 'source_type': 'booking'},
            {'id': 'APPT_P003', 'patient_name': '小刚', 'patient_id': 'PP003',
             'department_id': 'DEPT_PEDIATRICS', 'doctor_id': 'DOC_WANG',
             'appointment_date': base_date, 'appointment_time': '08:40',
             'queue_number': 'P003', 'source_type': 'booking'},
            {'id': 'APPT_P004', 'patient_name': '小燕', 'patient_id': 'PP004',
             'department_id': 'DEPT_PEDIATRICS', 'doctor_id': 'DOC_WANG',
             'appointment_date': base_date, 'appointment_time': '09:00',
             'queue_number': 'P004', 'source_type': 'booking'},
            {'id': 'APPT_P005', 'patient_name': '小华', 'patient_id': 'PP005',
             'department_id': 'DEPT_PEDIATRICS', 'doctor_id': 'DOC_WANG',
             'appointment_date': base_date, 'appointment_time': '09:20',
             'queue_number': 'P005', 'source_type': 'booking'},
            {'id': 'APPT_P006', 'patient_name': '现场儿科1', 'patient_id': 'PPW001',
             'department_id': 'DEPT_PEDIATRICS', 'doctor_id': None,
             'appointment_date': base_date, 'appointment_time': None,
             'queue_number': 'PW001', 'source_type': 'walkin'},
            {'id': 'APPT_P007', 'patient_name': '现场儿科2', 'patient_id': 'PPW002',
             'department_id': 'DEPT_PEDIATRICS', 'doctor_id': None,
             'appointment_date': base_date, 'appointment_time': None,
             'queue_number': 'PW002', 'source_type': 'walkin'},
        ]

        for appt in appointments:
            self.db.insert_appointment(appt)

        base_time = datetime.now().replace(hour=8, minute=0, second=0, microsecond=0)
        arrivals = [
            {'id': 'ARR_P001', 'appointment_id': 'APPT_P001',
             'arrival_time': (base_time - timedelta(minutes=20)).isoformat(), 'queue_position': 1},
            {'id': 'ARR_P002', 'appointment_id': 'APPT_P002',
             'arrival_time': (base_time - timedelta(minutes=15)).isoformat(), 'queue_position': 2},
            {'id': 'ARR_P003', 'appointment_id': 'APPT_P003',
             'arrival_time': (base_time - timedelta(minutes=10)).isoformat(), 'queue_position': 3},
            {'id': 'ARR_P004', 'appointment_id': 'APPT_P004',
             'arrival_time': (base_time - timedelta(minutes=5)).isoformat(), 'queue_position': 4},
            {'id': 'ARR_P006', 'appointment_id': 'APPT_P006',
             'arrival_time': base_time.isoformat(), 'queue_position': 5},
            {'id': 'ARR_P007', 'appointment_id': 'APPT_P007',
             'arrival_time': (base_time + timedelta(minutes=5)).isoformat(), 'queue_position': 6},
        ]

        for arr in arrivals:
            self.db.insert_arrival(arr)

        self.db.update_appointment_status('APPT_P001', AppointmentStatus.ARRIVED.value)
        self.db.update_appointment_status('APPT_P002', AppointmentStatus.ARRIVED.value)
        self.db.update_appointment_status('APPT_P003', AppointmentStatus.ARRIVED.value)
        self.db.update_appointment_status('APPT_P004', AppointmentStatus.ARRIVED.value)
        self.db.update_appointment_status('APPT_P005', AppointmentStatus.PENDING.value)
        self.db.update_appointment_status('APPT_P006', AppointmentStatus.ARRIVED.value)
        self.db.update_appointment_status('APPT_P007', AppointmentStatus.ARRIVED.value)

        return len(appointments)

    def generate_lab_sample(self):
        base_date = self.today
        appointments = [
            {'id': 'APPT_L001', 'patient_name': '检验患者1', 'patient_id': 'PL001',
             'department_id': 'DEPT_LAB', 'doctor_id': 'DOC_ZHAO',
             'appointment_date': base_date, 'appointment_time': '08:00',
             'queue_number': 'L001', 'source_type': 'booking'},
            {'id': 'APPT_L002', 'patient_name': '检验患者2', 'patient_id': 'PL002',
             'department_id': 'DEPT_LAB', 'doctor_id': 'DOC_ZHAO',
             'appointment_date': base_date, 'appointment_time': '08:15',
             'queue_number': 'L002', 'source_type': 'booking'},
            {'id': 'APPT_L003', 'patient_name': '检验患者3', 'patient_id': 'PL003',
             'department_id': 'DEPT_LAB', 'doctor_id': 'DOC_ZHAO',
             'appointment_date': base_date, 'appointment_time': '08:30',
             'queue_number': 'L003', 'source_type': 'booking'},
            {'id': 'APPT_L004', 'patient_name': '检验患者4', 'patient_id': 'PL004',
             'department_id': 'DEPT_LAB', 'doctor_id': 'DOC_ZHAO',
             'appointment_date': base_date, 'appointment_time': '08:45',
             'queue_number': 'L004', 'source_type': 'booking'},
        ]

        for appt in appointments:
            self.db.insert_appointment(appt)

        base_time = datetime.now().replace(hour=8, minute=0, second=0, microsecond=0)
        arrivals = [
            {'id': 'ARR_L001', 'appointment_id': 'APPT_L001',
             'arrival_time': (base_time - timedelta(minutes=10)).isoformat(), 'queue_position': 1},
            {'id': 'ARR_L002', 'appointment_id': 'APPT_L002',
             'arrival_time': (base_time - timedelta(minutes=5)).isoformat(), 'queue_position': 2},
            {'id': 'ARR_L003', 'appointment_id': 'APPT_L003',
             'arrival_time': base_time.isoformat(), 'queue_position': 3},
        ]

        for arr in arrivals:
            self.db.insert_arrival(arr)

        self.db.update_appointment_status('APPT_L001', AppointmentStatus.ARRIVED.value)
        self.db.update_appointment_status('APPT_L002', AppointmentStatus.ARRIVED.value)
        self.db.update_appointment_status('APPT_L003', AppointmentStatus.ARRIVED.value)
        self.db.update_appointment_status('APPT_L004', AppointmentStatus.PENDING.value)

        return len(appointments)

    def generate_failure_case_sample(self):
        base_date = self.today

        self.db.insert_doctor_status('DOC_LI', DoctorStatus.TEMP_SUSPENDED.value,
                                     '身体不适，临时停诊', '护士长_王芳')

        appointments = [
            {'id': 'APPT_FAIL_001', 'patient_name': '拥堵患者1', 'patient_id': 'PF001',
             'department_id': 'DEPT_INTERNAL', 'doctor_id': 'DOC_LI',
             'appointment_date': base_date, 'appointment_time': '08:30',
             'queue_number': 'AF001', 'source_type': 'booking'},
            {'id': 'APPT_FAIL_002', 'patient_name': '拥堵患者2', 'patient_id': 'PF002',
             'department_id': 'DEPT_INTERNAL', 'doctor_id': 'DOC_LI',
             'appointment_date': base_date, 'appointment_time': '08:50',
             'queue_number': 'AF002', 'source_type': 'booking'},
            {'id': 'APPT_FAIL_003', 'patient_name': '过号患者1', 'patient_id': 'PO001',
             'department_id': 'DEPT_INTERNAL', 'doctor_id': 'DOC_ZHANG',
             'appointment_date': base_date, 'appointment_time': '08:30',
             'queue_number': 'AO001', 'source_type': 'booking'},
            {'id': 'APPT_FAIL_004', 'patient_name': '过号患者2', 'patient_id': 'PO002',
             'department_id': 'DEPT_INTERNAL', 'doctor_id': 'DOC_ZHANG',
             'appointment_date': base_date, 'appointment_time': '08:40',
             'queue_number': 'AO002', 'source_type': 'booking'},
            {'id': 'APPT_FAIL_005', 'patient_name': '现场突发1', 'patient_id': 'PFW001',
             'department_id': 'DEPT_INTERNAL', 'doctor_id': None,
             'appointment_date': base_date, 'appointment_time': None,
             'queue_number': 'WF001', 'source_type': 'walkin'},
            {'id': 'APPT_FAIL_006', 'patient_name': '现场突发2', 'patient_id': 'PFW002',
             'department_id': 'DEPT_INTERNAL', 'doctor_id': None,
             'appointment_date': base_date, 'appointment_time': None,
             'queue_number': 'WF002', 'source_type': 'walkin'},
            {'id': 'APPT_FAIL_007', 'patient_name': '现场突发3', 'patient_id': 'PFW003',
             'department_id': 'DEPT_INTERNAL', 'doctor_id': None,
             'appointment_date': base_date, 'appointment_time': None,
             'queue_number': 'WF003', 'source_type': 'walkin'},
        ]

        for appt in appointments:
            self.db.insert_appointment(appt)

        base_time = datetime.now().replace(hour=8, minute=30, second=0, microsecond=0)
        arrivals = [
            {'id': 'ARR_FAIL_001', 'appointment_id': 'APPT_FAIL_001',
             'arrival_time': (base_time - timedelta(minutes=15)).isoformat(), 'queue_position': 1},
            {'id': 'ARR_FAIL_002', 'appointment_id': 'APPT_FAIL_002',
             'arrival_time': (base_time - timedelta(minutes=10)).isoformat(), 'queue_position': 2},
            {'id': 'ARR_FAIL_003', 'appointment_id': 'APPT_FAIL_003',
             'arrival_time': (base_time + timedelta(minutes=5)).isoformat(), 'queue_position': 3},
            {'id': 'ARR_FAIL_004', 'appointment_id': 'APPT_FAIL_004',
             'arrival_time': (base_time + timedelta(minutes=8)).isoformat(), 'queue_position': 4},
            {'id': 'ARR_FAIL_005', 'appointment_id': 'APPT_FAIL_005',
             'arrival_time': (base_time + timedelta(minutes=3)).isoformat(), 'queue_position': 5},
            {'id': 'ARR_FAIL_006', 'appointment_id': 'APPT_FAIL_006',
             'arrival_time': (base_time + timedelta(minutes=4)).isoformat(), 'queue_position': 6},
            {'id': 'ARR_FAIL_007', 'appointment_id': 'APPT_FAIL_007',
             'arrival_time': (base_time + timedelta(minutes=6)).isoformat(), 'queue_position': 7},
        ]

        for arr in arrivals:
            self.db.insert_arrival(arr)

        overcalls = [
            {'id': 'OC_FAIL_001', 'appointment_id': 'APPT_FAIL_003',
             'overcall_time': base_time.isoformat(), 'reason': '患者暂离，过号',
             'new_queue_number': 'AO001R', 'requeue_count': 1},
        ]

        for oc in overcalls:
            self.db.insert_overcall(oc)

        self.db.update_appointment_status('APPT_FAIL_001', AppointmentStatus.ARRIVED.value)
        self.db.update_appointment_status('APPT_FAIL_002', AppointmentStatus.ARRIVED.value)
        self.db.update_appointment_status('APPT_FAIL_003', AppointmentStatus.OVERCALLED.value)
        self.db.update_appointment_status('APPT_FAIL_004', AppointmentStatus.ARRIVED.value)
        self.db.update_appointment_status('APPT_FAIL_005', AppointmentStatus.ARRIVED.value)
        self.db.update_appointment_status('APPT_FAIL_006', AppointmentStatus.ARRIVED.value)
        self.db.update_appointment_status('APPT_FAIL_007', AppointmentStatus.ARRIVED.value)

        return len(appointments)

    def generate_all_samples(self):
        self.generate_basic_structure()
        internal_count = self.generate_internal_medicine_sample()
        pediatrics_count = self.generate_pediatrics_sample()
        lab_count = self.generate_lab_sample()
        return {
            'internal_medicine': internal_count,
            'pediatrics': pediatrics_count,
            'lab': lab_count
        }

    def generate_failure_case(self):
        return self.generate_failure_case_sample()
