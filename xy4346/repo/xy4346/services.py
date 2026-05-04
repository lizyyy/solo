import json
from datetime import datetime, timedelta
from flask import current_app
from extensions import db
from models import (
    Equipment, Fridge, Volunteer, Application, AuditLog,
    EquipmentUsage, FridgeUsage
)


class EquipmentService:
    @staticmethod
    def get_all():
        return Equipment.query.all()
    
    @staticmethod
    def get_by_id(equipment_id):
        return Equipment.query.get(equipment_id)
    
    @staticmethod
    def create(data):
        equipment = Equipment(
            name=data.get('name'),
            type=data.get('type'),
            status=data.get('status', 'available')
        )
        db.session.add(equipment)
        db.session.commit()
        return equipment
    
    @staticmethod
    def update(equipment_id, data):
        equipment = Equipment.query.get(equipment_id)
        if equipment:
            if 'name' in data:
                equipment.name = data['name']
            if 'type' in data:
                equipment.type = data['type']
            if 'status' in data:
                equipment.status = data['status']
            db.session.commit()
        return equipment
    
    @staticmethod
    def delete(equipment_id):
        equipment = Equipment.query.get(equipment_id)
        if equipment:
            db.session.delete(equipment)
            db.session.commit()
            return True
        return False
    
    @staticmethod
    def get_available():
        return Equipment.query.filter_by(status='available').all()


class FridgeService:
    @staticmethod
    def get_all():
        return Fridge.query.all()
    
    @staticmethod
    def get_by_id(fridge_id):
        return Fridge.query.get(fridge_id)
    
    @staticmethod
    def create(data):
        fridge = Fridge(
            name=data.get('name'),
            type=data.get('type'),
            total_capacity=data.get('total_capacity'),
            used_capacity=data.get('used_capacity', 0.0),
            status=data.get('status', 'available')
        )
        db.session.add(fridge)
        db.session.commit()
        return fridge
    
    @staticmethod
    def update(fridge_id, data):
        fridge = Fridge.query.get(fridge_id)
        if fridge:
            if 'name' in data:
                fridge.name = data['name']
            if 'type' in data:
                fridge.type = data['type']
            if 'total_capacity' in data:
                fridge.total_capacity = data['total_capacity']
            if 'used_capacity' in data:
                fridge.used_capacity = data['used_capacity']
            if 'status' in data:
                fridge.status = data['status']
            db.session.commit()
        return fridge
    
    @staticmethod
    def delete(fridge_id):
        fridge = Fridge.query.get(fridge_id)
        if fridge:
            db.session.delete(fridge)
            db.session.commit()
            return True
        return False
    
    @staticmethod
    def get_available():
        return Fridge.query.filter_by(status='available').all()
    
    @staticmethod
    def get_available_capacity(fridge_id, start_time, end_time):
        """计算指定时段内冷藏格的可用容量"""
        fridge = Fridge.query.get(fridge_id)
        if not fridge:
            return 0.0
        
        # 查询同一时段的其他使用记录
        existing_usages = FridgeUsage.query.filter(
            FridgeUsage.fridge_id == fridge_id,
            FridgeUsage.start_time < end_time,
            FridgeUsage.end_time > start_time
        ).all()
        
        total_used = sum(usage.usage_capacity for usage in existing_usages)
        return fridge.total_capacity - total_used


