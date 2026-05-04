from datetime import date, datetime, time
from typing import Dict, List, Optional, Set, Tuple

from sqlalchemy.orm import Session

from app import models, schemas
from app.models import RiskLevel


def check_capacity(
    db: Session, plan: models.RouteChangePlan
) -> List[models.RiskReport]:
    risks = []
    
    for assignment in plan.vehicle_assignments:
        vehicle = db.query(models.Vehicle).filter(
            models.Vehicle.id == assignment.vehicle_id
        ).first()
        
        if not vehicle:
            continue
            
        student_count = len(assignment.student_assignments)
        
        if student_count > vehicle.capacity:
            risk = models.RiskReport(
                plan_id=plan.id,
                check_type="capacity_check",
                risk_level=RiskLevel.CRITICAL,
                title="车辆座位超员风险",
                description=f"车辆 {vehicle.vehicle_no} ({vehicle.plate_number}) 座位数为 {vehicle.capacity}，但分配了 {student_count} 名学生，超员 {student_count - vehicle.capacity} 人。",
                affected_entities=f"车辆: {vehicle.vehicle_no}, 学生数: {student_count}",
                suggestion="请减少该车辆的学生分配数量，或更换更大容量的车辆。",
            )
            risks.append(risk)
        elif student_count == vehicle.capacity:
            risk = models.RiskReport(
                plan_id=plan.id,
                check_type="capacity_check",
                risk_level=RiskLevel.MEDIUM,
                title="车辆座位已满",
                description=f"车辆 {vehicle.vehicle_no} ({vehicle.plate_number}) 座位数为 {vehicle.capacity}，已分配 {student_count} 名学生，座位已满。",
                affected_entities=f"车辆: {vehicle.vehicle_no}",
                suggestion="建议预留备用座位以应对突发情况。",
            )
            risks.append(risk)
    
    return risks


def check_time_windows(
    db: Session, plan: models.RouteChangePlan
) -> List[models.RiskReport]:
    risks = []
    
    for assignment in plan.vehicle_assignments:
        stops = sorted(
            assignment.stop_assignments,
            key=lambda x: x.sequence
        )
        
        for i, stop in enumerate(stops):
            if stop.time_window_start and stop.time_window_end:
                if stop.time_window_start > stop.time_window_end:
                    risk = models.RiskReport(
                        plan_id=plan.id,
                        check_type="time_window_check",
                        risk_level=RiskLevel.HIGH,
                        title="时间窗设置错误",
                        description=f"车辆分配 #{assignment.sequence} 的站点 {stop.stop.name} 时间窗开始时间晚于结束时间。",
                        affected_entities=f"车辆分配: #{assignment.sequence}, 站点: {stop.stop.name}",
                        suggestion="请修正时间窗设置，确保开始时间早于结束时间。",
                    )
                    risks.append(risk)
            
            if i > 0:
                prev_stop = stops[i - 1]
                if prev_stop.estimated_arrival_time and stop.estimated_arrival_time:
                    if prev_stop.estimated_arrival_time >= stop.estimated_arrival_time:
                        risk = models.RiskReport(
                            plan_id=plan.id,
                            check_type="time_window_check",
                            risk_level=RiskLevel.HIGH,
                            title="站点时间顺序错误",
                            description=f"车辆分配 #{assignment.sequence} 的站点顺序时间异常：站点 {prev_stop.stop.name} 到达时间晚于或等于站点 {stop.stop.name}。",
                            affected_entities=f"车辆分配: #{assignment.sequence}, 前站点: {prev_stop.stop.name}, 当前站点: {stop.stop.name}",
                            suggestion="请检查站点顺序和预计到达时间设置。",
                        )
                        risks.append(risk)
    
    return risks


