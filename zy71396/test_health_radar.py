import unittest
from datetime import datetime, timedelta
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from edge_health_radar.analytics import (
    normalize_latency, normalize_packet_loss, normalize_certificate,
    normalize_availability, calculate_overall_score, determine_health_level,
    detect_anomalies, aggregate_region_health, compute_health_radar,
    LATENCY_WARNING_THRESHOLD, LATENCY_CRITICAL_THRESHOLD,
    PACKET_LOSS_WARNING_THRESHOLD, PACKET_LOSS_CRITICAL_THRESHOLD,
    CERT_WARNING_DAYS, CERT_CRITICAL_DAYS
)
from edge_health_radar.models import (
    EdgeNode, CertificateInfo, ProbeResult, Region,
    HealthLevel, AnomalyType
)
from edge_health_radar.sample_data import generate_regions, generate_nodes, generate_certificates
from edge_health_radar.failure_detector import (
    detect_certificate_missed_reports, verify_region_aggregation,
    detect_data_inconsistencies
)
from edge_health_radar.exporter import export_to_json, export_to_csv

class TestNormalization(unittest.TestCase):
    def test_normalize_latency(self):
        self.assertAlmostEqual(normalize_latency(10), 0.98, places=1)
        self.assertAlmostEqual(normalize_latency(50), 0.9, places=1)
        self.assertAlmostEqual(normalize_latency(100), 0.6, places=1)
        self.assertAlmostEqual(normalize_latency(200), 0.2, places=1)
        self.assertLess(normalize_latency(500), 0.2)
        self.assertEqual(normalize_latency(0), 0.0)

    def test_normalize_packet_loss(self):
        self.assertEqual(normalize_packet_loss(0), 1.0)
        self.assertLess(normalize_packet_loss(PACKET_LOSS_WARNING_THRESHOLD + 0.1), 0.7)
        self.assertLess(normalize_packet_loss(PACKET_LOSS_CRITICAL_THRESHOLD + 0.1), 0.2)
        self.assertEqual(normalize_packet_loss(100), 0.0)

    def test_normalize_certificate(self):
        now = datetime.utcnow()
        
        expired_cert = CertificateInfo(
            cert_id='test1', node_id='n1', domain='test.com', issuer='Test CA',
            serial_number='123', issued_at=now - timedelta(days=100),
            expires_at=now - timedelta(days=5), signature_algorithm='SHA256',
            key_size=2048, is_wildcard=False, last_checked=now,
            chain_valid=True, ocsp_status='good'
        )
        self.assertEqual(normalize_certificate(expired_cert, now), 0.0)
        
        critical_cert = CertificateInfo(
            cert_id='test2', node_id='n2', domain='test.com', issuer='Test CA',
            serial_number='456', issued_at=now - timedelta(days=100),
            expires_at=now + timedelta(days=3), signature_algorithm='SHA256',
            key_size=2048, is_wildcard=False, last_checked=now,
            chain_valid=True, ocsp_status='good'
        )
        self.assertLess(normalize_certificate(critical_cert, now), 0.3)
        
        warning_cert = CertificateInfo(
            cert_id='test3', node_id='n3', domain='test.com', issuer='Test CA',
            serial_number='789', issued_at=now - timedelta(days=100),
            expires_at=now + timedelta(days=15), signature_algorithm='SHA256',
            key_size=2048, is_wildcard=False, last_checked=now,
            chain_valid=True, ocsp_status='good'
        )
        score = normalize_certificate(warning_cert, now)
        self.assertGreaterEqual(score, 0.3)
        self.assertLess(score, 0.7)
        
        healthy_cert = CertificateInfo(
            cert_id='test4', node_id='n4', domain='test.com', issuer='Test CA',
            serial_number='ABC', issued_at=now - timedelta(days=100),
            expires_at=now + timedelta(days=100), signature_algorithm='SHA256',
            key_size=2048, is_wildcard=False, last_checked=now,
            chain_valid=True, ocsp_status='good'
        )
        self.assertGreater(normalize_certificate(healthy_cert, now), 0.7)
        
        self.assertIsNotNone(normalize_certificate(None, now))

    def test_normalize_availability(self):
        now = datetime.utcnow()
        
        all_good = [
            ProbeResult(
                probe_id=f'p{i}', node_id='n1', probe_source='test',
                timestamp=now - timedelta(hours=i), latency_ms=20,
                packet_loss_pct=0, jitter_ms=1,
                http_status=200, dns_resolve_time=5, tcp_connect_time=10,
                tls_handshake_time=20, download_speed_mbps=100,
                is_success=True, error_message=None
            )
            for i in range(10)
        ]
        self.assertEqual(normalize_availability(all_good), 1.0)
        
        mixed = [
            ProbeResult(
                probe_id=f'p{i}', node_id='n1', probe_source='test',
                timestamp=now - timedelta(hours=i), latency_ms=20,
                packet_loss_pct=0, jitter_ms=1,
                http_status=200 if i % 2 == 0 else 500,
                dns_resolve_time=5, tcp_connect_time=10,
                tls_handshake_time=20, download_speed_mbps=100,
                is_success=i % 2 == 0, error_message=None
            )
            for i in range(10)
        ]
        self.assertEqual(normalize_availability(mixed), 0.5)
        
        self.assertEqual(normalize_availability([]), 0.0)

