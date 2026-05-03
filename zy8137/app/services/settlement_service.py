import uuid
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.models import (
    Machinery, GPSTrajectory, PlotContract, PricingRule,
    WorkSession, SettlementRecord, AnomalyRecord
)
from app.utils.geo_utils import (
    calculate_trajectory_distance, calculate_area_from_trajectory,
    is_point_in_boundary, detect_overlap, split_night_day_points,
    handle_cross_midnight_trajectory, is_night_time
)


class SettlementService:
    def __init__(self, db: Session):
        self.db = db
    
    def _get_active_pricing_rule(self, machine_type: Optional[str] = None) -> PricingRule:
        query = self.db.query(PricingRule).filter(PricingRule.is_active == True)
        
        if machine_type:
            rule = query.filter(PricingRule.machine_type == machine_type).first()
            if rule:
                return rule
        
        return query.filter(PricingRule.machine_type == None).first() or PricingRule(
            base_price_per_mu=50.0,
            night_surcharge_rate=0.3,
            night_start_hour=22,
            night_end_hour=6,
            empty_driving_deduction_rate=0.5,
            empty_driving_speed_threshold=15.0,
            minimum_working_speed=2.0,
            maximum_working_speed=12.0,
            work_session_gap_minutes=30,
            overlap_detection_distance=5.0
        )
    
    def _classify_trajectory_points(self, points: List[GPSTrajectory], 
                                     pricing_rule: PricingRule) -> Tuple[List, List]:
        working_points = []
        empty_points = []
        
        for point in points:
            speed = point.speed or 0
            
            is_working = (
                pricing_rule.minimum_working_speed <= speed <= pricing_rule.maximum_working_speed
            )
            
            if is_working:
                working_points.append(point)
            else:
                empty_points.append(point)
        
        return working_points, empty_points
    
    def _match_plot_to_trajectory(self, points: List[GPSTrajectory]) -> Optional[PlotContract]:
        if not points:
            return None
        
        plots = self.db.query(PlotContract).all()
        
        if not plots:
            return None
        
        plot_match_counts = {}
        
        for point in points:
            for plot in plots:
                if plot.plot_id not in plot_match_counts:
                    plot_match_counts[plot.plot_id] = 0
                
                if plot.boundary_wkt and is_point_in_boundary(
                    point.latitude, point.longitude, plot.boundary_wkt
                ):
                    plot_match_counts[plot.plot_id] += 1
        
        if plot_match_counts:
            best_plot_id = max(plot_match_counts.keys(), key=lambda x: plot_match_counts[x])
            if plot_match_counts[best_plot_id] > 0:
                return self.db.query(PlotContract).filter(PlotContract.plot_id == best_plot_id).first()
        
        return plots[0] if plots else None
    
    def rebuild_work_sessions(self, machine_id: Optional[str] = None) -> Dict[str, Any]:
        query = self.db.query(GPSTrajectory)
        
        if machine_id:
            query = query.filter(GPSTrajectory.machine_id == machine_id)
        
        trajectories = query.order_by(
            GPSTrajectory.machine_id,
            GPSTrajectory.timestamp
        ).all()
        
        if not trajectories:
            return {
                "success": True,
                "message": "没有找到轨迹数据",
                "sessions_created": 0
            }
        
        machine_trajectories = {}
        for traj in trajectories:
            if traj.machine_id not in machine_trajectories:
                machine_trajectories[traj.machine_id] = []
            machine_trajectories[traj.machine_id].append(traj)
        
        total_sessions = 0
        errors = []
        
        for mach_id, trajs in machine_trajectories.items():
            try:
                sessions_count = self._rebuild_machine_sessions(mach_id, trajs)
                total_sessions += sessions_count
            except Exception as e:
                errors.append(f"机器 {mach_id} 处理错误: {str(e)}")
        
        return {
            "success": len(errors) == 0,
            "sessions_created": total_sessions,
            "errors": errors
        }
    
    def _rebuild_machine_sessions(self, machine_id: str, 
                                   trajectories: List[GPSTrajectory]) -> int:
        if not trajectories:
            return 0
        
        machine = self.db.query(Machinery).filter(
            Machinery.machine_id == machine_id
        ).first()
        
        pricing_rule = self._get_active_pricing_rule(
            machine.machine_type if machine else None
        )
        
        trajectories_sorted = sorted(trajectories, key=lambda x: x.timestamp)
        
        sessions = []
        current_session = [trajectories_sorted[0]]
        
        for i in range(1, len(trajectories_sorted)):
            prev_time = trajectories_sorted[i-1].timestamp
            curr_time = trajectories_sorted[i].timestamp
            
            time_diff = (curr_time - prev_time).total_seconds() / 60
            
            if time_diff > pricing_rule.work_session_gap_minutes:
                if current_session:
                    sessions.append(current_session)
                current_session = [trajectories_sorted[i]]
            else:
                current_session.append(trajectories_sorted[i])
        
        if current_session:
            sessions.append(current_session)
        
        created_count = 0
        
        for session_trajs in sessions:
            if len(session_trajs) < 2:
                continue
            
            points_with_dt = [(t.latitude, t.longitude, t.timestamp) for t in session_trajs]
            
            cross_midnight_sessions = handle_cross_midnight_trajectory(points_with_dt)
            
            for cross_session_points in cross_midnight_sessions:
                if len(cross_session_points) < 2:
                    continue
                
                session_start_time = cross_session_points[0][2]
                session_end_time = cross_session_points[-1][2]
                
                start_date = session_start_time.date()
                end_date = session_end_time.date()
                is_cross_midnight = start_date != end_date
                
                plot_contract = self._match_plot_to_trajectory(session_trajs)
                has_boundary_missing = plot_contract.boundary_missing if plot_contract else False
                
                working_points, empty_points = self._classify_trajectory_points(
                    session_trajs, pricing_rule
                )
                
                working_points_with_dt = [(t.latitude, t.longitude, t.timestamp) for t in working_points]
                empty_points_with_dt = [(t.latitude, t.longitude, t.timestamp) for t in empty_points]
                
                total_distance = calculate_trajectory_distance(points_with_dt)
                working_distance = calculate_trajectory_distance(working_points_with_dt)
                empty_distance = calculate_trajectory_distance(empty_points_with_dt)
                
                working_width = machine.working_width if machine else 2.0
                calculated_area = calculate_area_from_trajectory(
                    [(p[0], p[1]) for p in working_points_with_dt],
                    working_width
                )
                
                night_working_points, day_working_points = split_night_day_points(
                    working_points_with_dt,
                    pricing_rule.night_start_hour,
                    pricing_rule.night_end_hour
                )
                
                night_area = calculate_area_from_trajectory(
                    [(p[0], p[1]) for p in night_working_points],
                    working_width
                )
                
                duration_minutes = (session_end_time - session_start_time).total_seconds() / 60
                
                session_id = f"WS_{uuid.uuid4().hex[:8]}"
                
                work_session = WorkSession(
                    session_id=session_id,
                    machine_id=machine_id,
                    plot_id=plot_contract.plot_id if plot_contract else None,
                    start_time=session_start_time,
                    end_time=session_end_time,
                    duration_minutes=duration_minutes,
                    total_distance_km=total_distance,
                    working_distance_km=working_distance,
                    empty_distance_km=empty_distance,
                    calculated_area_mu=calculated_area,
                    night_working_area_mu=night_area,
                    is_cross_midnight=is_cross_midnight,
                    has_boundary_missing=has_boundary_missing,
                    created_at=datetime.now()
                )
                
                self.db.add(work_session)
                created_count += 1
        
        self.db.commit()
        return created_count
    
    def calculate_settlement(self, work_session_id: Optional[str] = None,
                             machine_id: Optional[str] = None) -> Dict[str, Any]:
        query = self.db.query(WorkSession)
        
        if work_session_id:
            query = query.filter(WorkSession.session_id == work_session_id)
        if machine_id:
            query = query.filter(WorkSession.machine_id == machine_id)
        
        work_sessions = query.all()
        
        if not work_sessions:
            return {
                "success": True,
                "message": "没有找到作业时段",
                "settlements_created": 0
            }
        
        created_count = 0
        errors = []
        
        for session in work_sessions:
            try:
                machine = self.db.query(Machinery).filter(
                    Machinery.machine_id == session.machine_id
                ).first()
                
                pricing_rule = self._get_active_pricing_rule(
                    machine.machine_type if machine else None
                )
                
                plot_contract = None
                if session.plot_id:
                    plot_contract = self.db.query(PlotContract).filter(
                        PlotContract.plot_id == session.plot_id
                    ).first()
                
                price_per_mu = plot_contract.price_per_mu if plot_contract and plot_contract.price_per_mu else pricing_rule.base_price_per_mu
                
                total_area = session.calculated_area_mu or 0
                night_area = session.night_working_area_mu or 0
                
                empty_deduction_rate = pricing_rule.empty_driving_deduction_rate
                empty_distance = session.empty_distance_km or 0
                total_distance = session.total_distance_km or 0
                
                empty_deduction_area = 0
                if total_distance > 0 and empty_deduction_rate > 0:
                    empty_ratio = empty_distance / total_distance
                    empty_deduction_area = total_area * empty_ratio * empty_deduction_rate
                
                billable_area = total_area - empty_deduction_area
                if billable_area < 0:
                    billable_area = 0
                
                night_surcharge = 0
                if pricing_rule.night_surcharge_rate > 0 and night_area > 0:
                    night_surcharge = night_area * price_per_mu * pricing_rule.night_surcharge_rate
                
                empty_deduction_amount = empty_deduction_area * price_per_mu
                
                base_amount = billable_area * price_per_mu
                total_amount = base_amount + night_surcharge - empty_deduction_amount
                
                existing_settlement = self.db.query(SettlementRecord).filter(
                    SettlementRecord.work_session_id == session.session_id
                ).first()
                
                if existing_settlement:
                    existing_settlement.total_area_mu = total_area
                    existing_settlement.night_area_mu = night_area
                    existing_settlement.empty_deduction_area_mu = empty_deduction_area
                    existing_settlement.billable_area_mu = billable_area
                    existing_settlement.price_per_mu = price_per_mu
                    existing_settlement.night_surcharge = night_surcharge
                    existing_settlement.empty_driving_deduction = empty_deduction_amount
                    existing_settlement.total_amount = total_amount
                else:
                    settlement_id = f"ST_{uuid.uuid4().hex[:8]}"
                    settlement = SettlementRecord(
                        settlement_id=settlement_id,
                        machine_id=session.machine_id,
                        work_session_id=session.session_id,
                        plot_id=session.plot_id,
                        settlement_date=datetime.now(),
                        total_area_mu=total_area,
                        night_area_mu=night_area,
                        empty_deduction_area_mu=empty_deduction_area,
                        billable_area_mu=billable_area,
                        price_per_mu=price_per_mu,
                        night_surcharge=night_surcharge,
                        empty_driving_deduction=empty_deduction_amount,
                        total_amount=total_amount,
                        status="pending",
                        created_at=datetime.now()
                    )
                    self.db.add(settlement)
                
                created_count += 1
                
            except Exception as e:
                errors.append(f"时段 {session.session_id} 结算错误: {str(e)}")
        
        self.db.commit()
        
        return {
            "success": len(errors) == 0,
            "settlements_created": created_count,
            "errors": errors
        }
    
    def detect_anomalies(self, work_session_id: Optional[str] = None,
                          machine_id: Optional[str] = None) -> Dict[str, Any]:
        query = self.db.query(WorkSession)
        
        if work_session_id:
            query = query.filter(WorkSession.session_id == work_session_id)
        if machine_id:
            query = query.filter(WorkSession.machine_id == machine_id)
        
        work_sessions = query.order_by(
            WorkSession.machine_id,
            WorkSession.start_time
        ).all()
        
        if not work_sessions:
            return {
                "success": True,
                "message": "没有找到作业时段",
                "anomalies_detected": 0
            }
        
        anomalies_count = 0
        errors = []
        
        machine_sessions = {}
        for session in work_sessions:
            if session.machine_id not in machine_sessions:
                machine_sessions[session.machine_id] = []
            machine_sessions[session.machine_id].append(session)
        
        for mach_id, sessions in machine_sessions.items():
            try:
                sessions_sorted = sorted(sessions, key=lambda x: x.start_time)
                
                for i, session in enumerate(sessions_sorted):
                    if session.has_boundary_missing:
                        anomaly = self._create_anomaly(
                            session,
                            "boundary_missing",
                            "high",
                            "地块边界缺失",
                            f"地块 {session.plot_id} 没有提供边界数据，面积计算可能不准确"
                        )
                        self.db.add(anomaly)
                        anomalies_count += 1
                    
                    if session.is_cross_midnight:
                        anomaly = self._create_anomaly(
                            session,
                            "cross_midnight",
                            "medium",
                            "跨午夜作业",
                            f"作业时段跨越午夜，开始于 {session.start_time}，结束于 {session.end_time}"
                        )
                        self.db.add(anomaly)
                        anomalies_count += 1
                    
                    total_distance = session.total_distance_km or 0
                    empty_distance = session.empty_distance_km or 0
                    if total_distance > 0:
                        empty_ratio = empty_distance / total_distance
                        if empty_ratio > 0.3:
                            anomaly = self._create_anomaly(
                                session,
                                "high_empty_driving",
                                "medium",
                                "空驶比例过高",
                                f"空驶距离 {empty_distance:.2f}km，占总距离的 {empty_ratio*100:.1f}%"
                            )
                            self.db.add(anomaly)
                            anomalies_count += 1
                    
                    if i < len(sessions_sorted) - 1:
                        next_session = sessions_sorted[i + 1]
                        
                        if session.plot_id == next_session.plot_id and session.plot_id:
                            current_end = session.end_time
                            next_start = next_session.start_time
                            time_gap = (next_start - current_end).total_seconds() / 60
                            
                            if time_gap < 60:
                                machine = self.db.query(Machinery).filter(
                                    Machinery.machine_id == mach_id
                                ).first()
                                pricing_rule = self._get_active_pricing_rule(
                                    machine.machine_type if machine else None
                                )
                                
                                current_trajs = self.db.query(GPSTrajectory).filter(
                                    GPSTrajectory.machine_id == mach_id,
                                    GPSTrajectory.timestamp >= session.start_time,
                                    GPSTrajectory.timestamp <= session.end_time
                                ).all()
                                
                                next_trajs = self.db.query(GPSTrajectory).filter(
                                    GPSTrajectory.machine_id == mach_id,
                                    GPSTrajectory.timestamp >= next_session.start_time,
                                    GPSTrajectory.timestamp <= next_session.end_time
                                ).all()
                                
                                overlap = detect_overlap(
                                    [(t.latitude, t.longitude) for t in current_trajs],
                                    [(t.latitude, t.longitude) for t in next_trajs],
                                    pricing_rule.overlap_detection_distance
                                )
                                
                                if overlap > 0.5:
                                    anomaly = self._create_anomaly(
                                        session,
                                        "duplicate_reporting_risk",
                                        "high",
                                        "重复报工风险",
                                        f"与时段 {next_session.session_id} 的轨迹重叠度 {overlap*100:.1f}%，时间间隔仅 {time_gap:.0f} 分钟"
                                    )
                                    self.db.add(anomaly)
                                    anomalies_count += 1
                
            except Exception as e:
                errors.append(f"机器 {mach_id} 异常检测错误: {str(e)}")
        
        self.db.commit()
        
        return {
            "success": len(errors) == 0,
            "anomalies_detected": anomalies_count,
            "errors": errors
        }
    
    def _create_anomaly(self, session: WorkSession, anomaly_type: str,
                        severity: str, description: str, details: str) -> AnomalyRecord:
        anomaly_id = f"AN_{uuid.uuid4().hex[:8]}"
        
        return AnomalyRecord(
            anomaly_id=anomaly_id,
            work_session_id=session.session_id,
            machine_id=session.machine_id,
            plot_id=session.plot_id,
            anomaly_type=anomaly_type,
            severity=severity,
            description=description,
            details=details,
            detected_at=datetime.now(),
            resolved=False
        )
    
    def get_settlement_summary(self, machine_id: Optional[str] = None,
                                start_date: Optional[datetime] = None,
                                end_date: Optional[datetime] = None) -> Dict[str, Any]:
        query = self.db.query(SettlementRecord).join(
            WorkSession, SettlementRecord.work_session_id == WorkSession.session_id
        )
        
        if machine_id:
            query = query.filter(SettlementRecord.machine_id == machine_id)
        
        if start_date:
            query = query.filter(WorkSession.start_time >= start_date)
        
        if end_date:
            query = query.filter(WorkSession.end_time <= end_date)
        
        settlements = query.all()
        
        if not settlements:
            return {
                "success": True,
                "total_count": 0,
                "summary": {}
            }
        
        total_area = sum(s.total_area_mu or 0 for s in settlements)
        total_night_area = sum(s.night_area_mu or 0 for s in settlements)
        total_billable_area = sum(s.billable_area_mu or 0 for s in settlements)
        total_amount = sum(s.total_amount or 0 for s in settlements)
        total_night_surcharge = sum(s.night_surcharge or 0 for s in settlements)
        total_empty_deduction = sum(s.empty_driving_deduction or 0 for s in settlements)
        
        machine_summary = {}
        for s in settlements:
            if s.machine_id not in machine_summary:
                machine_summary[s.machine_id] = {
                    "count": 0,
                    "total_area": 0,
                    "total_amount": 0
                }
            machine_summary[s.machine_id]["count"] += 1
            machine_summary[s.machine_id]["total_area"] += s.total_area_mu or 0
            machine_summary[s.machine_id]["total_amount"] += s.total_amount or 0
        
        return {
            "success": True,
            "total_count": len(settlements),
            "summary": {
                "total_area_mu": total_area,
                "night_area_mu": total_night_area,
                "billable_area_mu": total_billable_area,
                "total_amount": total_amount,
                "night_surcharge": total_night_surcharge,
                "empty_driving_deduction": total_empty_deduction
            },
            "machine_summary": machine_summary
        }
