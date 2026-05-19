from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from geopy.distance import geodesic
from models import (
    Route, RouteStop, RouteSchedule,
    Bus, Driver, GPSRecord, DriverCheckIn, StudentAppeal,
    Incident, IncidentEvidence, AnomalyType, Responsibility
)

class AnomalyDetector:
    def __init__(self, db_session: Session):
        self.db = db_session
        self.LATE_THRESHOLD_MINUTES = 5
        self.STOP_DETECTION_RADIUS_METERS = 100
    
    def detect_anomalies(self, date: Optional[datetime] = None) -> List[Dict]:
        if date is None:
            date = datetime.now()
        
        incidents = []
        
        late_incidents = self._detect_late_arrivals(date)
        incidents.extend(late_incidents)
        
        missing_stop_incidents = self._detect_missing_stops(date)
        incidents.extend(missing_stop_incidents)
        
        speeding_incidents = self._detect_speeding(date)
        incidents.extend(speeding_incidents)
        
        appeal_mismatches = self._detect_appeal_mismatches(date)
        incidents.extend(appeal_mismatches)
        
        return incidents
    
    def _detect_late_arrivals(self, date: datetime) -> List[Dict]:
        incidents = []
        routes = self.db.query(Route).all()
        
        for route in routes:
            schedules = self.db.query(RouteSchedule).filter_by(
                route_id=route.id,
                day_of_week='weekday'
            ).order_by(RouteSchedule.stop_id).all()
            
            for schedule in schedules:
                stop = self.db.query(RouteStop).get(schedule.stop_id)
                if not stop or not stop.latitude or not stop.longitude:
                    continue
                
                scheduled_time = datetime.strptime(schedule.scheduled_arrival, '%H:%M').time()
                scheduled_datetime = datetime.combine(date.date(), scheduled_time)
                
                buses = self.db.query(Bus).filter_by(route_id=route.id).all()
                for bus in buses:
                    actual_arrival = self._find_actual_arrival_time(
                        bus.id, stop.latitude, stop.longitude,
                        scheduled_datetime - timedelta(minutes=30),
                        scheduled_datetime + timedelta(hours=1)
                    )
                    
                    if actual_arrival:
                        time_diff = int((actual_arrival - scheduled_datetime).total_seconds() / 60)
                        
                        if time_diff >= self.LATE_THRESHOLD_MINUTES:
                            incident = self._create_incident(
                                bus=bus,
                                route=route,
                                stop=stop,
                                incident_date=date,
                                anomaly_type=AnomalyType.LATE_ARRIVAL.value,
                                scheduled_time=schedule.scheduled_arrival,
                                actual_time=actual_arrival.strftime('%H:%M'),
                                time_difference=time_diff,
                                description=f"车辆{bus.bus_number}在{stop.stop_name}晚点{time_diff}分钟"
                            )
                            incidents.append(incident)
        
        return incidents
    
    def _find_actual_arrival_time(self, bus_id: int, stop_lat: float, stop_lng: float,
                                   start_time: datetime, end_time: datetime) -> Optional[datetime]:
        gps_records = self.db.query(GPSRecord).filter(
            and_(
                GPSRecord.bus_id == bus_id,
                GPSRecord.timestamp >= start_time,
                GPSRecord.timestamp <= end_time
            )
        ).order_by(GPSRecord.timestamp).all()
        
        for record in gps_records:
            distance = geodesic(
                (stop_lat, stop_lng),
                (record.latitude, record.longitude)
            ).meters
            
            if distance <= self.STOP_DETECTION_RADIUS_METERS:
                return record.timestamp
        
        return None
    
    def _detect_missing_stops(self, date: datetime) -> List[Dict]:
        incidents = []
        routes = self.db.query(Route).all()
        
        for route in routes:
            stops = self.db.query(RouteStop).filter_by(route_id=route.id).all()
            buses = self.db.query(Bus).filter_by(route_id=route.id).all()
            
            for bus in buses:
                for stop in stops:
                    if not stop.latitude or not stop.longitude:
                        continue
                    
                    schedule = self.db.query(RouteSchedule).filter_by(
                        route_id=route.id,
                        stop_id=stop.id
                    ).first()
                    
                    if not schedule:
                        continue
                    
                    scheduled_time = datetime.strptime(schedule.scheduled_arrival, '%H:%M').time()
                    scheduled_datetime = datetime.combine(date.date(), scheduled_time)
                    
                    actual_arrival = self._find_actual_arrival_time(
                        bus.id, stop.latitude, stop.longitude,
                        scheduled_datetime - timedelta(minutes=30),
                        scheduled_datetime + timedelta(hours=1)
                    )
                    
                    if not actual_arrival:
                        incident = self._create_incident(
                            bus=bus,
                            route=route,
                            stop=stop,
                            incident_date=date,
                            anomaly_type=AnomalyType.MISSING_STOP.value,
                            scheduled_time=schedule.scheduled_arrival,
                            actual_time="未到站",
                            time_difference=None,
                            description=f"车辆{bus.bus_number}在{stop.stop_name}未停靠"
                        )
                        incidents.append(incident)
        
        return incidents
    
    def _detect_speeding(self, date: datetime) -> List[Dict]:
        incidents = []
        speed_limit = 60
        
        gps_records = self.db.query(GPSRecord).filter(
            and_(
                func.date(GPSRecord.timestamp) == date.date(),
                GPSRecord.speed > speed_limit
            )
        ).all()
        
        for record in gps_records:
            bus = self.db.query(Bus).get(record.bus_id)
            incident = {
                'bus_number': bus.bus_number if bus else 'Unknown',
                'timestamp': record.timestamp,
                'speed': record.speed,
                'location': (record.latitude, record.longitude)
            }
        
        return incidents
    
    def _detect_appeal_mismatches(self, date: datetime) -> List[Dict]:
        incidents = []
        
        appeals = self.db.query(StudentAppeal).filter(
            func.date(StudentAppeal.incident_date) == date.date()
        ).all()
        
        for appeal in appeals:
            if appeal.bus_id and appeal.stop_id:
                stop = self.db.query(RouteStop).get(appeal.stop_id)
                bus = self.db.query(Bus).get(appeal.bus_id)
                
                if stop and stop.latitude and stop.longitude and appeal.expected_time:
                    try:
                        expected_time = datetime.strptime(appeal.expected_time, '%H:%M').time()
                        expected_datetime = datetime.combine(date.date(), expected_time)
                        
                        actual_arrival = self._find_actual_arrival_time(
                            appeal.bus_id, stop.latitude, stop.longitude,
                            expected_datetime - timedelta(minutes=30),
                            expected_datetime + timedelta(hours=1)
                        )
                        
                        if appeal.actual_time and actual_arrival:
                            actual_time_gps = actual_arrival.strftime('%H:%M')
                            if appeal.actual_time != actual_time_gps:
                                incident = self._create_incident(
                                    bus=bus,
                                    route=self.db.query(Route).get(appeal.route_id) if appeal.route_id else None,
                                    stop=stop,
                                    incident_date=appeal.incident_date,
                                    anomaly_type=AnomalyType.GPS_MISMATCH.value,
                                    scheduled_time=appeal.expected_time,
                                    actual_time=actual_time_gps,
                                    time_difference=None,
                                    description=f"申诉时间{appeal.actual_time}与GPS实际到达时间{actual_time_gps}不符"
                                )
                                incidents.append(incident)
                    except ValueError:
                        continue
        
        return incidents
    
    def _create_incident(self, bus: Bus, route: Optional[Route], stop: Optional[RouteStop],
                         incident_date: datetime, anomaly_type: str, scheduled_time: str,
                         actual_time: str, time_difference: Optional[int], description: str) -> Dict:
        incident_number = f"INC-{datetime.now().strftime('%Y%m%d')}-{int(datetime.now().timestamp())}"
        
        existing = self.db.query(Incident).filter(
            and_(
                Incident.bus_id == bus.id if bus.id else None,
                Incident.stop_id == stop.id if stop else None,
                func.date(Incident.incident_date) == incident_date.date(),
                Incident.anomaly_type == anomaly_type
            )
        ).first()
        
        if existing:
            return {
                'id': existing.id,
                'incident_number': existing.incident_number,
                'anomaly_type': existing.anomaly_type,
                'status': existing.status,
                'responsibility': existing.responsibility,
                'created': False
            }
        
        incident = Incident(
            incident_number=incident_number,
            bus_id=bus.id if bus else None,
            route_id=route.id if route else None,
            stop_id=stop.id if stop else None,
            incident_date=incident_date,
            anomaly_type=anomaly_type,
            scheduled_time=scheduled_time,
            actual_time=actual_time,
            time_difference_minutes=time_difference,
            description=description,
            responsibility=Responsibility.UNASSIGNED.value,
            status='pending'
        )
        
        self.db.add(incident)
        self.db.flush()
        
        evidence = IncidentEvidence(
            incident_id=incident.id,
            evidence_type='gps',
            source='GPS系统',
            description=f"自动检测到异常: {description}",
            reference_id=f"GPS-{int(datetime.now().timestamp())}"
        )
        self.db.add(evidence)
        self.db.commit()
        
        return {
            'id': incident.id,
            'incident_number': incident.incident_number,
            'anomaly_type': incident.anomaly_type,
            'description': description,
            'status': incident.status,
            'responsibility': incident.responsibility,
            'created': True
        }