def check_driver_qualification(
    db: Session, plan: models.RouteChangePlan
) -> List[models.RiskReport]:
    risks = []
    today = date.today()
    
    for assignment in plan.vehicle_assignments:
        driver = db.query(models.Driver).filter(
            models.Driver.id == assignment.driver_id
        ).first()
        
        if not driver:
            continue
        
        if driver.license_expiry_date < today:
            risk = models.RiskReport(
                plan_id=plan.id,
                check_type="driver_qualification_check",
                risk_level=RiskLevel.CRITICAL,
                title="司机驾驶证已过期",
                description=f"司机 {driver.name} (工号 {driver.driver_no} 的驾驶证已过期（过期日期：{driver.license_expiry_date}）。",
                affected_entities=f"司机: {driver.name}, 工号: {driver.driver_no}",
                suggestion="请更换有有效驾驶证的司机。",
            )
            risks.append(risk)
        
        if driver.qualification_expiry_date and driver.qualification_expiry_date < today:
            risk = models.RiskReport(
                plan_id=plan.id,
                check_type="driver_qualification_check",
                risk_level=RiskLevel.HIGH,
                title="司机从业资格证已过期",
                description=f"司机 {driver.name} (工号 {driver.driver_no}) 的从业资格证已过期（过期日期：{driver.qualification_expiry_date}）。",
                affected_entities=f"司机: {driver.name}, 工号: {driver.driver_no}",
                suggestion="请更换有有效从业资格证的司机，或提醒司机及时换证。",
            )
            risks.append(risk)
        
        if driver.status != "active":
            risk = models.RiskReport(
                plan_id=plan.id,
                check_type="driver_qualification_check",
                risk_level=RiskLevel.HIGH,
                title="司机状态异常",
                description=f"司机 {driver.name} (工号 {driver.driver_no}) 当前状态为 {driver.status}，非活跃状态。",
                affected_entities=f"司机: {driver.name}, 工号: {driver.driver_no}",
                suggestion="请更换状态为活跃的司机。",
            )
            risks.append(risk)
        
        days_until_expiry = (driver.license_expiry_date - today).days
        if 0 < days_until_expiry <= 30:
            risk = models.RiskReport(
                plan_id=plan.id,
                check_type="driver_qualification_check",
                risk_level=RiskLevel.MEDIUM,
                title="司机驾驶证即将过期",
                description=f"司机 {driver.name} (工号 {driver.driver_no}) 的驾驶证将于 {days_until_expiry} 天后过期（过期日期：{driver.license_expiry_date}）。",
                affected_entities=f"司机: {driver.name}, 工号: {driver.driver_no}",
                suggestion="请提醒司机及时换证。",
            )
            risks.append(risk)
    
    return risks


def check_authorization(
    db: Session, plan: models.RouteChangePlan
) -> List[models.RiskReport]:
    risks = []
    effective_date = plan.effective_date
    
    for assignment in plan.vehicle_assignments:
        for student_assignment in assignment.student_assignments:
            student = db.query(models.Student).filter(
                models.Student.id == student_assignment.student_id
            ).first()
            
            if not student:
                continue
            
            authorizations = db.query(models.Authorization).filter(
                models.Authorization.student_id == student.id,
                models.Authorization.is_active == True
            ).all()
            
            if not authorizations:
                risk = models.RiskReport(
                    plan_id=plan.id,
                    check_type="authorization_check",
                    risk_level=RiskLevel.CRITICAL,
                    title="学生无有效接送授权",
                    description=f"学生 {student.name} (学号 {student.student_no}) 没有有效的接送授权记录。",
                    affected_entities=f"学生: {student.name}, 学号: {student.student_no}",
                    suggestion="请为该学生添加有效的接送授权。",
                )
                risks.append(risk)
                continue
            
            valid_authorizations = [
                auth for auth in authorizations
                if auth.authorization_expiry_date >= effective_date
            ]
            
            if not valid_authorizations:
                risk = models.RiskReport(
                    plan_id=plan.id,
                    check_type="authorization_check",
                    risk_level=RiskLevel.CRITICAL,
                    title="学生接送授权已过期",
                    description=f"学生 {student.name} (学号 {student.student_no}) 的接送授权已过期或在生效日期 {effective_date} 前过期。",
                    affected_entities=f"学生: {student.name}, 学号: {student.student_no}",
                    suggestion="请更新该学生的接送授权有效期。",
                )
                risks.append(risk)
                continue
            
            if student_assignment.authorized_guardian_name:
                matched_auth = [
                    auth for auth in valid_authorizations
                    if auth.guardian_name == student_assignment.authorized_guardian_name
                ]
                if not matched_auth:
                    risk = models.RiskReport(
                        plan_id=plan.id,
                        check_type="authorization_check",
                        risk_level=RiskLevel.HIGH,
                        title="指定接送人未授权",
                        description=f"学生 {student.name} (学号 {student.student_no}) 指定的接送人 '{student_assignment.authorized_guardian_name}' 不在授权名单中。",
                        affected_entities=f"学生: {student.name}, 指定接送人: {student_assignment.authorized_guardian_name}",
                        suggestion="请确认接送人是否已授权，或更新授权名单。",
                    )
                    risks.append(risk)
            
            for auth in valid_authorizations:
                days_until_expiry = (auth.authorization_expiry_date - effective_date).days
                if 0 < days_until_expiry <= 7:
                    risk = models.RiskReport(
                        plan_id=plan.id,
                        check_type="authorization_check",
                        risk_level=RiskLevel.MEDIUM,
                        title="接送授权即将过期",
                        description=f"学生 {student.name} (学号 {student.student_no}) 的接送人 {auth.guardian_name} 的授权将于 {days_until_expiry} 天后过期。",
                        affected_entities=f"学生: {student.name}, 接送人: {auth.guardian_name}",
                        suggestion="请提醒家长及时续期授权。",
                    )
                    risks.append(risk)
    
    return risks


