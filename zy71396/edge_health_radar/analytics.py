from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
import numpy as np
from collections import defaultdict

from .models import (
    EdgeNode, ProbeResult, CertificateInfo, Region, AnomalyRecord,
    HealthRadarPoint, HealthLevel, AnomalyType, TrendDataPoint
)

LATENCY_WARNING_THRESHOLD = 100
LATENCY_CRITICAL_THRESHOLD = 200
PACKET_LOSS_WARNING_THRESHOLD = 2.0
PACKET_LOSS_CRITICAL_THRESHOLD = 5.0
CERT_WARNING_DAYS = 30
CERT_CRITICAL_DAYS = 7

def normalize_latency(latency_ms: float) -> float:
    if latency_ms <= 0:
        return 0.0
    if latency_ms <= 50:
        return 1.0 - (latency_ms / 50) * 0.1
    elif latency_ms <= LATENCY_WARNING_THRESHOLD:
        return 0.9 - ((latency_ms - 50) / 50) * 0.3
    elif latency_ms <= LATENCY_CRITICAL_THRESHOLD:
        return 0.6 - ((latency_ms - 100) / 100) * 0.4
    else:
        return max(0.0, 0.2 - ((latency_ms - 200) / 300) * 0.2)

def normalize_packet_loss(packet_loss_pct: float) -> float:
    if packet_loss_pct <= 0:
        return 1.0
    if packet_loss_pct <= PACKET_LOSS_WARNING_THRESHOLD:
        return 1.0 - (packet_loss_pct / PACKET_LOSS_WARNING_THRESHOLD) * 0.3
    elif packet_loss_pct <= PACKET_LOSS_CRITICAL_THRESHOLD:
        return 0.7 - ((packet_loss_pct - PACKET_LOSS_WARNING_THRESHOLD) / 
                      (PACKET_LOSS_CRITICAL_THRESHOLD - PACKET_LOSS_WARNING_THRESHOLD)) * 0.5
    else:
        return max(0.0, 0.2 - ((packet_loss_pct - PACKET_LOSS_CRITICAL_THRESHOLD) / 10) * 0.2)

def normalize_certificate(cert: Optional[CertificateInfo], now: datetime) -> float:
    if cert is None:
        return 0.0
    if not cert.chain_valid:
        return 0.1
    
    days_until_expiry = (cert.expires_at - now).total_seconds() / 86400
    
    if days_until_expiry <= 0:
        return 0.0
    elif days_until_expiry <= CERT_CRITICAL_DAYS:
        return days_until_expiry / CERT_CRITICAL_DAYS * 0.3
    elif days_until_expiry <= CERT_WARNING_DAYS:
        return 0.3 + ((days_until_expiry - CERT_CRITICAL_DAYS) / 
                      (CERT_WARNING_DAYS - CERT_CRITICAL_DAYS)) * 0.4
    else:
        return min(1.0, 0.7 + min((days_until_expiry - CERT_WARNING_DAYS) / 180, 0.3))

def normalize_availability(probes: List[ProbeResult], window_hours: int = 24) -> float:
    if not probes:
        return 0.0
    
    now = datetime.utcnow()
    window_start = now - timedelta(hours=window_hours)
    
    recent_probes = [p for p in probes if p.timestamp >= window_start]
    if not recent_probes:
        return 0.0
    
    success_count = sum(1 for p in recent_probes if p.is_success)
    return success_count / len(recent_probes)

def calculate_overall_score(latency: float, packet_loss: float, cert: float, availability: float,
                           weights: Dict[str, float] = None) -> float:
    weights = weights or {
        'latency': 0.3,
        'packet_loss': 0.3,
        'certificate': 0.2,
        'availability': 0.2
    }
    
    return (latency * weights['latency'] + 
            packet_loss * weights['packet_loss'] + 
            cert * weights['certificate'] + 
            availability * weights['availability'])

def determine_health_level(overall_score: float) -> HealthLevel:
    if overall_score >= 0.8:
        return HealthLevel.HEALTHY
    elif overall_score >= 0.5:
        return HealthLevel.WARNING
    elif overall_score >= 0.2:
        return HealthLevel.CRITICAL
    else:
        return HealthLevel.UNKNOWN