class ResponsibilityJudge:
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def judge_responsibility(self, incident_id: int) -> Dict:
        incident = self.db.query(Incident).get(incident_id)
        if not incident:
            return {'success': False, 'error': '事件不存在'}
        
        responsibility = Responsibility.UNASSIGNED.value
        confidence = 0.0
        reasons = []
        
        if incident.anomaly_type == AnomalyType.LATE_ARRIVAL.value:
            result = self._judge_late_arrival(incident)
            responsibility = result['responsibility']
            confidence = result['confidence']
            reasons = result['reasons']
        
        incident.responsibility = responsibility
        incident.status = 'reviewed'
        incident.reviewed_at = datetime.now()
        incident.review_notes = '\n'.join(reasons)
        self.db.commit()
        
        return {
            'success': True,
            'incident_id': incident.id,
            'responsibility': responsibility,
            'confidence': confidence,
            'reasons': reasons
        }
    
    def _judge_late_arrival(self, incident: Incident) -> Dict:
        reasons = []
        responsibility = Responsibility.UNASSIGNED.value
        confidence = 0.0
        
        driver_checkin = self.db.query(DriverCheckIn).filter(
            and_(
                DriverCheckIn.bus_id == incident.bus_id,
                func.date(DriverCheckIn.check_in_time) == incident.incident_date.date()
            )
        ).first()
        
        if driver_checkin:
            checkin_time = driver_checkin.check_in_time.time()
            expected_start = datetime.strptime('06:00', '%H:%M').time()
            if checkin_time > expected_start:
                responsibility = Responsibility.DRIVER.value
                confidence = 0.8
                reasons.append(f"司机打卡时间{checkin_time}晚于规定时间06:00")
                return {'responsibility': responsibility, 'confidence': confidence, 'reasons': reasons}
        
        if incident.time_difference_minutes and incident.time_difference_minutes >= 15:
            responsibility = Responsibility.TRAFFIC.value
            confidence = 0.6
            reasons.append(f"晚点{incident.time_difference_minutes}分钟，可能由于交通拥堵")
        
        return {'responsibility': responsibility, 'confidence': confidence, 'reasons': reasons}