class VolunteerService:
    @staticmethod
    def get_all():
        return Volunteer.query.all()
    
    @staticmethod
    def get_by_id(volunteer_id):
        return Volunteer.query.get(volunteer_id)
    
    @staticmethod
    def create(data):
        from datetime import date
        volunteer = Volunteer(
            name=data.get('name'),
            phone=data.get('phone'),
            email=data.get('email'),
            qualification_type=data.get('qualification_type'),
            qualification_number=data.get('qualification_number'),
            qualification_valid_from=datetime.strptime(data.get('qualification_valid_from'), '%Y-%m-%d').date() if data.get('qualification_valid_from') else None,
            qualification_valid_until=datetime.strptime(data.get('qualification_valid_until'), '%Y-%m-%d').date() if data.get('qualification_valid_until') else None,
            status=data.get('status', 'active')
        )
        db.session.add(volunteer)
        db.session.commit()
        return volunteer
    
    @staticmethod
    def update(volunteer_id, data):
        volunteer = Volunteer.query.get(volunteer_id)
        if volunteer:
            if 'name' in data:
                volunteer.name = data['name']
            if 'phone' in data:
                volunteer.phone = data['phone']
            if 'email' in data:
                volunteer.email = data['email']
            if 'qualification_type' in data:
                volunteer.qualification_type = data['qualification_type']
            if 'qualification_number' in data:
                volunteer.qualification_number = data['qualification_number']
            if 'qualification_valid_from' in data:
                volunteer.qualification_valid_from = datetime.strptime(data['qualification_valid_from'], '%Y-%m-%d').date()
            if 'qualification_valid_until' in data:
                volunteer.qualification_valid_until = datetime.strptime(data['qualification_valid_until'], '%Y-%m-%d').date()
            if 'status' in data:
                volunteer.status = data['status']
            db.session.commit()
        return volunteer
    
    @staticmethod
    def delete(volunteer_id):
        volunteer = Volunteer.query.get(volunteer_id)
        if volunteer:
            db.session.delete(volunteer)
            db.session.commit()
            return True
        return False
    
    @staticmethod
    def get_active():
        return Volunteer.query.filter_by(status='active').all()
    
    @staticmethod
    def check_qualification_valid(volunteer_id, check_date=None):
        """检查负责人资质在指定日期是否有效"""
        volunteer = Volunteer.query.get(volunteer_id)
        if not volunteer:
            return False, "负责人不存在"
        
        if volunteer.status != 'active':
            return False, "负责人状态非活跃"
        
        if check_date is None:
            check_date = datetime.utcnow().date()
        
        if isinstance(check_date, datetime):
            check_date = check_date.date()
        
        if check_date < volunteer.qualification_valid_from:
            return False, f"资质在 {volunteer.qualification_valid_from.isoformat()} 后才生效"
        
        if check_date > volunteer.qualification_valid_until:
            return False, f"资质已在 {volunteer.qualification_valid_until.isoformat()} 过期"
        
        warning_days = current_app.config.get('QUALIFICATION_EXPIRY_WARNING_DAYS', 7)
        days_until_expiry = (volunteer.qualification_valid_until - check_date).days
        if days_until_expiry <= warning_days:
            return True, f"资质将在 {days_until_expiry} 天后过期，请及时更新"
        
        return True, "资质有效"