def detect_anomalies(node: EdgeNode, probes: List[ProbeResult], 
                     cert: Optional[CertificateInfo], 
                     history_probes: List[ProbeResult],
                     now: datetime) -> List[AnomalyRecord]:
    anomalies = []
    
    recent_probes = [p for p in probes if p.timestamp >= now - timedelta(hours=1)]
    if recent_probes:
        avg_latency = np.mean([p.latency_ms for p in recent_probes])
        if avg_latency > LATENCY_CRITICAL_THRESHOLD:
            anomalies.append(AnomalyRecord(
                anomaly_id=f"anom_{node.node_id}_lat_{int(now.timestamp())}",
                node_id=node.node_id,
                anomaly_type=AnomalyType.LATENCY_SPIKE,
                severity=HealthLevel.CRITICAL,
                detected_at=now,
                description=f"延迟严重超标: 当前 {avg_latency:.1f}ms, 阈值 {LATENCY_CRITICAL_THRESHOLD}ms",
                raw_data={'current_latency': avg_latency, 'threshold': LATENCY_CRITICAL_THRESHOLD},
                evidence=[f"近1小时平均延迟: {avg_latency:.1f}ms", f"探针数据点: {len(recent_probes)}个"]
            ))
        elif avg_latency > LATENCY_WARNING_THRESHOLD:
            anomalies.append(AnomalyRecord(
                anomaly_id=f"anom_{node.node_id}_lat_{int(now.timestamp())}",
                node_id=node.node_id,
                anomaly_type=AnomalyType.LATENCY_SPIKE,
                severity=HealthLevel.WARNING,
                detected_at=now,
                description=f"延迟偏高: 当前 {avg_latency:.1f}ms, 阈值 {LATENCY_WARNING_THRESHOLD}ms",
                raw_data={'current_latency': avg_latency, 'threshold': LATENCY_WARNING_THRESHOLD},
                evidence=[f"近1小时平均延迟: {avg_latency:.1f}ms"]
            ))
    
    if recent_probes:
        avg_loss = np.mean([p.packet_loss_pct for p in recent_probes])
        if avg_loss > PACKET_LOSS_CRITICAL_THRESHOLD:
            anomalies.append(AnomalyRecord(
                anomaly_id=f"anom_{node.node_id}_loss_{int(now.timestamp())}",
                node_id=node.node_id,
                anomaly_type=AnomalyType.PACKET_LOSS_HIGH,
                severity=HealthLevel.CRITICAL,
                detected_at=now,
                description=f"丢包率严重超标: 当前 {avg_loss:.2f}%, 阈值 {PACKET_LOSS_CRITICAL_THRESHOLD}%",
                raw_data={'current_loss': avg_loss, 'threshold': PACKET_LOSS_CRITICAL_THRESHOLD},
                evidence=[f"近1小时平均丢包率: {avg_loss:.2f}%"]
            ))
        elif avg_loss > PACKET_LOSS_WARNING_THRESHOLD:
            anomalies.append(AnomalyRecord(
                anomaly_id=f"anom_{node.node_id}_loss_{int(now.timestamp())}",
                node_id=node.node_id,
                anomaly_type=AnomalyType.PACKET_LOSS_HIGH,
                severity=HealthLevel.WARNING,
                detected_at=now,
                description=f"丢包率偏高: 当前 {avg_loss:.2f}%, 阈值 {PACKET_LOSS_WARNING_THRESHOLD}%",
                raw_data={'current_loss': avg_loss, 'threshold': PACKET_LOSS_WARNING_THRESHOLD},
                evidence=[f"近1小时平均丢包率: {avg_loss:.2f}%"]
            ))
    
    if cert:
        days_until_expiry = (cert.expires_at - now).total_seconds() / 86400
        if days_until_expiry <= 0:
            anomalies.append(AnomalyRecord(
                anomaly_id=f"anom_{node.node_id}_cert_{int(now.timestamp())}",
                node_id=node.node_id,
                anomaly_type=AnomalyType.CERT_EXPIRED,
                severity=HealthLevel.CRITICAL,
                detected_at=now,
                description=f"证书已过期! 过期时间: {cert.expires_at.strftime('%Y-%m-%d')}",
                raw_data={'expires_at': cert.expires_at.isoformat(), 'days_until_expiry': days_until_expiry},
                evidence=[f"证书序列号: {cert.serial_number}", f"颁发者: {cert.issuer}"]
            ))
        elif days_until_expiry <= CERT_CRITICAL_DAYS:
            anomalies.append(AnomalyRecord(
                anomaly_id=f"anom_{node.node_id}_cert_{int(now.timestamp())}",
                node_id=node.node_id,
                anomaly_type=AnomalyType.CERT_EXPIRING_SOON,
                severity=HealthLevel.CRITICAL,
                detected_at=now,
                description=f"证书即将过期: 仅剩 {days_until_expiry:.1f} 天",
                raw_data={'expires_at': cert.expires_at.isoformat(), 'days_until_expiry': days_until_expiry},
                evidence=[f"过期时间: {cert.expires_at.strftime('%Y-%m-%d')}", f"域名: {cert.domain}"]
            ))
        elif days_until_expiry <= CERT_WARNING_DAYS:
            anomalies.append(AnomalyRecord(
                anomaly_id=f"anom_{node.node_id}_cert_{int(now.timestamp())}",
                node_id=node.node_id,
                anomaly_type=AnomalyType.CERT_EXPIRING_SOON,
                severity=HealthLevel.WARNING,
                detected_at=now,
                description=f"证书将在 {days_until_expiry:.1f} 天后过期",
                raw_data={'expires_at': cert.expires_at.isoformat(), 'days_until_expiry': days_until_expiry},
                evidence=[f"过期时间: {cert.expires_at.strftime('%Y-%m-%d')}"]
            ))
    
    last_probe_time = max([p.timestamp for p in probes]) if probes else None
    if last_probe_time and (now - last_probe_time) > timedelta(minutes=15):
        anomalies.append(AnomalyRecord(
            anomaly_id=f"anom_{node.node_id}_gap_{int(now.timestamp())}",
            node_id=node.node_id,
            anomaly_type=AnomalyType.DATA_GAP,
            severity=HealthLevel.WARNING,
            detected_at=now,
            description=f"探测数据中断: 最近数据时间 {last_probe_time.strftime('%H:%M:%S')}",
            raw_data={'last_probe': last_probe_time.isoformat()},
            evidence=[f"数据中断时长: {(now - last_probe_time).total_seconds() / 60:.1f}分钟"]
        ))
    
    return anomalies

