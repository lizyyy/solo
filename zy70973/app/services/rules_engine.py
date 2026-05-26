from typing import Dict, Any, List, Tuple, Optional
from sqlalchemy.orm import Session
from app.models.models import Registration, Waitlist, Checkin, Blacklist, ProcessedRecord
from app.services.data_parser import DataParser
from datetime import datetime
import json

class RulesEngine:
    def __init__(self, db: Session):
        self.db = db
    
    def check_blacklist(self, phone: str, id_card: Optional[str] = None) -> Tuple[bool, str]:
        query = self.db.query(Blacklist).filter(Blacklist.is_active == True)
        if phone:
            query = query.filter(Blacklist.phone == phone)
        if id_card:
            query = query.filter(Blacklist.id_card == id_card)
        
        blacklist_entry = query.first()
        if blacklist_entry:
            return True, f"用户在黑名单中: {blacklist_entry.reason}"
        return False, ""
    
    def check_duplicate_registration(self, phone: str, activity_name: str, activity_session: str) -> Tuple[bool, str]:
        existing = self.db.query(Registration).filter(
            Registration.phone == phone,
            Registration.activity_name == activity_name,
            Registration.activity_session == activity_session
        ).first()
        if existing:
            return True, f"该手机号已报名此活动场次，报名时间: {existing.register_time}"
        return False, ""
    
    def check_waitlist_and_promote(self, phone: str, activity_name: str, activity_session: str) -> Tuple[bool, str, Optional[Waitlist]]:
        waitlist_entry = self.db.query(Waitlist).filter(
            Waitlist.phone == phone,
            Waitlist.activity_name == activity_name,
            Waitlist.activity_session == activity_session,
            Waitlist.status == "waiting"
        ).first()
        
        if waitlist_entry:
            return True, "用户在候补列表中，可自动递补", waitlist_entry
        return False, "", None
    
    def process_registration(self, record: Dict[str, Any], batch_no: str) -> Dict[str, Any]:
        result = {
            "status": "success",
            "record_type": "registration",
            "original_data": record,
            "phone": None,
            "name": None,
            "activity_name": None,
            "activity_session": None,
            "id_card": None,
            "error_message": None,
            "suggestion": None
        }
        
        phone = DataParser.clean_phone(record.get('phone', ''))
        name = record.get('name', '')
        activity_name = record.get('activity_name', '')
        activity_session = record.get('activity_session', '')
        id_card = record.get('id_card', '')
        
        result["phone"] = phone
        result["name"] = name
        result["activity_name"] = activity_name
        result["activity_session"] = activity_session
        result["id_card"] = id_card
        
        if not phone or not name or not activity_name or not activity_session:
            result["status"] = "failed"
            result["error_message"] = "缺少必填字段: 手机号、姓名、活动名称、场次"
            result["suggestion"] = "请补充完整的报名信息后重新提交"
            return result
        
        is_blacklisted, blacklist_msg = self.check_blacklist(phone, id_card)
        if is_blacklisted:
            result["status"] = "failed"
            result["error_message"] = blacklist_msg
            result["suggestion"] = "请联系管理员解除黑名单限制，或使用其他身份报名"
            return result
        
        is_duplicate, duplicate_msg = self.check_duplicate_registration(phone, activity_name, activity_session)
        if is_duplicate:
            result["status"] = "failed"
            result["error_message"] = duplicate_msg
            result["suggestion"] = "无需重复报名，可直接参加活动；如需修改信息请联系管理员"
            return result
        
        in_waitlist, waitlist_msg, waitlist_entry = self.check_waitlist_and_promote(phone, activity_name, activity_session)
        if in_waitlist and waitlist_entry:
            waitlist_entry.status = "promoted"
            result["suggestion"] = "从候补列表自动递补成功"
        
        try:
            register_time = DataParser.parse_datetime(record.get('register_time', ''))
            
            new_reg = Registration(
                phone=phone,
                name=name,
                activity_name=activity_name,
                activity_session=activity_session,
                id_card=id_card,
                register_time=register_time,
                status="registered",
                source_batch=batch_no
            )
            self.db.add(new_reg)
            self.db.flush()
            
        except Exception as e:
            self.db.rollback()
            result["status"] = "pending"
            result["error_message"] = f"系统处理异常: {str(e)}"
            result["suggestion"] = "请稍后重试，或联系技术支持"
        
        return result
    
    def process_waitlist(self, record: Dict[str, Any], batch_no: str) -> Dict[str, Any]:
        result = {
            "status": "success",
            "record_type": "waitlist",
            "original_data": record,
            "phone": None,
            "name": None,
            "activity_name": None,
            "activity_session": None,
            "id_card": None,
            "error_message": None,
            "suggestion": None
        }
        
        phone = DataParser.clean_phone(record.get('phone', ''))
        name = record.get('name', '')
        activity_name = record.get('activity_name', '')
        activity_session = record.get('activity_session', '')
        id_card = record.get('id_card', '')
        priority = int(record.get('priority', 0))
        
        result["phone"] = phone
        result["name"] = name
        result["activity_name"] = activity_name
        result["activity_session"] = activity_session
        result["id_card"] = id_card
        
        if not phone or not name or not activity_name or not activity_session:
            result["status"] = "failed"
            result["error_message"] = "缺少必填字段: 手机号、姓名、活动名称、场次"
            result["suggestion"] = "请补充完整的候补信息后重新提交"
            return result
        
        is_blacklisted, blacklist_msg = self.check_blacklist(phone, id_card)
        if is_blacklisted:
            result["status"] = "failed"
            result["error_message"] = blacklist_msg
            result["suggestion"] = "黑名单用户无法加入候补列表"
            return result
        
        is_registered, _ = self.check_duplicate_registration(phone, activity_name, activity_session)
        if is_registered:
            result["status"] = "failed"
            result["error_message"] = "该用户已成功报名，无需候补"
            result["suggestion"] = "用户已在正式报名列表中，请检查数据"
            return result
        
        existing_waitlist = self.db.query(Waitlist).filter(
            Waitlist.phone == phone,
            Waitlist.activity_name == activity_name,
            Waitlist.activity_session == activity_session,
            Waitlist.status == "waiting"
        ).first()
        
        if existing_waitlist:
            result["status"] = "pending"
            result["error_message"] = "该用户已在此活动的候补列表中"
            result["suggestion"] = "如需调整优先级，请联系管理员"
            return result
        
        try:
            wait_time = DataParser.parse_datetime(record.get('wait_time', ''))
            
            new_waitlist = Waitlist(
                phone=phone,
                name=name,
                activity_name=activity_name,
                activity_session=activity_session,
                id_card=id_card,
                priority=priority,
                wait_time=wait_time,
                status="waiting",
                source_batch=batch_no
            )
            self.db.add(new_waitlist)
            self.db.flush()
            
        except Exception as e:
            self.db.rollback()
            result["status"] = "pending"
            result["error_message"] = f"系统处理异常: {str(e)}"
            result["suggestion"] = "请稍后重试，或联系技术支持"
        
        return result
    
    def process_checkin(self, record: Dict[str, Any], batch_no: str) -> Dict[str, Any]:
        result = {
            "status": "success",
            "record_type": "checkin",
            "original_data": record,
            "phone": None,
            "name": None,
            "activity_name": None,
            "activity_session": None,
            "id_card": None,
            "error_message": None,
            "suggestion": None
        }
        
        phone = DataParser.clean_phone(record.get('phone', ''))
        name = record.get('name', '')
        activity_name = record.get('activity_name', '')
        activity_session = record.get('activity_session', '')
        
        result["phone"] = phone
        result["name"] = name
        result["activity_name"] = activity_name
        result["activity_session"] = activity_session
        
        if not phone or not activity_name or not activity_session:
            result["status"] = "failed"
            result["error_message"] = "缺少必填字段: 手机号、活动名称、场次"
            result["suggestion"] = "请补充完整的签到信息后重新提交"
            return result
        
        registration = self.db.query(Registration).filter(
            Registration.phone == phone,
            Registration.activity_name == activity_name,
            Registration.activity_session == activity_session
        ).first()
        
        if not registration:
            result["status"] = "pending"
            result["error_message"] = "未找到该用户的报名记录"
            result["suggestion"] = "请先完成报名，或核实签到信息是否正确；如需补录请联系管理员"
            return result
        
        existing_checkin = self.db.query(Checkin).filter(
            Checkin.phone == phone,
            Checkin.activity_name == activity_name,
            Checkin.activity_session == activity_session
        ).first()
        
        if existing_checkin:
            result["status"] = "failed"
            result["error_message"] = "该用户已签到，不可重复签到"
            result["suggestion"] = "签到记录已存在，无需重复操作"
            return result
        
        try:
            checkin_time = DataParser.parse_datetime(record.get('checkin_time', ''))
            
            new_checkin = Checkin(
                phone=phone,
                name=name or registration.name,
                activity_name=activity_name,
                activity_session=activity_session,
                checkin_time=checkin_time,
                status="checked_in",
                source_batch=batch_no
            )
            self.db.add(new_checkin)
            self.db.flush()
            
        except Exception as e:
            self.db.rollback()
            result["status"] = "pending"
            result["error_message"] = f"系统处理异常: {str(e)}"
            result["suggestion"] = "请稍后重试，或联系技术支持"
        
        return result