class IncidentReviewer:
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def get_incidents(self, filters: Optional[Dict] = None) -> List[Incident]:
        query = self.db.query(Incident)
        
        if filters:
            if filters.get('responsibility'):
                query = query.filter_by(responsibility=filters['responsibility'])
            
            if filters.get('status'):
                query = query.filter_by(status=filters['status'])
            
            if filters.get('anomaly_type'):
                query = query.filter_by(anomaly_type=filters['anomaly_type'])
            
            if filters.get('start_date'):
                query = query.filter(Incident.incident_date >= filters['start_date'])
            
            if filters.get('end_date'):
                query = query.filter(Incident.incident_date <= filters['end_date'])
            
            if filters.get('bus_id'):
                query = query.filter_by(bus_id=filters['bus_id'])
            
            if filters.get('route_id'):
                query = query.filter_by(route_id=filters['route_id'])
        
        return query.order_by(Incident.incident_date.desc()).all()
    
    def get_incident_detail(self, incident_id: int) -> Optional[Dict]:
        incident = self.db.query(Incident).get(incident_id)
        if not incident:
            return None
        
        bus = self.db.query(Bus).get(incident.bus_id)
        route = self.db.query(Route).get(incident.route_id)
        stop = self.db.query(RouteStop).get(incident.stop_id)
        evidence = self.db.query(IncidentEvidence).filter_by(incident_id=incident.id).all()
        driver = None
        if bus:
            driver = self.db.query(Driver).filter_by(bus_id=bus.id).first()
        
        return {
            'incident': incident,
            'bus': bus,
            'route': route,
            'stop': stop,
            'driver': driver,
            'evidence': evidence
        }
    
    def manual_review(self, incident_id: int, reviewer: str, 
                      responsibility: str, notes: str, status: str = 'reviewed') -> Dict:
        incident = self.db.query(Incident).get(incident_id)
        if not incident:
            return {'success': False, 'error': '事件不存在'}
        
        incident.responsibility = responsibility
        incident.status = status
        incident.reviewed_by = reviewer
        incident.reviewed_at = datetime.now()
        incident.review_notes = notes
        self.db.commit()
        
        return {'success': True, 'incident_id': incident.id}
    
    def add_evidence(self, incident_id: int, evidence_type: str, source: str,
                     description: str, reference_id: str = None) -> Dict:
        incident = self.db.query(Incident).get(incident_id)
        if not incident:
            return {'success': False, 'error': '事件不存在'}
        
        evidence = IncidentEvidence(
            incident_id=incident_id,
            evidence_type=evidence_type,
            source=source,
            description=description,
            reference_id=reference_id or f"EVID-{int(datetime.now().timestamp())}"
        )
        self.db.add(evidence)
        self.db.commit()
        
        return {'success': True, 'evidence_id': evidence.id}