def check_duplicate_pickup(
    db: Session, plan: models.RouteChangePlan
) -> List[models.RiskReport]:
    risks = []
    
    student_assignments = []
    for assignment in plan.vehicle_assignments:
        for student_assignment in assignment.student_assignments:
            student_assignments.append((
                student_assignment.student_id,
                assignment.sequence,
                assignment.trip_direction
            ))
    
    student_count: Dict[Tuple[int, str], List[int]] = {}
    for student_id, vehicle_seq, direction in student_assignments:
        key = (student_id, direction)
        if key not in student_count:
            student_count[key] = []
        student_count[key].append(vehicle_seq)
    
    for (student_id, direction), vehicle_seqs in student_count.items():
        if len(vehicle_seqs) > 1:
            student = db.query(models.Student).filter(
                models.Student.id == student_id
            ).first()
            
            student_name = student.name if student else f"ID: {student_id}"
            student_no = student.student_no if student else "未知"
            
            risk = models.RiskReport(
                plan_id=plan.id,
                check_type="duplicate_pickup_check",
                risk_level=RiskLevel.CRITICAL,
                title="同一学生被多辆车分配",
                description=f"学生 {student_name} (学号 {student_no}) 在 {direction} 车次中被分配到了 {len(vehicle_seqs)} 辆车（车辆序号: {', '.join(map(str, vehicle_seqs))}）。这可能导致重复接送或遗漏。",
                affected_entities=f"学生: {student_name}, 学号: {student_no}, 车辆序号: {', '.join(map(str, vehicle_seqs))}",
                suggestion="请检查并移除重复的学生分配，确保每个学生在同一方向只被分配到一辆车。",
            )
            risks.append(risk)
    
    return risks


def check_handover_record(
    db: Session, plan: models.RouteChangePlan
) -> List[models.RiskReport]:
    risks = []
    
    for assignment in plan.vehicle_assignments:
        for student_assignment in assignment.student_assignments:
            student = db.query(models.Student).filter(
                models.Student.id == student_assignment.student_id
            ).first()
            
            if not student:
                continue
            
            is_young_or_special = student.is_young_grade or student.needs_special_care
            needs_handover = is_young_or_special or student_assignment.needs_handover_record
            
            if needs_handover and not student_assignment.has_handover_record:
                risk = models.RiskReport(
                    plan_id=plan.id,
                    check_type="handover_record_check",
                    risk_level=RiskLevel.HIGH,
                    title="低年级/特殊学生缺少交接记录",
                    description=f"学生 {student.name} (学号 {student.student_no}) 是低年级学生或需要特殊照顾，但缺少交接记录确认。",
                    affected_entities=f"学生: {student.name}, 学号: {student.student_no}",
                    suggestion="请确认随车老师已准备好交接记录，或设置 has_handover_record 为 True。",
                )
                risks.append(risk)
            
            if is_young_or_special:
                if not student_assignment.needs_handover_record:
                    risk = models.RiskReport(
                        plan_id=plan.id,
                        check_type="handover_record_check",
                        risk_level=RiskLevel.MEDIUM,
                        title="低年级/特殊学生未标记需要交接",
                        description=f"学生 {student.name} (学号 {student.student_no}) 是低年级学生或需要特殊照顾，但未标记为需要交接记录。",
                        affected_entities=f"学生: {student.name}, 学号: {student.student_no}",
                        suggestion="建议将 needs_handover_record 设置为 True 以确保交接安全。",
                    )
                    risks.append(risk)
    
    return risks


