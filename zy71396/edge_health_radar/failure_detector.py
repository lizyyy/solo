from typing import List, Dict, Tuple, Optional
from datetime import datetime, timedelta
from collections import defaultdict
import numpy as np

from .models import (
    EdgeNode, ProbeResult, CertificateInfo, Region, AnomalyRecord,
    HealthLevel, AnomalyType
)
from .analytics import (
    normalize_latency, normalize_packet_loss, normalize_certificate,
    LATENCY_WARNING_THRESHOLD, PACKET_LOSS_WARNING_THRESHOLD,
    CERT_WARNING_DAYS, CERT_CRITICAL_DAYS
)

class CertificateMissedDetection:
    def __init__(self, node_id: str, cert: CertificateInfo, 
                 expected_warning: bool, expected_critical: bool,
                 actual_anomalies: List[AnomalyRecord],
                 check_reason: str):
        self.node_id = node_id
        self.cert = cert
        self.expected_warning = expected_warning
        self.expected_critical = expected_critical
        self.actual_anomalies = actual_anomalies
        self.check_reason = check_reason
        self.detected_at = datetime.utcnow()

class RegionAggregationError:
    def __init__(self, region_id: str, error_type: str,
                 expected_value: float, actual_value: float,
                 node_ids: List[str], details: str):
        self.region_id = region_id
        self.error_type = error_type
        self.expected_value = expected_value
        self.actual_value = actual_value
        self.node_ids = node_ids
        self.details = details
        self.detected_at = datetime.utcnow()

class ProbeAnomalyVerification:
    def __init__(self, node_id: str, probe_source: str,
                 anomaly_type: str, confidence: float,
                 supporting_evidence: List[str],
                 conflicting_evidence: List[str]):
        self.node_id = node_id
        self.probe_source = probe_source
        self.anomaly_type = anomaly_type
        self.confidence = confidence
        self.supporting_evidence = supporting_evidence
        self.conflicting_evidence = conflicting_evidence
        self.verified_at = datetime.utcnow()

def detect_certificate_missed_reports(
    nodes: List[EdgeNode],
    certs: Dict[str, CertificateInfo],
    anomalies: Dict[str, List[AnomalyRecord]],
    now: datetime
) -> List[CertificateMissedDetection]:
    missed = []
    
    for node in nodes:
        cert = certs.get(node.node_id)
        if not cert:
            continue
        
        days_until = (cert.expires_at - now).total_seconds() / 86400
        node_anomalies = anomalies.get(node.node_id, [])
        
        cert_anomalies = [a for a in node_anomalies 
                         if a.anomaly_type in [AnomalyType.CERT_EXPIRED, 
                                              AnomalyType.CERT_EXPIRING_SOON]]
        
        expected_critical = days_until <= CERT_CRITICAL_DAYS
        expected_warning = days_until <= CERT_WARNING_DAYS
        
        has_critical = any(a.severity == HealthLevel.CRITICAL for a in cert_anomalies)
        has_warning = any(a.severity == HealthLevel.WARNING for a in cert_anomalies)
        
        check_reason = ""
        is_missed = False
        
        if days_until <= 0 and not has_critical:
            check_reason = f"证书已过期 {abs(days_until):.1f} 天，但未产生CRITICAL级别告警"
            is_missed = True
        elif expected_critical and not has_critical:
            check_reason = f"证书将在 {days_until:.1f} 天后过期（临界阈值内），但未产生CRITICAL级别告警"
            is_missed = True
        elif expected_warning and not has_warning and not has_critical:
            check_reason = f"证书将在 {days_until:.1f} 天后过期（警告阈值内），但未产生任何告警"
            is_missed = True
        
        if cert.last_checked and (now - cert.last_checked) > timedelta(hours=24):
            check_reason = f"证书检查已超过24小时未更新，上次检查: {cert.last_checked.strftime('%Y-%m-%d %H:%M')}"
            is_missed = True
        
        if is_missed:
            missed.append(CertificateMissedDetection(
                node_id=node.node_id,
                cert=cert,
                expected_warning=expected_warning,
                expected_critical=expected_critical,
                actual_anomalies=cert_anomalies,
                check_reason=check_reason
            ))
    
    return missed

