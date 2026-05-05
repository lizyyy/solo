from datetime import datetime, date, timedelta
from typing import Dict, List, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum

from app.models import (
    Student, Certificate, MedicalRecord, Cylinder,
    CourseSchedule, CourseParticipation, WeatherForecast,
    Instructor
)
from config import Config

class RiskLevel(Enum):
    SAFE = "safe"
    WARNING = "warning"
    DANGER = "danger"

@dataclass
class RiskItem:
    category: str
    level: RiskLevel
    message: str
    details: Dict[str, Any] = None

class RiskEngine:
    def __init__(self):
        self.thresholds = Config.RISK_THRESHOLDS
    
    def check_certificate_validity(self, student: Student, check_date: date) -> List[RiskItem]:
        risks = []
        today = check_date or date.today()
        
        certificates = student.certificates.all()
        if not certificates:
            risks.append(RiskItem(
                category="certificate",
                level=RiskLevel.DANGER,
                message=f"学员 {student.name} 没有任何有效潜水证书",
                details={"student_id": student.id, "student_name": student.name}
            ))
            return risks
        
        latest_cert = max(certificates, key=lambda c: c.expiry_date)
        
        if latest_cert.expiry_date < today:
            risks.append(RiskItem(
                category="certificate",
                level=RiskLevel.DANGER,
                message=f"学员 {student.name} 的证书已过期",
                details={
                    "student_id": student.id,
                    "student_name": student.name,
                    "cert_type": latest_cert.cert_type,
                    "cert_number": latest_cert.cert_number,
                    "expiry_date": latest_cert.expiry_date.isoformat(),
                    "days_expired": (today - latest_cert.expiry_date).days
                }
            ))
        elif (latest_cert.expiry_date - today).days <= self.thresholds['certificate_expiry_warning_days']:
            risks.append(RiskItem(
                category="certificate",
                level=RiskLevel.WARNING,
                message=f"学员 {student.name} 的证书即将过期",
                details={
                    "student_id": student.id,
                    "student_name": student.name,
                    "cert_type": latest_cert.cert_type,
                    "cert_number": latest_cert.cert_number,
                    "expiry_date": latest_cert.expiry_date.isoformat(),
                    "days_remaining": (latest_cert.expiry_date - today).days
                }
            ))
        
        return risks
    
    def check_medical_validity(self, student: Student, check_date: date) -> List[RiskItem]:
        risks = []
        today = check_date or date.today()
        
        medicals = student.medical_records.all()
        if not medicals:
            risks.append(RiskItem(
                category="medical",
                level=RiskLevel.DANGER,
                message=f"学员 {student.name} 没有体检记录",
                details={"student_id": student.id, "student_name": student.name}
            ))
            return risks
        
        latest_medical = max(medicals, key=lambda m: m.expiry_date)
        
        if not latest_medical.fit_for_diving:
            risks.append(RiskItem(
                category="medical",
                level=RiskLevel.DANGER,
                message=f"学员 {student.name} 体检结论为不适合潜水",
                details={
                    "student_id": student.id,
                    "student_name": student.name,
                    "exam_date": latest_medical.exam_date.isoformat(),
                    "notes": latest_medical.notes
                }
            ))
        
        if latest_medical.expiry_date < today:
            risks.append(RiskItem(
                category="medical",
                level=RiskLevel.DANGER,
                message=f"学员 {student.name} 的体检报告已过期",
                details={
                    "student_id": student.id,
                    "student_name": student.name,
                    "exam_date": latest_medical.exam_date.isoformat(),
                    "expiry_date": latest_medical.expiry_date.isoformat(),
                    "days_expired": (today - latest_medical.expiry_date).days
                }
            ))
        
        return risks
    
    def check_cylinder_validity(self, cylinder: Cylinder, check_date: date) -> List[RiskItem]:
        risks = []
        today = check_date or date.today()
        
        if cylinder.next_inspection_date < today:
            risks.append(RiskItem(
                category="cylinder",
                level=RiskLevel.DANGER,
                message=f"气瓶 {cylinder.serial_number} 已超过复检有效期",
                details={
                    "cylinder_id": cylinder.id,
                    "serial_number": cylinder.serial_number,
                    "last_inspection": cylinder.last_inspection_date.isoformat(),
                    "next_inspection": cylinder.next_inspection_date.isoformat(),
                    "days_overdue": (today - cylinder.next_inspection_date).days
                }
            ))
        
        if cylinder.status != 'available':
            risks.append(RiskItem(
                category="cylinder",
                level=RiskLevel.WARNING,
                message=f"气瓶 {cylinder.serial_number} 状态为 {cylinder.status}",
                details={
                    "cylinder_id": cylinder.id,
                    "serial_number": cylinder.serial_number,
                    "status": cylinder.status
                }
            ))
        
        return risks
    
    def check_weather_conditions(self, forecast: WeatherForecast) -> List[RiskItem]:
        risks = []
        
        if forecast.wind_speed_kmh > self.thresholds['max_wind_speed_kmh']:
            risks.append(RiskItem(
                category="weather",
                level=RiskLevel.DANGER,
                message=f"风速 {forecast.wind_speed_kmh} km/h 超过安全阈值 {self.thresholds['max_wind_speed_kmh']} km/h",
                details={
                    "dive_site_id": forecast.dive_site_id,
                    "forecast_date": forecast.forecast_date.isoformat(),
                    "wind_speed": forecast.wind_speed_kmh,
                    "max_threshold": self.thresholds['max_wind_speed_kmh']
                }
            ))
        
        if forecast.wave_height_m > self.thresholds['max_wave_height_m']:
            risks.append(RiskItem(
                category="weather",
                level=RiskLevel.DANGER,
                message=f"浪高 {forecast.wave_height_m} m 超过安全阈值 {self.thresholds['max_wave_height_m']} m",
                details={
                    "dive_site_id": forecast.dive_site_id,
                    "forecast_date": forecast.forecast_date.isoformat(),
                    "wave_height": forecast.wave_height_m,
                    "max_threshold": self.thresholds['max_wave_height_m']
                }
            ))
        
        if forecast.visibility_m and forecast.visibility_m < 5:
            risks.append(RiskItem(
                category="weather",
                level=RiskLevel.WARNING,
                message=f"能见度 {forecast.visibility_m} m 较低，可能影响潜水安全",
                details={
                    "dive_site_id": forecast.dive_site_id,
                    "forecast_date": forecast.forecast_date.isoformat(),
                    "visibility": forecast.visibility_m
                }
            ))
        
        return risks
    
    def check_instructor_ratio(self, course: CourseSchedule) -> List[RiskItem]:
        risks = []
        
        participations = course.participations.filter_by(status='registered').all()
        student_count = len(participations)
        instructor = course.instructor
        
        max_ratio = instructor.max_students_per_dive if instructor else self.thresholds['max_instructor_ratio']
        
        if student_count > max_ratio:
            risks.append(RiskItem(
                category="instructor",
                level=RiskLevel.DANGER,
                message=f"教练 {instructor.name if instructor else '未分配'} 带教人数 {student_count} 超过最大比例 {max_ratio}",
                details={
                    "course_id": course.id,
                    "instructor_id": instructor.id if instructor else None,
                    "instructor_name": instructor.name if instructor else None,
                    "student_count": student_count,
                    "max_ratio": max_ratio
                }
            ))
        
        if instructor and instructor.license_expiry < course.course_date:
            risks.append(RiskItem(
                category="instructor",
                level=RiskLevel.DANGER,
                message=f"教练 {instructor.name} 的执教证书已过期",
                details={
                    "instructor_id": instructor.id,
                    "instructor_name": instructor.name,
                    "license_expiry": instructor.license_expiry.isoformat(),
                    "course_date": course.course_date.isoformat()
                }
            ))
        
        return risks
    
    def assess_course(self, course: CourseSchedule) -> Dict[str, Any]:
        all_risks = []
        all_warnings = []
        
        forecast = WeatherForecast.query.filter_by(
            dive_site_id=course.dive_site_id,
            forecast_date=course.course_date
        ).first()
        
        if forecast:
            weather_risks = self.check_weather_conditions(forecast)
            for risk in weather_risks:
                if risk.level == RiskLevel.DANGER:
                    all_risks.append(risk)
                else:
                    all_warnings.append(risk)
        else:
            all_warnings.append(RiskItem(
                category="weather",
                level=RiskLevel.WARNING,
                message=f"潜点 {course.dive_site.name if course.dive_site else '未知'} 当日无海况预报",
                details={"course_id": course.id, "course_date": course.course_date.isoformat()}
            ))
        
        instructor_risks = self.check_instructor_ratio(course)
        for risk in instructor_risks:
            if risk.level == RiskLevel.DANGER:
                all_risks.append(risk)
            else:
                all_warnings.append(risk)
        
        participations = course.participations.filter_by(status='registered').all()
        for participation in participations:
            student = participation.student
            
            cert_risks = self.check_certificate_validity(student, course.course_date)
            for risk in cert_risks:
                if risk.level == RiskLevel.DANGER:
                    all_risks.append(risk)
                else:
                    all_warnings.append(risk)
            
            medical_risks = self.check_medical_validity(student, course.course_date)
            for risk in medical_risks:
                if risk.level == RiskLevel.DANGER:
                    all_risks.append(risk)
                else:
                    all_warnings.append(risk)
            
            if participation.cylinder_id:
                from app.models import Cylinder
                cylinder = Cylinder.query.get(participation.cylinder_id)
                if cylinder:
                    cylinder_risks = self.check_cylinder_validity(cylinder, course.course_date)
                    for risk in cylinder_risks:
                        if risk.level == RiskLevel.DANGER:
                            all_risks.append(risk)
                        else:
                            all_warnings.append(risk)
        
        if len(all_risks) > 0:
            overall_status = "denied"
        elif len(all_warnings) > 0:
            overall_status = "pending_review"
        else:
            overall_status = "approved"
        
        return {
            "course_id": course.id,
            "course_name": course.course_name,
            "course_date": course.course_date.isoformat(),
            "overall_status": overall_status,
            "risks": [asdict(r) for r in all_risks],
            "warnings": [asdict(w) for w in all_warnings],
            "risk_count": len(all_risks),
            "warning_count": len(all_warnings)
        }