def aggregate_region_health(radar_points: List[HealthRadarPoint], 
                            regions: List[Region]) -> Dict[str, Dict]:
    region_health = defaultdict(lambda: {
        'nodes': [],
        'healthy': 0,
        'warning': 0,
        'critical': 0,
        'unknown': 0,
        'avg_overall_score': 0.0,
        'avg_latency_score': 0.0,
        'avg_packet_loss_score': 0.0,
        'avg_certificate_score': 0.0,
        'avg_availability_score': 0.0,
        'anomaly_count': 0
    })
    
    for point in radar_points:
        rh = region_health[point.region_id]
        rh['nodes'].append(point.node_id)
        rh[point.health_level.value] += 1
        rh['avg_overall_score'] += point.overall_score
        rh['avg_latency_score'] += point.latency_score
        rh['avg_packet_loss_score'] += point.packet_loss_score
        rh['avg_certificate_score'] += point.certificate_score
        rh['avg_availability_score'] += point.availability_score
        rh['anomaly_count'] += len(point.anomalies)
    
    result = {}
    for region_id, rh in region_health.items():
        node_count = len(rh['nodes'])
        if node_count > 0:
            rh['avg_overall_score'] /= node_count
            rh['avg_latency_score'] /= node_count
            rh['avg_packet_loss_score'] /= node_count
            rh['avg_certificate_score'] /= node_count
            rh['avg_availability_score'] /= node_count
        
        region = next((r for r in regions if r.region_id == region_id), None)
        rh['region_name'] = region.name if region else region_id
        rh['node_count'] = node_count
        result[region_id] = rh
    
    return result

