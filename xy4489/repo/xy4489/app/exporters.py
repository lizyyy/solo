from datetime import datetime, date
from typing import Dict, Any, List
import json

from app.models import (
    CourseSchedule, RiskAssessment, CourseParticipation,
    ReviewRecord, Student, Instructor, DiveSite, WeatherForecast,
    Certificate, MedicalRecord, Cylinder
)

class MarkdownExporter:
    def export_course(self, course: CourseSchedule, assessment: RiskAssessment) -> str:
        participations = CourseParticipation.query.filter_by(course_id=course.id).all()
        reviews = ReviewRecord.query.filter_by(risk_assessment_id=assessment.id).all()
        
        status_emoji = {
            'approved': '✅',
            'denied': '❌',
            'pending_review': '⚠️'
        }
        
        status_text = {
            'approved': '准予下水',
            'denied': '禁止下水',
            'pending_review': '待复核'
        }
        
        lines = []
        lines.append(f"# 潜水训练放行单")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append(f"## 课程基本信息")
        lines.append("")
        lines.append(f"| 项目 | 内容 |")
        lines.append(f"|------|------|")
        lines.append(f"| 课程名称 | {course.course_name} |")
        lines.append(f"| 日期 | {course.course_date.strftime('%Y-%m-%d')} |")
        lines.append(f"| 时间 | {course.start_time.strftime('%H:%M')} - {course.end_time.strftime('%H:%M')} |")
        lines.append(f"| 教练 | {course.instructor.name if course.instructor else '未分配'} |")
        lines.append(f"| 潜点 | {course.dive_site.name if course.dive_site else '未指定'} |")
        lines.append(f"| 学员人数 | {len(participations)} 人 |")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        
        lines.append(f"## 风险评估结果")
        lines.append("")
        lines.append(f"**综合状态**: {status_emoji.get(assessment.overall_status, '')} **{status_text.get(assessment.overall_status, assessment.overall_status)}**")
        lines.append("")
        
        risks = json.loads(assessment.risks) if assessment.risks else []
        warnings = json.loads(assessment.warnings) if assessment.warnings else []
        
        if risks:
            lines.append(f"### 🔴 风险项 ({len(risks)} 项)")
            lines.append("")
            for risk in risks:
                lines.append(f"- **{risk['category']}**: {risk['message']}")
                if risk.get('details'):
                    for key, value in risk['details'].items():
                        lines.append(f"  - {key}: {value}")
            lines.append("")
        
        if warnings:
            lines.append(f"### 🟡 警告项 ({len(warnings)} 项)")
            lines.append("")
            for warning in warnings:
                lines.append(f"- **{warning['category']}**: {warning['message']}")
                if warning.get('details'):
                    for key, value in warning['details'].items():
                        lines.append(f"  - {key}: {value}")
            lines.append("")
        
        if not risks and not warnings:
            lines.append("✅ 无风险项和警告项")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        
        if reviews:
            lines.append("## 📝 复核记录")
            lines.append("")
            for review in reviews:
                lines.append(f"### 复核 #{review.id}")
                lines.append("")
                lines.append(f"| 项目 | 内容 |")
                lines.append(f"|------|------|")
                lines.append(f"| 复核人 | {review.reviewer_name} |")
                lines.append(f"| 复核时间 | {review.review_date.strftime('%Y-%m-%d %H:%M:%S')} |")
                lines.append(f"| 原状态 | {status_text.get(review.original_status, review.original_status)} |")
                lines.append(f"| 复核后状态 | {status_text.get(review.revised_status, review.revised_status)} |")
                lines.append("")
                lines.append(f"**改判理由**: {review.reason}")
                lines.append("")
                if review.notes:
                    lines.append(f"**备注**: {review.notes}")
                    lines.append("")
        
        lines.append("---")
        lines.append("")
        
        lines.append("## 👥 学员清单")
        lines.append("")
        if participations:
            lines.append(f"| 序号 | 姓名 | 证书状态 | 体检状态 | 分配气瓶 |")
            lines.append(f"|------|------|----------|----------|----------|")
            for idx, p in enumerate(participations, 1):
                student = Student.query.get(p.student_id)
                cert_status = self._get_latest_certificate_status(student, course.course_date)
                medical_status = self._get_latest_medical_status(student, course.course_date)
                cylinder = Cylinder.query.get(p.cylinder_id) if p.cylinder_id else None
                cylinder_info = f"{cylinder.serial_number}" if cylinder else "未分配"
                
                lines.append(f"| {idx} | {student.name} | {cert_status} | {medical_status} | {cylinder_info} |")
        else:
            lines.append("暂无学员报名")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        
        forecast = WeatherForecast.query.filter_by(
            dive_site_id=course.dive_site_id,
            forecast_date=course.course_date
        ).first()
        
        if forecast:
            lines.append("## 🌊 海况预报")
            lines.append("")
            lines.append(f"| 项目 | 数值 | 状态 |")
            lines.append(f"|------|------|------|")
            lines.append(f"| 风速 | {forecast.wind_speed_kmh} km/h | {'正常' if forecast.wind_speed_kmh <= 30 else '超限'} |")
            lines.append(f"| 浪高 | {forecast.wave_height_m} m | {'正常' if forecast.wave_height_m <= 1.5 else '超限'} |")
            if forecast.water_temp_c:
                lines.append(f"| 水温 | {forecast.water_temp_c} °C | - |")
            if forecast.visibility_m:
                lines.append(f"| 能见度 | {forecast.visibility_m} m | {'良好' if forecast.visibility_m >= 10 else '一般'} |")
            if forecast.current_strength:
                lines.append(f"| 海流 | {forecast.current_strength} | - |")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("**本放行单由系统自动生成，复核记录具有最终效力。**")
        lines.append("")
        
        return "\n".join(lines)
    
    def _get_latest_certificate_status(self, student: Student, check_date: date) -> str:
        certs = student.certificates.all()
        if not certs:
            return "❌ 无证书"
        latest = max(certs, key=lambda c: c.expiry_date)
        if latest.expiry_date < check_date:
            return f"❌ 已过期 ({latest.expiry_date})"
        elif (latest.expiry_date - check_date).days <= 30:
            return f"⚠️ 即将过期 ({latest.expiry_date})"
        return f"✅ 有效 ({latest.cert_type})"
    
    def _get_latest_medical_status(self, student: Student, check_date: date) -> str:
        medicals = student.medical_records.all()
        if not medicals:
            return "❌ 无体检"
        latest = max(medicals, key=lambda m: m.expiry_date)
        if not latest.fit_for_diving:
            return "❌ 不适宜潜水"
        if latest.expiry_date < check_date:
            return f"❌ 已过期 ({latest.expiry_date})"
        return f"✅ 有效"