def verify_region_aggregation(
    region_id: str,
    region_nodes: List[EdgeNode],
    node_scores: Dict[str, Dict[str, float]],
    aggregated_scores: Dict[str, float],
    tolerance: float = 0.05
) -> List[RegionAggregationError]:
    errors = []
    
    if not region_nodes:
        return errors
    
    score_types = ['latency_score', 'packet_loss_score', 'certificate_score', 
                   'availability_score', 'overall_score']
    
    for score_type in score_types:
        valid_nodes = [n for n in region_nodes if n.node_id in node_scores 
                       and score_type in node_scores[n.node_id]]
        
        if not valid_nodes:
            continue
        
        expected_avg = np.mean([node_scores[n.node_id][score_type] for n in valid_nodes])
        actual_avg = aggregated_scores.get(f'avg_{score_type}', 0)
        
        diff = abs(expected_avg - actual_avg)
        
        if diff > tolerance:
            errors.append(RegionAggregationError(
                region_id=region_id,
                error_type=f'{score_type}_mismatch',
                expected_value=expected_avg,
                actual_value=actual_avg,
                node_ids=[n.node_id for n in valid_nodes],
                details=f"预期平均{score_type}: {expected_avg:.4f}, 实际聚合值: {actual_avg:.4f}, "
                        f"差值: {diff:.4f}, 容差: {tolerance}"
            ))
    
    return errors

def verify_all_region_aggregations(
    regions: List[Region],
    nodes_by_region: Dict[str, List[EdgeNode]],
    node_scores: Dict[str, Dict[str, float]],
    region_aggregations: Dict[str, Dict]
) -> List[RegionAggregationError]:
    all_errors = []
    
    for region in regions:
        region_nodes = nodes_by_region.get(region.region_id, [])
        aggregated = region_aggregations.get(region.region_id, {})
        
        errors = verify_region_aggregation(
            region.region_id, region_nodes, node_scores, aggregated
        )
        all_errors.extend(errors)
    
    return all_errors

def verify_probe_anomaly(
    node_id: str,
    probes: List[ProbeResult],
    anomaly_type: str,
    threshold_sources: List[str] = None
) -> ProbeAnomalyVerification:
    threshold_sources = threshold_sources or ['beijing', 'shanghai', 'guangzhou', 'shenzhen']
    
    supporting = []
    conflicting = []
    
    source_probes = defaultdict(list)
    for p in probes:
        source_probes[p.probe_source].append(p)
    
    for source in threshold_sources:
        source_data = source_probes.get(source, [])
        if not source_data:
            continue
        
        recent = [p for p in source_data if p.timestamp >= datetime.utcnow() - timedelta(hours=1)]
        if not recent:
            continue
        
        if anomaly_type == 'latency_spike':
            avg_lat = np.mean([p.latency_ms for p in recent])
            if avg_lat > LATENCY_WARNING_THRESHOLD:
                supporting.append(f"[{source}] 平均延迟 {avg_lat:.1f}ms 超过阈值")
            else:
                conflicting.append(f"[{source}] 平均延迟 {avg_lat:.1f}ms 正常")
        
        elif anomaly_type == 'packet_loss_high':
            avg_loss = np.mean([p.packet_loss_pct for p in recent])
            if avg_loss > PACKET_LOSS_WARNING_THRESHOLD:
                supporting.append(f"[{source}] 平均丢包 {avg_loss:.2f}% 超过阈值")
            else:
                conflicting.append(f"[{source}] 平均丢包 {avg_loss:.2f}% 正常")
    
    total_sources = len(supporting) + len(conflicting)
    confidence = len(supporting) / total_sources if total_sources > 0 else 0.0
    
    return ProbeAnomalyVerification(
        node_id=node_id,
        probe_source='multi_source',
        anomaly_type=anomaly_type,
        confidence=confidence,
        supporting_evidence=supporting,
        conflicting_evidence=conflicting
    )

def cross_verify_all_probe_anomalies(
    anomalies: List[AnomalyRecord],
    probes_by_node: Dict[str, List[ProbeResult]]
) -> List[ProbeAnomalyVerification]:
    verifications = []
    
    probe_anomalies = [a for a in anomalies 
                      if a.anomaly_type in [AnomalyType.LATENCY_SPIKE, 
                                           AnomalyType.PACKET_LOSS_HIGH]]
    
    for anomaly in probe_anomalies:
        probes = probes_by_node.get(anomaly.node_id, [])
        a_type = 'latency_spike' if anomaly.anomaly_type == AnomalyType.LATENCY_SPIKE else 'packet_loss_high'
        
        verification = verify_probe_anomaly(anomaly.node_id, probes, a_type)
        verifications.append(verification)
    
    return verifications

