from datetime import datetime, timedelta
from models import Rental, Equipment, Student, Anomaly, Reminder
from app import db
import hashlib

class AnomalyDetector:
    @staticmethod
    def generate_idempotency_key(rental_id, anomaly_type):
        key = f"{rental_id}_{anomaly_type}"
        return hashlib.md5(key.encode()).hexdigest()

    @staticmethod
    def check_idempotency(rental_id, anomaly_type):
        idempotency_key = AnomalyDetector.generate_idempotency_key(rental_id, anomaly_type)
        existing = Anomaly.query.filter_by(
            rental_id=rental_id,
            type=anomaly_type,
            resolved=False
        ).first()
        return existing is not None, idempotency_key

    @staticmethod
    def create_anomaly(rental_id, anomaly_type, description, severity='warning', 
                       suggested_action=None):
        exists, _ = AnomalyDetector.check_idempotency(rental_id, anomaly_type)
        if exists:
            return None
        
        anomaly = Anomaly(
            rental_id=rental_id,
            type=anomaly_type,
            description=description,
            severity=severity,
            suggested_action=suggested_action
        )
        db.session.add(anomaly)
        db.session.commit()
        return anomaly

    @staticmethod
    def detect_deposit_refund_anomalies():
        anomalies = []
        rentals = Rental.query.filter(Rental.return_date != None).all()
        
        for rental in rentals:
            if rental.deposit_paid <= 0:
                continue
            
            total_charges = rental.rental_fee + rental.damage_fee
            expected_refund = rental.deposit_paid - total_charges
            actual_refund = rental.deposit_refunded
            
            if abs(expected_refund - actual_refund) > 0.01:
                if expected_refund > actual_refund:
                    amount = expected_refund - actual_refund
                    anomaly_type = 'deposit_under_refund'
                    description = f"押金退款不足：应退 {expected_refund:.2f} 元，实退 {actual_refund:.2f} 元，差额 {amount:.2f} 元"
                    suggested_action = "核查押金退款记录，确认是否漏退或计算错误，联系学生补足退款"
                else:
                    amount = actual_refund - expected_refund
                    anomaly_type = 'deposit_over_refund'
                    description = f"押金超额退款：应退 {expected_refund:.2f} 元，实退 {actual_refund:.2f} 元，超额 {amount:.2f} 元"
                    suggested_action = "核查退款审批流程，确认是否操作失误，联系学生追回超额退款"
                
                anomaly = AnomalyDetector.create_anomaly(
                    rental.id, anomaly_type, description, 'error', suggested_action
                )
                if anomaly:
                    anomalies.append(anomaly)
        
        return anomalies

    @staticmethod
    def detect_equipment_serial_anomalies():
        anomalies = []
        equipment_list = Equipment.query.all()
        serial_map = {}
        
        for eq in equipment_list:
            serial = eq.serial_number.strip().upper() if eq.serial_number else ''
            if not serial:
                anomaly_type = 'missing_serial'
                description = f"设备 {eq.name} (ID:{eq.id}) 缺少设备编号"
                suggested_action = "核实设备身份，补充正确的设备编号"
                anomaly = AnomalyDetector.create_anomaly(
                    None, anomaly_type, description, 'warning', suggested_action
                )
                if anomaly:
                    anomalies.append(anomaly)
                continue
            
            if serial in serial_map:
                existing_eq = serial_map[serial]
                anomaly_type = 'duplicate_serial'
                description = f"设备编号重复：{serial} 同时属于设备 '{existing_eq.name}' 和 '{eq.name}'"
                suggested_action = "核查两台设备的真实编号，修正重复的设备编号"
                anomaly = AnomalyDetector.create_anomaly(
                    None, anomaly_type, description, 'error', suggested_action
                )
                if anomaly:
                    anomalies.append(anomaly)
            else:
                serial_map[serial] = eq
        
        return anomalies

    @staticmethod
    def detect_overdue_anomalies():
        anomalies = []
        now = datetime.now()
        overdue_rentals = Rental.query.filter(
            Rental.return_date == None,
            Rental.due_date < now
        ).all()
        
        for rental in overdue_rentals:
            overdue_days = (now - rental.due_date).days
            
            if overdue_days >= 30:
                severity = 'error'
            elif overdue_days >= 7:
                severity = 'warning'
            else:
                severity = 'info'
            
            anomaly_type = f'return_overdue_{overdue_days}d'
            description = f"设备超期未归还：已超期 {overdue_days} 天，学生：{rental.student.name if rental.student else '未知'}"
            
            if overdue_days >= 30:
                suggested_action = "严重超期！立即联系学生确认设备状态，必要时启动押金抵扣或赔偿流程"
            elif overdue_days >= 7:
                suggested_action = "发送催还通知，联系学生确认归还时间"
            else:
                suggested_action = "发送友好提醒，确认归还计划"
            
            anomaly = AnomalyDetector.create_anomaly(
                rental.id, anomaly_type, description, severity, suggested_action
            )
            if anomaly:
                anomalies.append(anomaly)
        
        return anomalies

    @staticmethod
    def detect_empty_value_anomalies():
        anomalies = []
        
        students = Student.query.all()
        for student in students:
            if not student.name or student.name.strip() == '':
                anomaly_type = 'empty_student_name'
                description = f"学生记录 (ID:{student.id}) 姓名字段为空"
                suggested_action = "补充学生姓名信息"
                anomaly = AnomalyDetector.create_anomaly(
                    None, anomaly_type, description, 'warning', suggested_action
                )
                if anomaly:
                    anomalies.append(anomaly)
        
        equipment = Equipment.query.all()
        for eq in equipment:
            if not eq.name or eq.name.strip() == '':
                anomaly_type = 'empty_equipment_name'
                description = f"设备记录 (ID:{eq.id}) 名称字段为空"
                suggested_action = "补充设备名称信息"
                anomaly = AnomalyDetector.create_anomaly(
                    None, anomaly_type, description, 'warning', suggested_action
                )
                if anomaly:
                    anomalies.append(anomaly)
        
        rentals = Rental.query.all()
        for rental in rentals:
            if rental.deposit_paid == 0 and rental.status == 'active':
                anomaly_type = 'zero_deposit_active'
                description = f"租赁单 (ID:{rental.id}) 处于活跃状态但押金为0"
                suggested_action = "确认押金是否已收取，如未收取应及时催收"
                anomaly = AnomalyDetector.create_anomaly(
                    rental.id, anomaly_type, description, 'warning', suggested_action
                )
                if anomaly:
                    anomalies.append(anomaly)
        
        return anomalies

    @staticmethod
    def detect_duplicate_rental_anomalies():
        anomalies = []
        
        rentals = Rental.query.filter(Rental.return_date == None).all()
        equipment_rentals = {}
        
        for rental in rentals:
            eq_id = rental.equipment_id
            if eq_id in equipment_rentals:
                anomaly_type = 'duplicate_active_rental'
                other_rental = equipment_rentals[eq_id]
                description = f"设备 (ID:{eq_id}) 同时有两个活跃租赁单：ID {rental.id} 和 ID {other_rental.id}"
                suggested_action = "核查租赁记录，确认哪个是有效租赁，关闭无效租赁单"
                anomaly = AnomalyDetector.create_anomaly(
                    rental.id, anomaly_type, description, 'error', suggested_action
                )
                if anomaly:
                    anomalies.append(anomaly)
            else:
                equipment_rentals[eq_id] = rental
        
        return anomalies

    @staticmethod
    def detect_boundary_value_anomalies():
        anomalies = []
        
        rentals = Rental.query.all()
        for rental in rentals:
            if rental.deposit_paid < 0:
                anomaly_type = 'negative_deposit'
                description = f"租赁单 (ID:{rental.id}) 押金金额为负数: {rental.deposit_paid}"
                suggested_action = "核查数据录入错误，修正押金金额"
                anomaly = AnomalyDetector.create_anomaly(
                    rental.id, anomaly_type, description, 'error', suggested_action
                )
                if anomaly:
                    anomalies.append(anomaly)
            
            if rental.rental_fee < 0:
                anomaly_type = 'negative_rental_fee'
                description = f"租赁单 (ID:{rental.id}) 租金为负数: {rental.rental_fee}"
                suggested_action = "核查数据录入错误，修正租金金额"
                anomaly = AnomalyDetector.create_anomaly(
                    rental.id, anomaly_type, description, 'error', suggested_action
                )
                if anomaly:
                    anomalies.append(anomaly)
            
            if rental.return_date and rental.rent_date and rental.return_date < rental.rent_date:
                anomaly_type = 'return_before_rent'
                description = f"租赁单 (ID:{rental.id}) 归还日期早于租赁日期"
                suggested_action = "核查日期录入错误，修正归还日期或租赁日期"
                anomaly = AnomalyDetector.create_anomaly(
                    rental.id, anomaly_type, description, 'error', suggested_action
                )
                if anomaly:
                    anomalies.append(anomaly)
        
        return anomalies

    @staticmethod
    def run_all_checks():
        all_anomalies = []
        all_anomalies.extend(AnomalyDetector.detect_deposit_refund_anomalies())
        all_anomalies.extend(AnomalyDetector.detect_equipment_serial_anomalies())
        all_anomalies.extend(AnomalyDetector.detect_overdue_anomalies())
        all_anomalies.extend(AnomalyDetector.detect_empty_value_anomalies())
        all_anomalies.extend(AnomalyDetector.detect_duplicate_rental_anomalies())
        all_anomalies.extend(AnomalyDetector.detect_boundary_value_anomalies())
        return all_anomalies

    @staticmethod
    def resolve_anomaly(anomaly_id, resolved_by, resolution):
        anomaly = Anomaly.query.get(anomaly_id)
        if not anomaly:
            return {'success': False, 'error': '异常记录不存在'}
        
        anomaly.resolved = True
        anomaly.resolved_by = resolved_by
        anomaly.resolved_at = datetime.now()
        anomaly.resolution = resolution
        db.session.commit()
        
        return {'success': True, 'anomaly': anomaly}
