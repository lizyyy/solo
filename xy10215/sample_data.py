from datetime import datetime, timedelta
from services import DoctorService, ScheduleService, PatientService


def load_sample_data():
    doctor1 = DoctorService.create_doctor('张医生', '口腔正畸科', '13800000001')
    doctor2 = DoctorService.create_doctor('李医生', '口腔正畸科', '13800000002')
    doctor3 = DoctorService.create_doctor('王医生', '口腔正畸科', '13800000003')
    
    today = datetime.now().date()
    for i in range(14):
        schedule_date = (today + timedelta(days=i)).strftime('%Y-%m-%d')
        if i < 7:
            ScheduleService.create_schedule(doctor1, schedule_date, '09:00', '12:00', 8)
            ScheduleService.create_schedule(doctor1, schedule_date, '14:00', '17:00', 8)
        ScheduleService.create_schedule(doctor2, schedule_date, '09:00', '12:00', 10)
        ScheduleService.create_schedule(doctor2, schedule_date, '14:00', '17:00', 10)
        ScheduleService.create_schedule(doctor3, schedule_date, '09:00', '12:00', 6)
        ScheduleService.create_schedule(doctor3, schedule_date, '14:00', '17:00', 6)
    
    start_window = (today - timedelta(days=14)).strftime('%Y-%m-%d')
    start_future = today.strftime('%Y-%m-%d')
    start_overdue = (today - timedelta(days=30)).strftime('%Y-%m-%d')
    
    PatientService.create_patient('王明', 25, '13900000001', start_window, 2, doctor1, '轻度拥挤 - 今明两天复诊窗口')
    PatientService.create_patient('李华', 18, '13900000002', start_window, 2, doctor2, '中度拥挤 - 今明两天复诊窗口')
    PatientService.create_patient('张丽', 32, '13900000003', start_future, 2, doctor3, '深覆合 - 2周后首次复诊')
    PatientService.create_patient('赵强', 22, '13900000004', start_overdue, 4, doctor1, '开颌 - 已逾期')
    PatientService.create_patient('陈敏', 28, '13900000005', start_future, 4, doctor2, '牙列稀疏 - 4周后首次复诊')
    PatientService.create_patient('刘洋', 16, '13900000006', start_overdue, 4, doctor3, '反颌 - 已逾期，需紧急处理')
    
    print('样例数据加载完成')
    print(f'医生: {doctor1}, {doctor2}, {doctor3}')
