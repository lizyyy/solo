from datetime import datetime, time
from app.models.plate_model import PlateModel
from app.models.acid_bath_model import AcidBathModel
from app.models.color_separation_model import ColorSeparationModel
from app.models.appointment_model import AppointmentModel
from app.models.review_model import ReviewIssueModel


class ReviewService:
    MAX_ETCHING_TIME_MINUTES = 120
    MIN_VENTILATION_STATUS = ['正常', '良好', '达标']
    ISSUE_TYPES = {
        'ETCHING_TIME_EXCEEDED': '酸蚀时间过长',
        'COLOR_ORDER_CONFLICT': '套色顺序冲突',
        'VENTILATION_NOT_OK': '通风未达标',
        'APPOINTMENT_CONFLICT': '预约撞槽'
    }

    @staticmethod
    def run_full_review():
        ReviewIssueModel.clear_all()
        plates = PlateModel.get_all()
        
        issues = []
        for plate in plates:
            plate_issues = ReviewService.review_single_plate(plate['plate_number'])
            issues.extend(plate_issues)
        
        return issues

    @staticmethod
    def review_single_plate(plate_number):
        issues = []
        
        plate = PlateModel.get_by_plate_number(plate_number)
        if not plate:
            return issues
        
        time_issue = ReviewService.check_etching_time(plate)
        if time_issue:
            issues.append(time_issue)
        
        color_issues = ReviewService.check_color_order(plate_number)
        issues.extend(color_issues)
        
        ventilation_issue = ReviewService.check_ventilation(plate_number)
        if ventilation_issue:
            issues.append(ventilation_issue)
        
        appointment_issues = ReviewService.check_appointment_conflicts(plate_number)
        issues.extend(appointment_issues)
        
        return issues

    @staticmethod
    def check_etching_time(plate):
        estimated_time = plate['estimated_etching_time']
        if estimated_time and estimated_time > ReviewService.MAX_ETCHING_TIME_MINUTES:
            issue_id = ReviewIssueModel.create(
                plate_number=plate['plate_number'],
                issue_type='ETCHING_TIME_EXCEEDED',
                issue_description=f'预估蚀刻时间 {estimated_time} 分钟，超过最大推荐时间 {ReviewService.MAX_ETCHING_TIME_MINUTES} 分钟',
                severity='error'
            )
            return {
                'id': issue_id,
                'plate_number': plate['plate_number'],
                'issue_type': 'ETCHING_TIME_EXCEEDED',
                'issue_description': f'预估蚀刻时间 {estimated_time} 分钟，超过最大推荐时间 {ReviewService.MAX_ETCHING_TIME_MINUTES} 分钟',
                'severity': 'error'
            }
        return None

    @staticmethod
    def check_color_order(plate_number):
        issues = []
        separations = ColorSeparationModel.get_by_plate_number(plate_number)
        
        if not separations or len(separations) < 2:
            return issues
        
        orders = [s['color_order'] for s in separations if s['color_order'] is not None]
        
        if len(orders) != len(set(orders)):
            issue_id = ReviewIssueModel.create(
                plate_number=plate_number,
                issue_type='COLOR_ORDER_CONFLICT',
                issue_description=f'存在重复的套色顺序号',
                severity='warning'
            )
            issues.append({
                'id': issue_id,
                'plate_number': plate_number,
                'issue_type': 'COLOR_ORDER_CONFLICT',
                'issue_description': '存在重复的套色顺序号',
                'severity': 'warning'
            })
        
        expected_orders = set(range(1, len(orders) + 1))
        actual_orders = set(orders)
        missing = expected_orders - actual_orders
        if missing:
            issue_id = ReviewIssueModel.create(
                plate_number=plate_number,
                issue_type='COLOR_ORDER_CONFLICT',
                issue_description=f'套色顺序不连续，缺少序号: {", ".join(map(str, sorted(missing)))}',
                severity='warning'
            )
            issues.append({
                'id': issue_id,
                'plate_number': plate_number,
                'issue_type': 'COLOR_ORDER_CONFLICT',
                'issue_description': f'套色顺序不连续，缺少序号: {", ".join(map(str, sorted(missing)))}',
                'severity': 'warning'
            })
        
        return issues

    @staticmethod
    def check_ventilation(plate_number):
        appointments = AppointmentModel.get_by_plate_number(plate_number)
        
        if not appointments:
            return None
        
        for appointment in appointments:
            bath_number = appointment['bath_number']
            if bath_number:
                bath_record = AcidBathModel.get_by_bath_number(bath_number)
                if bath_record:
                    ventilation = bath_record['ventilation_status']
                    if ventilation and ventilation not in ReviewService.MIN_VENTILATION_STATUS:
                        issue_id = ReviewIssueModel.create(
                            plate_number=plate_number,
                            issue_type='VENTILATION_NOT_OK',
                            issue_description=f'酸槽 {bath_number} 通风状态为 "{ventilation}"，未达到安全标准',
                            severity='error'
                        )
                        return {
                            'id': issue_id,
                            'plate_number': plate_number,
                            'issue_type': 'VENTILATION_NOT_OK',
                            'issue_description': f'酸槽 {bath_number} 通风状态为 "{ventilation}"，未达到安全标准',
                            'severity': 'error'
                        }
        
        return None

    @staticmethod
    def check_appointment_conflicts(plate_number):
        issues = []
        appointments = AppointmentModel.get_by_plate_number(plate_number)
        
        if not appointments:
            return issues
        
        for appointment in appointments:
            appt_date = appointment['appointment_date']
            bath_number = appointment['bath_number']
            start_time = appointment['start_time']
            end_time = appointment['end_time']
            
            if not all([appt_date, bath_number, start_time, end_time]):
                continue
            
            bath_appointments = AppointmentModel.get_by_date_and_bath(appt_date, bath_number)
            
            for other_appt in bath_appointments:
                if other_appt['id'] == appointment['id']:
                    continue
                
                other_start = other_appt['start_time']
                other_end = other_appt['end_time']
                
                if ReviewService._time_overlap(start_time, end_time, other_start, other_end):
                    issue_id = ReviewIssueModel.create(
                        plate_number=plate_number,
                        issue_type='APPOINTMENT_CONFLICT',
                        issue_description=f'预约时间 {appt_date} {start_time}-{end_time} 与学生 {other_appt["student_name"] or "未知"} 的预约时间冲突',
                        severity='error'
                    )
                    issues.append({
                        'id': issue_id,
                        'plate_number': plate_number,
                        'issue_type': 'APPOINTMENT_CONFLICT',
                        'issue_description': f'预约时间 {appt_date} {start_time}-{end_time} 与学生 {other_appt["student_name"] or "未知"} 的预约时间冲突',
                        'severity': 'error'
                    })
        
        return issues

    @staticmethod
    def _time_overlap(start1, end1, start2, end2):
        try:
            t1_start = ReviewService._parse_time(start1)
            t1_end = ReviewService._parse_time(end1)
            t2_start = ReviewService._parse_time(start2)
            t2_end = ReviewService._parse_time(end2)
            
            return not (t1_end <= t2_start or t2_end <= t1_start)
        except:
            return False

    @staticmethod
    def _parse_time(time_str):
        if not time_str:
            return time(0, 0)
        
        formats = ['%H:%M', '%H:%M:%S', '%I:%M %p', '%I:%M:%S %p']
        for fmt in formats:
            try:
                return datetime.strptime(str(time_str).strip(), fmt).time()
            except (ValueError, TypeError):
                continue
        
        parts = str(time_str).strip().split(':')
        if len(parts) >= 2:
            try:
                return time(int(parts[0]), int(parts[1]))
            except:
                pass
        
        return time(0, 0)

    @staticmethod
    def get_issue_type_name(issue_type):
        return ReviewService.ISSUE_TYPES.get(issue_type, issue_type)