class TestScoring(unittest.TestCase):
    def test_calculate_overall_score(self):
        score = calculate_overall_score(0.8, 0.9, 0.7, 1.0)
        self.assertGreater(score, 0.7)
        self.assertLessEqual(score, 1.0)
        
        score = calculate_overall_score(0, 0, 0, 0)
        self.assertEqual(score, 0)
        
        score = calculate_overall_score(1, 1, 1, 1)
        self.assertEqual(score, 1.0)

    def test_determine_health_level(self):
        self.assertEqual(determine_health_level(0.9), HealthLevel.HEALTHY)
        self.assertEqual(determine_health_level(0.6), HealthLevel.WARNING)
        self.assertEqual(determine_health_level(0.3), HealthLevel.CRITICAL)
        self.assertEqual(determine_health_level(0.1), HealthLevel.UNKNOWN)

class TestAnomalyDetection(unittest.TestCase):
    def setUp(self):
        self.now = datetime.utcnow()
        self.node = EdgeNode(
            node_id='test-node', name='test-node-01', region_id='cn-bj',
            ip_address='10.0.0.1', ipv6_address=None, is_active=True,
            hardware_model='Test Server', bandwidth_capacity=10000,
            last_maintenance=None, provisioned_at=self.now - timedelta(days=30),
            tags=['test']
        )
        self.region = Region(
            region_id='cn-bj', name='北京', country='CN', city='北京',
            timezone='Asia/Shanghai', latitude=39.9, longitude=116.4,
            isp='Test ISP', tier=1
        )

    def test_detect_latency_anomaly(self):
        probes = [
            ProbeResult(
                probe_id=f'p{i}', node_id='test-node', probe_source='beijing',
                timestamp=self.now - timedelta(minutes=i*5),
                latency_ms=250, packet_loss_pct=0, jitter_ms=5,
                http_status=200, dns_resolve_time=5, tcp_connect_time=10,
                tls_handshake_time=20, download_speed_mbps=100,
                is_success=True, error_message=None
            )
            for i in range(10)
        ]
        
        anomalies = detect_anomalies(self.node, probes, None, probes, self.now)
        latency_anomalies = [a for a in anomalies if a.anomaly_type == AnomalyType.LATENCY_SPIKE]
        self.assertGreater(len(latency_anomalies), 0)

    def test_detect_packet_loss_anomaly(self):
        probes = [
            ProbeResult(
                probe_id=f'p{i}', node_id='test-node', probe_source='beijing',
                timestamp=self.now - timedelta(minutes=i*5),
                latency_ms=20, packet_loss_pct=8, jitter_ms=5,
                http_status=200, dns_resolve_time=5, tcp_connect_time=10,
                tls_handshake_time=20, download_speed_mbps=100,
                is_success=True, error_message=None
            )
            for i in range(10)
        ]
        
        anomalies = detect_anomalies(self.node, probes, None, probes, self.now)
        loss_anomalies = [a for a in anomalies if a.anomaly_type == AnomalyType.PACKET_LOSS_HIGH]
        self.assertGreater(len(loss_anomalies), 0)

    def test_detect_certificate_anomaly(self):
        expiring_cert = CertificateInfo(
            cert_id='test-cert', node_id='test-node', domain='test.com',
            issuer='Test CA', serial_number='123',
            issued_at=self.now - timedelta(days=100),
            expires_at=self.now + timedelta(days=3),
            signature_algorithm='SHA256', key_size=2048,
            is_wildcard=False, last_checked=self.now,
            chain_valid=True, ocsp_status='good'
        )
        
        probes = [
            ProbeResult(
                probe_id=f'p{i}', node_id='test-node', probe_source='beijing',
                timestamp=self.now - timedelta(minutes=i*5),
                latency_ms=20, packet_loss_pct=0, jitter_ms=5,
                http_status=200, dns_resolve_time=5, tcp_connect_time=10,
                tls_handshake_time=20, download_speed_mbps=100,
                is_success=True, error_message=None
            )
            for i in range(10)
        ]
        
        anomalies = detect_anomalies(self.node, probes, expiring_cert, probes, self.now)
        cert_anomalies = [a for a in anomalies if a.anomaly_type in 
                         [AnomalyType.CERT_EXPIRED, AnomalyType.CERT_EXPIRING_SOON]]
        self.assertGreater(len(cert_anomalies), 0)