def detect_data_inconsistencies(
    probes: List[ProbeResult],
    max_time_gap_minutes: int = 30
) -> List[Dict]:
    inconsistencies = []
    
    probes_by_node = defaultdict(list)
    for p in probes:
        probes_by_node[p.node_id].append(p)
    
    for node_id, node_probes in probes_by_node.items():
        sorted_probes = sorted(node_probes, key=lambda x: x.timestamp)
        
        for i in range(1, len(sorted_probes)):
            gap = (sorted_probes[i].timestamp - sorted_probes[i-1].timestamp).total_seconds() / 60
            if gap > max_time_gap_minutes:
                inconsistencies.append({
                    'node_id': node_id,
                    'type': 'time_gap',
                    'gap_minutes': gap,
                    'from_time': sorted_probes[i-1].timestamp.isoformat(),
                    'to_time': sorted_probes[i].timestamp.isoformat(),
                    'severity': 'warning' if gap < 60 else 'critical'
                })
        
        latency_values = [p.latency_ms for p in sorted_probes[-20:]]
        if len(latency_values) >= 10:
            mean_lat = np.mean(latency_values)
            std_lat = np.std(latency_values)
            if std_lat > mean_lat * 0.5:
                inconsistencies.append({
                    'node_id': node_id,
                    'type': 'high_jitter',
                    'mean_latency': mean_lat,
                    'std_dev': std_lat,
                    'cv': std_lat / mean_lat if mean_lat > 0 else 0,
                    'severity': 'warning'
                })
        
        success_count = sum(1 for p in sorted_probes[-100:] if p.is_success)
        if len(sorted_probes[-100:]) >= 50 and success_count / len(sorted_probes[-100:]) < 0.8:
            inconsistencies.append({
                'node_id': node_id,
                'type': 'probe_flapping',
                'success_rate': success_count / len(sorted_probes[-100:]),
                'total_probes': len(sorted_probes[-100:]),
                'severity': 'warning' if success_count > 0.5 else 'critical'
            })
    
    return inconsistencies

def generate_verification_report(
    nodes: List[EdgeNode],
    certs: Dict[str, CertificateInfo],
    anomalies_by_node: Dict[str, List[AnomalyRecord]],
    probes_by_node: Dict[str, List[ProbeResult]],
    regions: List[Region],
    node_scores: Dict[str, Dict[str, float]],
    region_aggregations: Dict[str, Dict]
) -> Dict:
    now = datetime.utcnow()
    
    cert_missed = detect_certificate_missed_reports(nodes, certs, anomalies_by_node, now)
    
    nodes_by_region = defaultdict(list)
    for node in nodes:
        nodes_by_region[node.region_id].append(node)
    
    region_errors = verify_all_region_aggregations(
        regions, dict(nodes_by_region), node_scores, region_aggregations
    )
    
    all_anomalies = []
    for alist in anomalies_by_node.values():
        all_anomalies.extend(alist)
    
    probe_verifications = cross_verify_all_probe_anomalies(
        all_anomalies, probes_by_node
    )
    
    all_probes = []
    for plist in probes_by_node.values():
        all_probes.extend(plist)
    
    data_inconsistencies = detect_data_inconsistencies(all_probes)
    
    return {
        'generated_at': now.isoformat(),
        'certificate_missed_detections': [
            {
                'node_id': m.node_id,
                'domain': m.cert.domain,
                'expires_at': m.cert.expires_at.isoformat(),
                'check_reason': m.check_reason,
                'actual_anomalies_count': len(m.actual_anomalies)
            }
            for m in cert_missed
        ],
        'region_aggregation_errors': [
            {
                'region_id': e.region_id,
                'error_type': e.error_type,
                'expected': e.expected_value,
                'actual': e.actual_value,
                'difference': abs(e.expected_value - e.actual_value),
                'details': e.details
            }
            for e in region_errors
        ],
        'probe_anomaly_verifications': [
            {
                'node_id': v.node_id,
                'anomaly_type': v.anomaly_type,
                'confidence': v.confidence,
                'supporting_count': len(v.supporting_evidence),
                'conflicting_count': len(v.conflicting_evidence),
                'supporting_evidence': v.supporting_evidence[:3],
                'conflicting_evidence': v.conflicting_evidence[:3]
            }
            for v in probe_verifications
        ],
        'data_inconsistencies': data_inconsistencies,
        'summary': {
            'certificate_missed_count': len(cert_missed),
            'region_error_count': len(region_errors),
            'low_confidence_anomalies': len([v for v in probe_verifications if v.confidence < 0.7]),
            'data_inconsistency_count': len(data_inconsistencies)
        }
    }