def check_vehicle_status(
    db: Session, plan: models.RouteChangePlan
) -> List[models.RiskReport]:
    risks = []
    
    for assignment in plan.vehicle_assignments:
        vehicle = db.query(models.Vehicle).filter(
            models.Vehicle.id == assignment.vehicle_id
        ).first()
        
        if not vehicle:
            continue
        
        if vehicle.status != "active":
            risk = models.RiskReport(
                plan_id=plan.id,
                check_type="vehicle_status_check",
                risk_level=RiskLevel.HIGH,
                title="车辆状态异常",
                description=f"车辆 {vehicle.vehicle_no} ({vehicle.plate_number}) 当前状态为 {vehicle.status}，非活跃状态。",
                affected_entities=f"车辆: {vehicle.vehicle_no}, 车牌: {vehicle.plate_number}",
                suggestion="请更换状态为活跃的车辆。",
            )
            risks.append(risk)
        
        if vehicle.last_inspection_date:
            today = date.today()
            days_since_inspection = (today - vehicle.last_inspection_date).days
            if days_since_inspection > 180:
                risk = models.RiskReport(
                    plan_id=plan.id,
                    check_type="vehicle_status_check",
                    risk_level=RiskLevel.MEDIUM,
                    title="车辆年检即将过期",
                    description=f"车辆 {vehicle.vehicle_no} ({vehicle.plate_number}) 距离上次年检已超过 {days_since_inspection} 天。",
                    affected_entities=f"车辆: {vehicle.vehicle_no}, 车牌: {vehicle.plate_number}",
                    suggestion="请确认车辆年检状态。",
                )
                risks.append(risk)
    
    return risks


def check_attendant_teacher(
    db: Session, plan: models.RouteChangePlan
) -> List[models.RiskReport]:
    risks = []
    
    for assignment in plan.vehicle_assignments:
        has_young_students = False
        for student_assignment in assignment.student_assignments:
            student = db.query(models.Student).filter(
                models.Student.id == student_assignment.student_id
            ).first()
            if student and (student.is_young_grade or student.needs_special_care):
                has_young_students = True
                break
        
        if has_young_students and not assignment.attendant_teacher:
            risk = models.RiskReport(
                plan_id=plan.id,
                check_type="attendant_teacher_check",
                risk_level=RiskLevel.HIGH,
                title="有低年级/特殊学生的车辆未分配随车老师",
                description=f"车辆分配 #{assignment.sequence} 载有低年级学生或需要特殊照顾的学生，但未分配随车老师。",
                affected_entities=f"车辆分配: #{assignment.sequence}",
                suggestion="请为该车辆分配随车老师负责学生交接。",
            )
            risks.append(risk)
    
    return risks


def validate_plan(
    db: Session, plan: models.RouteChangePlan
) -> schemas.ValidationResult:
    all_risks: List[models.RiskReport] = []
    
    all_risks.extend(check_capacity(db, plan))
    all_risks.extend(check_time_windows(db, plan))
    all_risks.extend(check_driver_qualification(db, plan))
    all_risks.extend(check_authorization(db, plan))
    all_risks.extend(check_duplicate_pickup(db, plan))
    all_risks.extend(check_handover_record(db, plan))
    all_risks.extend(check_vehicle_status(db, plan))
    all_risks.extend(check_attendant_teacher(db, plan))
    
    critical_count = sum(1 for r in all_risks if r.risk_level == RiskLevel.CRITICAL)
    high_count = sum(1 for r in all_risks if r.risk_level == RiskLevel.HIGH)
    medium_count = sum(1 for r in all_risks if r.risk_level == RiskLevel.MEDIUM)
    low_count = sum(1 for r in all_risks if r.risk_level == RiskLevel.LOW)
    
    valid = critical_count == 0
    
    summary_parts = []
    if critical_count > 0:
        summary_parts.append(f"严重风险: {critical_count} 项")
    if high_count > 0:
        summary_parts.append(f"高风险: {high_count} 项")
    if medium_count > 0:
        summary_parts.append(f"中等风险: {medium_count} 项")
    if low_count > 0:
        summary_parts.append(f"低风险: {low_count} 项")
    
    if not summary_parts:
        summary = "校验通过，未发现风险"
    else:
        summary = "发现风险: " + "; ".join(summary_parts)
    
    risk_schemas = [
        schemas.RiskReport(
            id=r.id,
            plan_id=r.plan_id,
            check_type=r.check_type,
            risk_level=r.risk_level,
            title=r.title,
            description=r.description,
            affected_entities=r.affected_entities,
            suggestion=r.suggestion,
            created_at=r.created_at,
        )
        for r in all_risks
    ]
    
    return schemas.ValidationResult(
        valid=valid,
        risk_reports=risk_schemas,
        summary=summary,
    )