class ApplicationService:
    @staticmethod
    def get_all():
        return Application.query.order_by(Application.created_at.desc()).all()
    
    @staticmethod
    def get_by_id(application_id):
        return Application.query.get(application_id)
    
    @staticmethod
    def create(data):
        application = Application(
            applicant_name=data.get('applicant_name'),
            applicant_phone=data.get('applicant_phone'),
            activity_name=data.get('activity_name'),
            activity_description=data.get('activity_description'),
            participant_count=data.get('participant_count'),
            start_time=datetime.fromisoformat(data.get('start_time')) if data.get('start_time') else None,
            end_time=datetime.fromisoformat(data.get('end_time')) if data.get('end_time') else None,
            volunteer_id=data.get('volunteer_id'),
            equipment_ids=json.dumps(data.get('equipment_ids', [])) if data.get('equipment_ids') else None,
            fridge_usage=json.dumps(data.get('fridge_usage', [])) if data.get('fridge_usage') else None,
            status='pending',
            risk_level='low'
        )
        db.session.add(application)
        db.session.commit()
        
        # 记录审核日志
        AuditLogService.create({
            'application_id': application.id,
            'action': 'create',
            'old_status': None,
            'new_status': 'pending',
            'notes': '创建申请'
        })
        
        return application
    
    @staticmethod
    def update(application_id, data):
        application = Application.query.get(application_id)
        if application:
            old_status = application.status
            
            if 'applicant_name' in data:
                application.applicant_name = data['applicant_name']
            if 'applicant_phone' in data:
                application.applicant_phone = data['applicant_phone']
            if 'activity_name' in data:
                application.activity_name = data['activity_name']
            if 'activity_description' in data:
                application.activity_description = data['activity_description']
            if 'participant_count' in data:
                application.participant_count = data['participant_count']
            if 'start_time' in data:
                application.start_time = datetime.fromisoformat(data['start_time'])
            if 'end_time' in data:
                application.end_time = datetime.fromisoformat(data['end_time'])
            if 'volunteer_id' in data:
                application.volunteer_id = data['volunteer_id']
            if 'equipment_ids' in data:
                application.equipment_ids = json.dumps(data['equipment_ids']) if data['equipment_ids'] else None
            if 'fridge_usage' in data:
                application.fridge_usage = json.dumps(data['fridge_usage']) if data['fridge_usage'] else None
            if 'status' in data:
                application.status = data['status']
            if 'risk_level' in data:
                application.risk_level = data['risk_level']
            if 'risk_notes' in data:
                application.risk_notes = data['risk_notes']
            if 'materials_needed' in data:
                application.materials_needed = json.dumps(data['materials_needed']) if data['materials_needed'] else None
            if 'reviewer_id' in data:
                application.reviewer_id = data['reviewer_id']
            if 'reviewer_name' in data:
                application.reviewer_name = data['reviewer_name']
            if 'review_notes' in data:
                application.review_notes = data['review_notes']
            if 'reviewed_at' in data:
                application.reviewed_at = data['reviewed_at']
            
            db.session.commit()
            
            # 记录审核日志
            if 'status' in data and old_status != data['status']:
                AuditLogService.create({
                    'application_id': application.id,
                    'action': 'update',
                    'old_status': old_status,
                    'new_status': data['status'],
                    'reviewer_id': data.get('reviewer_id'),
                    'reviewer_name': data.get('reviewer_name'),
                    'notes': data.get('review_notes', '更新申请状态')
                })
        
        return application
    
    @staticmethod
    def get_by_status(status):
        return Application.query.filter_by(status=status).order_by(Application.created_at.desc()).all()
    
    @staticmethod
    def get_need_materials():
        """获取需要补充材料的申请列表"""
        return Application.query.filter_by(status='need_materials').order_by(Application.created_at.desc()).all()
    
    @staticmethod
    def get_confirmed():
        """获取已确认排期的申请列表"""
        return Application.query.filter_by(status='confirmed').order_by(Application.start_time.asc()).all()
    
    @staticmethod
    def get_by_date_range(start_date, end_date):
        """获取指定日期范围内的申请"""
        return Application.query.filter(
            Application.start_time >= start_date,
            Application.start_time <= end_date
        ).order_by(Application.start_time.asc()).all()


class AuditLogService:
    @staticmethod
    def create(data):
        log = AuditLog(
            application_id=data.get('application_id'),
            action=data.get('action'),
            old_status=data.get('old_status'),
            new_status=data.get('new_status'),
            risk_level=data.get('risk_level'),
            risk_notes=data.get('risk_notes'),
            reviewer_id=data.get('reviewer_id'),
            reviewer_name=data.get('reviewer_name'),
            notes=data.get('notes')
        )
        db.session.add(log)
        db.session.commit()
        return log
    
    @staticmethod
    def get_by_application(application_id):
        return AuditLog.query.filter_by(application_id=application_id).order_by(AuditLog.created_at.desc()).all()


class EquipmentUsageService:
    @staticmethod
    def create(data):
        usage = EquipmentUsage(
            application_id=data.get('application_id'),
            equipment_id=data.get('equipment_id'),
            start_time=data.get('start_time'),
            end_time=data.get('end_time')
        )
        db.session.add(usage)
        db.session.commit()
        return usage
    
    @staticmethod
    def check_conflict(equipment_id, start_time, end_time, exclude_application_id=None):
        """检查设备在指定时段是否有冲突"""
        query = EquipmentUsage.query.filter(
            EquipmentUsage.equipment_id == equipment_id,
            EquipmentUsage.start_time < end_time,
            EquipmentUsage.end_time > start_time
        )
        
        if exclude_application_id:
            query = query.filter(EquipmentUsage.application_id != exclude_application_id)
        
        conflicts = query.all()
        return len(conflicts) > 0, conflicts


class FridgeUsageService:
    @staticmethod
    def create(data):
        usage = FridgeUsage(
            application_id=data.get('application_id'),
            fridge_id=data.get('fridge_id'),
            usage_capacity=data.get('usage_capacity'),
            start_time=data.get('start_time'),
            end_time=data.get('end_time')
        )
        db.session.add(usage)
        db.session.commit()
        return usage
    
    @staticmethod
    def get_by_application(application_id):
        return FridgeUsage.query.filter_by(application_id=application_id).all()
