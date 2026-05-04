import json
from datetime import datetime, timedelta
from flask import current_app
from extensions import db
from models import Equipment, Fridge, Volunteer, Application
from services import (
    EquipmentUsageService, FridgeService, VolunteerService,
    FridgeUsageService
)


class RiskCheckResult:
    def __init__(self):
        self.passed = True
        self.risk_level = 'low'
        self.notes = []
        self.warnings = []
        self.errors = []
    
    def add_warning(self, message):
        self.warnings.append(message)
        self.notes.append(f"[警告] {message}")
        if self.risk_level == 'low':
            self.risk_level = 'medium'
    
    def add_error(self, message):
        self.errors.append(message)
        self.notes.append(f"[错误] {message}")
        self.risk_level = 'high'
        self.passed = False
    
    def to_dict(self):
        return {
            'passed': self.passed,
            'risk_level': self.risk_level,
            'notes': '\n'.join(self.notes),
            'warnings': self.warnings,
            'errors': self.errors
        }


class RiskControlService:
    @staticmethod
    def check_application(application_data, exclude_application_id=None):
        """
        全面检查申请的风控情况
        :param application_data: 申请数据字典
        :param exclude_application_id: 排除的申请ID（用于更新时检查）
        :return: RiskCheckResult
        """
        result = RiskCheckResult()
        
        # 1. 检查设备冲突
        RiskControlService._check_equipment_conflict(
            result, application_data, exclude_application_id
        )
        
        # 2. 检查冷藏格容量
        RiskControlService._check_fridge_capacity(
            result, application_data, exclude_application_id
        )
        
        # 3. 检查负责人资质
        RiskControlService._check_volunteer_qualification(
            result, application_data
        )
        
        # 4. 检查人数风险
        RiskControlService._check_participant_count(
            result, application_data
        )
        
        return result
    
    @staticmethod
    def _check_equipment_conflict(result, application_data, exclude_application_id=None):
        """检查设备在指定时段是否有冲突"""
        equipment_ids = application_data.get('equipment_ids', [])
        if not equipment_ids:
            return
        
        start_time = application_data.get('start_time')
        end_time = application_data.get('end_time')
        
        if not start_time or not end_time:
            result.add_warning("未指定时段，无法检查设备冲突")
            return
        
        if isinstance(start_time, str):
            start_time = datetime.fromisoformat(start_time)
        if isinstance(end_time, str):
            end_time = datetime.fromisoformat(end_time)
        
        for equipment_id in equipment_ids:
            has_conflict, conflicts = EquipmentUsageService.check_conflict(
                equipment_id, start_time, end_time, exclude_application_id
            )
            
            if has_conflict:
                equipment = Equipment.query.get(equipment_id)
                equipment_name = equipment.name if equipment else f"设备#{equipment_id}"
                conflict_details = []
                for conflict in conflicts:
                    conflict_app = Application.query.get(conflict.application_id)
                    if conflict_app:
                        conflict_details.append(
                            f"申请 #{conflict_app.id} ({conflict_app.activity_name}): "
                            f"{conflict.start_time.strftime('%Y-%m-%d %H:%M')} - {conflict.end_time.strftime('%Y-%m-%d %H:%M')}"
                        )
                
                result.add_error(
                    f"设备 [{equipment_name}] 在指定时段有冲突:\n" +
                    "\n".join(conflict_details)
                )
    
    @staticmethod
    def _check_fridge_capacity(result, application_data, exclude_application_id=None):
        """检查冷藏格容量是否足够"""
        fridge_usage = application_data.get('fridge_usage', [])
        if not fridge_usage:
            return
        
        start_time = application_data.get('start_time')
        end_time = application_data.get('end_time')
        
        if not start_time or not end_time:
            result.add_warning("未指定时段，无法检查冷藏格容量")
            return
        
        if isinstance(start_time, str):
            start_time = datetime.fromisoformat(start_time)
        if isinstance(end_time, str):
            end_time = datetime.fromisoformat(end_time)
        
        warning_threshold = current_app.config.get(
            'FRIDGE_CAPACITY_WARNING_THRESHOLD', 0.8
        )
        
        for usage in fridge_usage:
            fridge_id = usage.get('fridge_id')
            usage_capacity = usage.get('usage_capacity', 0.0)
            
            fridge = Fridge.query.get(fridge_id)
            if not fridge:
                result.add_error(f"冷藏格 #{fridge_id} 不存在")
                continue
            
            if fridge.status != 'available':
                result.add_error(f"冷藏格 [{fridge.name}] 当前不可用（状态: {fridge.status}）")
                continue
            
            # 计算可用容量
            available_capacity = FridgeService.get_available_capacity(
                fridge_id, start_time, end_time
            )
            
            # 如果是更新申请，需要减去当前申请已占用的容量
            if exclude_application_id:
                existing_usages = FridgeUsageService.get_by_application(exclude_application_id)
                for eu in existing_usages:
                    if eu.fridge_id == fridge_id:
                        available_capacity += eu.usage_capacity
            
            if usage_capacity > available_capacity:
                result.add_error(
                    f"冷藏格 [{fridge.name}] 容量不足：\n"
                    f"需要: {usage_capacity} 升，可用: {available_capacity:.2f} 升"
                )
            else:
                # 检查容量警告阈值
                remaining_after = available_capacity - usage_capacity
                usage_ratio = (fridge.total_capacity - remaining_after) / fridge.total_capacity
                
                if usage_ratio >= warning_threshold:
                    result.add_warning(
                        f"冷藏格 [{fridge.name}] 使用率将达到 {usage_ratio*100:.1f}%，"
                        f"建议提前准备备用冷藏空间"
                    )
    
    @staticmethod
    def _check_volunteer_qualification(result, application_data):
        """检查负责人资质是否有效"""
        volunteer_id = application_data.get('volunteer_id')
        if not volunteer_id:
            result.add_warning("未指定负责人，无法检查资质")
            return
        
        start_time = application_data.get('start_time')
        check_date = None
        
        if start_time:
            if isinstance(start_time, str):
                check_date = datetime.fromisoformat(start_time)
            else:
                check_date = start_time
        
        is_valid, message = VolunteerService.check_qualification_valid(
            volunteer_id, check_date
        )
        
        volunteer = Volunteer.query.get(volunteer_id)
        volunteer_name = volunteer.name if volunteer else f"负责人#{volunteer_id}"
        
        if not is_valid:
            result.add_error(f"负责人 [{volunteer_name}] 资质无效：{message}")
        else:
            if "过期" in message:
                result.add_warning(f"负责人 [{volunteer_name}] {message}")
    
    @staticmethod
    def _check_participant_count(result, application_data):
        """检查活动人数是否超过限制"""
        participant_count = application_data.get('participant_count', 0)
        max_participants = current_app.config.get('MAX_PARTICIPANTS', 50)
        
        if participant_count <= 0:
            result.add_error("活动人数必须大于0")
        elif participant_count > max_participants:
            result.add_error(
                f"活动人数 ({participant_count}) 超过最大限制 ({max_participants})"
            )
        elif participant_count > max_participants * 0.8:
            result.add_warning(
                f"活动人数 ({participant_count}) 接近最大限制 ({max_participants})，"
                f"建议提前做好安全预案"
            )