def generate_trend_data(probes_by_node: Dict[str, List[ProbeResult]],
                        certs_by_node: Dict[str, CertificateInfo],
                        nodes: List[EdgeNode],
                        hours: int = 24,
                        region_id: Optional[str] = None) -> List[TrendDataPoint]:
    now = datetime.utcnow()
    points = []
    
    filtered_nodes = nodes
    if region_id:
        filtered_nodes = [n for n in nodes if n.region_id == region_id]
    
    for hour in range(hours, -1, -1):
        window_end = now - timedelta(hours=hour)
        window_start = window_end - timedelta(hours=1)
        
        window_probes = []
        for node in filtered_nodes:
            node_probes = probes_by_node.get(node.node_id, [])
            window_probes.extend([
                p for p in node_probes 
                if window_start <= p.timestamp < window_end
            ])
        
        if window_probes:
            avg_latency = np.mean([p.latency_ms for p in window_probes])
            avg_loss = np.mean([p.packet_loss_pct for p in window_probes])
        else:
            avg_latency = 0.0
            avg_loss = 0.0
        
        healthy = warning = critical = 0
        expiring_soon = 0
        
        for node in filtered_nodes:
            node_probes = [p for p in probes_by_node.get(node.node_id, []) 
                          if p.timestamp >= window_start and p.timestamp < window_end]
            cert = certs_by_node.get(node.node_id)
            
            if node_probes:
                lat_score = normalize_latency(np.mean([p.latency_ms for p in node_probes]))
                loss_score = normalize_packet_loss(np.mean([p.packet_loss_pct for p in node_probes]))
            else:
                lat_score = 0.5
                loss_score = 0.5
            
            cert_score = normalize_certificate(cert, window_end)
            avail_score = normalize_availability(node_probes, window_hours=1) if node_probes else 0.5
            
            overall = calculate_overall_score(lat_score, loss_score, cert_score, avail_score)
            level = determine_health_level(overall)
            
            if level == HealthLevel.HEALTHY:
                healthy += 1
            elif level == HealthLevel.WARNING:
                warning += 1
            elif level == HealthLevel.CRITICAL:
                critical += 1
            
            if cert:
                days_until = (cert.expires_at - window_end).total_seconds() / 86400
                if 0 < days_until <= CERT_WARNING_DAYS:
                    expiring_soon += 1
        
        points.append(TrendDataPoint(
            timestamp=window_end,
            region_id=region_id,
            avg_latency_ms=avg_latency,
            avg_packet_loss_pct=avg_loss,
            nodes_healthy_count=healthy,
            nodes_warning_count=warning,
            nodes_critical_count=critical,
            certs_expiring_soon_count=expiring_soon
        ))
    
    return list(reversed(points))

def compute_health_radar(node: EdgeNode, probes: List[ProbeResult], 
                         cert: Optional[CertificateInfo],
                         region: Region,
                         history_probes: List[ProbeResult],
                         now: datetime) -> HealthRadarPoint:
    recent_probes = [p for p in probes if p.timestamp >= now - timedelta(hours=1)]
    
    if recent_probes:
        avg_latency = np.mean([p.latency_ms for p in recent_probes])
        avg_loss = np.mean([p.packet_loss_pct for p in recent_probes])
    else:
        avg_latency = 0.0
        avg_loss = 0.0
    
    latency_score = normalize_latency(avg_latency)
    packet_loss_score = normalize_packet_loss(avg_loss)
    certificate_score = normalize_certificate(cert, now)
    availability_score = normalize_availability(probes)
    
    overall_score = calculate_overall_score(
        latency_score, packet_loss_score, certificate_score, availability_score
    )
    
    health_level = determine_health_level(overall_score)
    
    anomalies = detect_anomalies(node, probes, cert, history_probes, now)
    
    return HealthRadarPoint(
        node_id=node.node_id,
        node_name=node.name,
        region_id=region.region_id,
        region_name=region.name,
        latency_score=latency_score,
        packet_loss_score=packet_loss_score,
        certificate_score=certificate_score,
        availability_score=availability_score,
        overall_score=overall_score,
        health_level=health_level,
        anomalies=anomalies,
        last_updated=now
    )