class TestRegionAggregation(unittest.TestCase):
    def setUp(self):
        self.now = datetime.utcnow()
        from edge_health_radar.models import HealthRadarPoint
        
        self.regions = [
            Region(region_id='r1', name='Region1', country='CN', city='City1',
                   timezone='Asia/Shanghai', latitude=0, longitude=0, isp='ISP1', tier=1),
            Region(region_id='r2', name='Region2', country='CN', city='City2',
                   timezone='Asia/Shanghai', latitude=0, longitude=0, isp='ISP2', tier=1)
        ]
        
        self.radar_points = [
            HealthRadarPoint(
                node_id=f'n{i}', node_name=f'node-{i}',
                region_id='r1' if i < 3 else 'r2',
                region_name='Region1' if i < 3 else 'Region2',
                latency_score=0.5 + i * 0.1,
                packet_loss_score=0.6,
                certificate_score=0.7,
                availability_score=0.8,
                overall_score=0.65 + i * 0.05,
                health_level=HealthLevel.HEALTHY,
                anomalies=[],
                last_updated=self.now
            )
            for i in range(5)
        ]

    def test_aggregate_region_health(self):
        result = aggregate_region_health(self.radar_points, self.regions)
        
        self.assertIn('r1', result)
        self.assertIn('r2', result)
        
        self.assertEqual(result['r1']['node_count'], 3)
        self.assertEqual(result['r2']['node_count'], 2)
        
        self.assertGreater(result['r1']['avg_overall_score'], 0)
        self.assertLess(result['r1']['avg_overall_score'], 1)

class TestFailureDetector(unittest.TestCase):
    def setUp(self):
        self.now = datetime.utcnow()
        self.nodes = [
            EdgeNode(
                node_id=f'n{i}', name=f'node-{i}', region_id='r1',
                ip_address=f'10.0.0.{i}', ipv6_address=None, is_active=True,
                hardware_model='Test', bandwidth_capacity=10000,
                last_maintenance=None, provisioned_at=self.now - timedelta(days=30),
                tags=[]
            )
            for i in range(3)
        ]

    def test_detect_certificate_missed_reports(self):
        certs = {
            'n0': CertificateInfo(
                cert_id='c0', node_id='n0', domain='test.com',
                issuer='CA', serial_number='1',
                issued_at=self.now - timedelta(days=100),
                expires_at=self.now - timedelta(days=1),
                signature_algorithm='SHA256', key_size=2048,
                is_wildcard=False, last_checked=self.now,
                chain_valid=True, ocsp_status='good'
            ),
            'n1': CertificateInfo(
                cert_id='c1', node_id='n1', domain='test.com',
                issuer='CA', serial_number='2',
                issued_at=self.now - timedelta(days=100),
                expires_at=self.now + timedelta(days=100),
                signature_algorithm='SHA256', key_size=2048,
                is_wildcard=False, last_checked=self.now,
                chain_valid=True, ocsp_status='good'
            ),
            'n2': CertificateInfo(
                cert_id='c2', node_id='n2', domain='test.com',
                issuer='CA', serial_number='3',
                issued_at=self.now - timedelta(days=100),
                expires_at=self.now + timedelta(days=100),
                signature_algorithm='SHA256', key_size=2048,
                is_wildcard=False, 
                last_checked=self.now - timedelta(hours=25),
                chain_valid=True, ocsp_status='good'
            )
        }
        
        anomalies = {'n0': [], 'n1': [], 'n2': []}
        
        missed = detect_certificate_missed_reports(self.nodes, certs, anomalies, self.now)
        self.assertGreater(len(missed), 0)

    def test_detect_data_inconsistencies(self):
        probes = [
            ProbeResult(
                probe_id=f'p{i}', node_id='n1', probe_source='beijing',
                timestamp=self.now - timedelta(hours=i if i < 5 else i + 2),
                latency_ms=20 + i * 50,
                packet_loss_pct=0.1, jitter_ms=1,
                http_status=200, dns_resolve_time=5, tcp_connect_time=10,
                tls_handshake_time=20, download_speed_mbps=100,
                is_success=True, error_message=None
            )
            for i in range(10)
        ]
        
        inconsistencies = detect_data_inconsistencies(probes)
        self.assertGreater(len(inconsistencies), 0)