class AuditExporter:
    def export_course(self, course: CourseSchedule) -> Dict[str, Any]:
        audit = {
            "audit_version": "1.0",
            "exported_at": datetime.utcnow().isoformat(),
            "course": self._extract_course_info(course),
            "instructor": self._extract_instructor_info(course.instructor) if course.instructor else None,
            "dive_site": self._extract_dive_site_info(course.dive_site) if course.dive_site else None,
            "weather_forecast": self._extract_forecast_info(course),
            "students": [],
            "risk_assessment": None,
            "review_records": [],
            "cylinders": []
        }
        
        participations = CourseParticipation.query.filter_by(course_id=course.id).all()
        for p in participations:
            student = Student.query.get(p.student_id)
            audit["students"].append(self._extract_student_info(student, p, course.course_date))
            
            if p.cylinder_id:
                cylinder = Cylinder.query.get(p.cylinder_id)
                if cylinder:
                    audit["cylinders"].append(self._extract_cylinder_info(cylinder, course.course_date))
        
        latest_assessment = RiskAssessment.query.filter_by(
            course_id=course.id
        ).order_by(RiskAssessment.assessment_date.desc()).first()
        
        if latest_assessment:
            audit["risk_assessment"] = self._extract_assessment_info(latest_assessment)
            
            reviews = ReviewRecord.query.filter_by(risk_assessment_id=latest_assessment.id).all()
            for review in reviews:
                audit["review_records"].append(self._extract_review_info(review))
        
        return audit
    
    def _extract_course_info(self, course: CourseSchedule) -> Dict[str, Any]:
        return {
            "id": course.id,
            "name": course.course_name,
            "date": course.course_date.isoformat(),
            "start_time": course.start_time.strftime("%H:%M"),
            "end_time": course.end_time.strftime("%H:%M"),
            "max_students": course.max_students,
            "status": course.status,
            "notes": course.notes,
            "created_at": course.created_at.isoformat() if course.created_at else None
        }
    
    def _extract_instructor_info(self, instructor: Instructor) -> Dict[str, Any]:
        return {
            "id": instructor.id,
            "name": instructor.name,
            "id_number": instructor.id_number,
            "license_number": instructor.license_number,
            "license_expiry": instructor.license_expiry.isoformat(),
            "max_students_per_dive": instructor.max_students_per_dive
        }
    
    def _extract_dive_site_info(self, dive_site: DiveSite) -> Dict[str, Any]:
        return {
            "id": dive_site.id,
            "name": dive_site.name,
            "location": dive_site.location,
            "max_depth_meters": dive_site.max_depth_meters,
            "difficulty_level": dive_site.difficulty_level,
            "description": dive_site.description
        }
    
    def _extract_forecast_info(self, course: CourseSchedule) -> Dict[str, Any]:
        forecast = WeatherForecast.query.filter_by(
            dive_site_id=course.dive_site_id,
            forecast_date=course.course_date
        ).first()
        
        if not forecast:
            return None
        
        return {
            "forecast_date": forecast.forecast_date.isoformat(),
            "wind_speed_kmh": forecast.wind_speed_kmh,
            "wind_direction": forecast.wind_direction,
            "wave_height_m": forecast.wave_height_m,
            "water_temp_c": forecast.water_temp_c,
            "visibility_m": forecast.visibility_m,
            "current_strength": forecast.current_strength,
            "forecast_source": forecast.forecast_source
        }
    
    def _extract_student_info(self, student: Student, participation: CourseParticipation, check_date: date) -> Dict[str, Any]:
        certs = student.certificates.all()
        medicals = student.medical_records.all()
        
        latest_cert = max(certs, key=lambda c: c.expiry_date) if certs else None
        latest_medical = max(medicals, key=lambda m: m.expiry_date) if medicals else None
        
        cert_status = "missing"
        if latest_cert:
            if latest_cert.expiry_date < check_date:
                cert_status = "expired"
            elif (latest_cert.expiry_date - check_date).days <= 30:
                cert_status = "expiring_soon"
            else:
                cert_status = "valid"
        
        medical_status = "missing"
        if latest_medical:
            if not latest_medical.fit_for_diving:
                medical_status = "unfit"
            elif latest_medical.expiry_date < check_date:
                medical_status = "expired"
            else:
                medical_status = "valid"
        
        return {
            "id": student.id,
            "name": student.name,
            "id_number": student.id_number,
            "phone": student.phone,
            "email": student.email,
            "participation_id": participation.id,
            "cylinder_id": participation.cylinder_id,
            "status": participation.status,
            "certificate_status": cert_status,
            "certificate": {
                "type": latest_cert.cert_type if latest_cert else None,
                "number": latest_cert.cert_number if latest_cert else None,
                "issue_date": latest_cert.issue_date.isoformat() if latest_cert else None,
                "expiry_date": latest_cert.expiry_date.isoformat() if latest_cert else None
            } if latest_cert else None,
            "medical_status": medical_status,
            "medical_record": {
                "exam_date": latest_medical.exam_date.isoformat() if latest_medical else None,
                "expiry_date": latest_medical.expiry_date.isoformat() if latest_medical else None,
                "fit_for_diving": latest_medical.fit_for_diving if latest_medical else None,
                "doctor_name": latest_medical.doctor_name if latest_medical else None
            } if latest_medical else None
        }
    
    def _extract_cylinder_info(self, cylinder: Cylinder, check_date: date) -> Dict[str, Any]:
        inspection_status = "valid"
        if cylinder.next_inspection_date < check_date:
            inspection_status = "overdue"
        
        return {
            "id": cylinder.id,
            "serial_number": cylinder.serial_number,
            "capacity_liters": cylinder.capacity_liters,
            "material": cylinder.material,
            "manufacture_date": cylinder.manufacture_date.isoformat() if cylinder.manufacture_date else None,
            "last_inspection_date": cylinder.last_inspection_date.isoformat(),
            "next_inspection_date": cylinder.next_inspection_date.isoformat(),
            "inspection_status": inspection_status,
            "status": cylinder.status
        }
    
    def _extract_assessment_info(self, assessment: RiskAssessment) -> Dict[str, Any]:
        return {
            "id": assessment.id,
            "assessment_date": assessment.assessment_date.isoformat(),
            "overall_status": assessment.overall_status,
            "risks": json.loads(assessment.risks) if assessment.risks else [],
            "warnings": json.loads(assessment.warnings) if assessment.warnings else []
        }
    
    def _extract_review_info(self, review: ReviewRecord) -> Dict[str, Any]:
        return {
            "id": review.id,
            "risk_assessment_id": review.risk_assessment_id,
            "reviewer_name": review.reviewer_name,
            "review_date": review.review_date.isoformat(),
            "original_status": review.original_status,
            "revised_status": review.revised_status,
            "reason": review.reason,
            "notes": review.notes
        }