class TestExporter(unittest.TestCase):
    def setUp(self):
        self.now = datetime.utcnow()
        from edge_health_radar.models import HealthRadarPoint
        
        self.radar_points = [
            HealthRadarPoint(
                node_id=f'n{i}', node_name=f'node-{i}',
                region_id='r1', region_name='Region1',
                latency_score=0.8, packet_loss_score=0.9,
                certificate_score=0.7, availability_score=1.0,
                overall_score=0.85,
                health_level=HealthLevel.HEALTHY,
                anomalies=[],
                last_updated=self.now
            )
            for i in range(3)
        ]
        self.region_health = {'r1': {'region_name': 'Region1', 'node_count': 3}}

    def test_export_to_json(self):
        result = export_to_json(self.radar_points, self.region_health, self.now)
        self.assertIn('report_type', result)
        self.assertEqual(result['report_type'], 'edge_health_radar')
        self.assertEqual(result['summary']['total_nodes'], 3)

    def test_export_to_csv(self):
        result = export_to_csv(self.radar_points, self.now)
        self.assertIsInstance(result, str)
        self.assertIn('Edge Health Radar Report', result)
        self.assertIn('Node ID', result)

class TestComputeHealthRadar(unittest.TestCase):
    def setUp(self):
        self.now = datetime.utcnow()
        self.node = EdgeNode(
            node_id='test-node', name='test-node-01', region_id='cn-bj',
            ip_address='10.0.0.1', ipv6_address=None, is_active=True,
            hardware_model='Test Server', bandwidth_capacity=10000,
            last_maintenance=None, provisioned_at=self.now - timedelta(days=30),
            tags=['test']
        )
        self.region = Region(
            region_id='cn-bj', name='北京', country='CN', city='北京',
            timezone='Asia/Shanghai', latitude=39.9, longitude=116.4,
            isp='Test ISP', tier=1
        )

    def test_compute_health_radar_basic(self):
        probes = [
            ProbeResult(
                probe_id=f'p{i}', node_id='test-node', probe_source='beijing',
                timestamp=self.now - timedelta(minutes=i*10),
                latency_ms=30, packet_loss_pct=0.5, jitter_ms=2,
                http_status=200, dns_resolve_time=5, tcp_connect_time=10,
                tls_handshake_time=20, download_speed_mbps=100,
                is_success=True, error_message=None
            )
            for i in range(20)
        ]
        
        cert = CertificateInfo(
            cert_id='test-cert', node_id='test-node', domain='test.com',
            issuer='Test CA', serial_number='123',
            issued_at=self.now - timedelta(days=100),
            expires_at=self.now + timedelta(days=100),
            signature_algorithm='SHA256', key_size=2048,
            is_wildcard=False, last_checked=self.now,
            chain_valid=True, ocsp_status='good'
        )
        
        radar = compute_health_radar(self.node, probes, cert, self.region, probes, self.now)
        
        self.assertEqual(radar.node_id, 'test-node')
        self.assertGreater(radar.overall_score, 0)
        self.assertLessEqual(radar.overall_score, 1)
        self.assertIsNotNone(radar.health_level)

class TestSampleData(unittest.TestCase):
    def test_generate_regions(self):
        regions = generate_regions()
        self.assertGreater(len(regions), 0)
        self.assertIsNotNone(regions[0].region_id)
        self.assertIsNotNone(regions[0].name)

    def test_generate_nodes(self):
        regions = generate_regions()
        nodes = generate_nodes(regions)
        self.assertGreater(len(nodes), 0)
        
        region_counts = {}
        for node in nodes:
            region_counts[node.region_id] = region_counts.get(node.region_id, 0) + 1
        
        for region in regions:
            self.assertIn(region.region_id, region_counts)

    def test_generate_certificates(self):
        now = datetime.utcnow()
        regions = generate_regions()
        nodes = generate_nodes(regions)
        certs = generate_certificates(nodes, now)
        
        self.assertEqual(len(certs), len(nodes))
        for node_id, cert in certs.items():
            self.assertEqual(cert.node_id, node_id)
            self.assertIsNotNone(cert.expires_at)

if __name__ == '__main__':
    unittest.main(verbosity=2)
