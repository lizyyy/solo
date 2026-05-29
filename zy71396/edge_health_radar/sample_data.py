from typing import List, Dict, Tuple
from datetime import datetime, timedelta
import random
import uuid
import numpy as np

from .models import (
    Region, EdgeNode, CertificateInfo, ProbeResult
)

PROBE_SOURCES = ['beijing', 'shanghai', 'guangzhou', 'shenzhen', 'chengdu', 'wuhan']

REGION_DATA = [
    {'region_id': 'cn-bj', 'name': '北京', 'country': 'CN', 'city': '北京', 
     'timezone': 'Asia/Shanghai', 'lat': 39.9042, 'lon': 116.4074, 'isp': '中国电信', 'tier': 1},
    {'region_id': 'cn-sh', 'name': '上海', 'country': 'CN', 'city': '上海',
     'timezone': 'Asia/Shanghai', 'lat': 31.2304, 'lon': 121.4737, 'isp': '中国联通', 'tier': 1},
    {'region_id': 'cn-gz', 'name': '广州', 'country': 'CN', 'city': '广州',
     'timezone': 'Asia/Shanghai', 'lat': 23.1291, 'lon': 113.2644, 'isp': '中国电信', 'tier': 1},
    {'region_id': 'cn-sz', 'name': '深圳', 'country': 'CN', 'city': '深圳',
     'timezone': 'Asia/Shanghai', 'lat': 22.5431, 'lon': 114.0579, 'isp': '中国移动', 'tier': 1},
    {'region_id': 'cn-cd', 'name': '成都', 'country': 'CN', 'city': '成都',
     'timezone': 'Asia/Shanghai', 'lat': 30.5728, 'lon': 104.0668, 'isp': '中国电信', 'tier': 2},
    {'region_id': 'cn-wh', 'name': '武汉', 'country': 'CN', 'city': '武汉',
     'timezone': 'Asia/Shanghai', 'lat': 30.5928, 'lon': 114.3055, 'isp': '中国联通', 'tier': 2},
    {'region_id': 'cn-hz', 'name': '杭州', 'country': 'CN', 'city': '杭州',
     'timezone': 'Asia/Shanghai', 'lat': 30.2741, 'lon': 120.1551, 'isp': '中国电信', 'tier': 2},
    {'region_id': 'cn-nj', 'name': '南京', 'country': 'CN', 'city': '南京',
     'timezone': 'Asia/Shanghai', 'lat': 32.0603, 'lon': 118.7969, 'isp': '中国移动', 'tier': 2},
]

NODE_NAMES = [
    'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta',
    'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi'
]

HARDWARE_MODELS = [
    'Dell R750 2x Intel Xeon Gold 6330 256GB',
    'HPE DL380 Gen10 2x Intel Xeon Gold 6248R 192GB',
    'Supermicro SYS-220U-TNR 2x AMD EPYC 7542 512GB',
    'Lenovo SR650 V2 2x Intel Xeon Gold 5318Y 128GB',
    'Inspur NF5280M6 2x Intel Xeon Gold 6338 384GB',
]

CERT_ISSUERS = [
    "Let's Encrypt Authority X3",
    'DigiCert Global G2 TLS RSA SHA256 2020 CA1',
    'Sectigo RSA Domain Validation Secure Server CA',
    'GlobalSign RSA OV SSL CA 2018',
    'ZeroSSL ECC Domain Secure Site CA',
]

DOMAINS = [
    'cdn.example.com', 'static.example.net', 'img.example.org',
    'media.example.com', 'assets.example.net', 'files.example.org',
    'video.example.com', 'download.example.net', 'stream.example.org',
]

def generate_regions() -> List[Region]:
    return [
        Region(
            region_id=r['region_id'],
            name=r['name'],
            country=r['country'],
            city=r['city'],
            timezone=r['timezone'],
            latitude=r['lat'],
            longitude=r['lon'],
            isp=r['isp'],
            tier=r['tier']
        )
        for r in REGION_DATA
    ]

def generate_nodes(regions: List[Region]) -> List[EdgeNode]:
    nodes = []
    node_idx = 0
    
    for region in regions:
        nodes_per_region = 3 if region.tier == 1 else 2
        for i in range(nodes_per_region):
            node_name = f"edge-{region.region_id}-{NODE_NAMES[node_idx % len(NODE_NAMES)]}"
            third_octet = random.randint(1, 254)
            fourth_octet = random.randint(1, 254)
            
            nodes.append(EdgeNode(
                node_id=f"node-{node_idx:03d}",
                name=node_name,
                region_id=region.region_id,
                ip_address=f"10.{10 + regions.index(region)}.{third_octet}.{fourth_octet}",
                ipv6_address=f"2408:4001:{100 + node_idx:x}::1" if random.random() > 0.3 else None,
                is_active=random.random() > 0.05,
                hardware_model=random.choice(HARDWARE_MODELS),
                bandwidth_capacity=random.choice([10000, 20000, 40000, 100000]),
                last_maintenance=datetime.utcnow() - timedelta(days=random.randint(1, 90)) if random.random() > 0.2 else None,
                provisioned_at=datetime.utcnow() - timedelta(days=random.randint(30, 730)),
                tags=['production', 'edge', region.isp]
            ))
            node_idx += 1
    
    return nodes

def generate_certificates(nodes: List[EdgeNode], now: datetime) -> Dict[str, CertificateInfo]:
    certs = {}
    
    for i, node in enumerate(nodes):
        domain = random.choice(DOMAINS)
        
        if i % 15 == 0:
            expires_at = now - timedelta(days=random.randint(1, 5))
        elif i % 10 == 0:
            expires_at = now + timedelta(days=random.randint(1, 6))
        elif i % 7 == 0:
            expires_at = now + timedelta(days=random.randint(8, 29))
        elif i % 5 == 0:
            expires_at = now + timedelta(days=random.randint(30, 89))
        else:
            expires_at = now + timedelta(days=random.randint(90, 365))
        
        certs[node.node_id] = CertificateInfo(
            cert_id=f"cert-{i:04d}",
            node_id=node.node_id,
            domain=domain,
            issuer=random.choice(CERT_ISSUERS),
            serial_number=hex(random.getrandbits(128))[2:].upper(),
            issued_at=expires_at - timedelta(days=90),
            expires_at=expires_at,
            signature_algorithm=random.choice(['SHA256-RSA', 'SHA384-ECDSA', 'SHA256-ECDSA']),
            key_size=random.choice([2048, 4096]),
            is_wildcard=random.random() > 0.7,
            last_checked=now - timedelta(hours=random.randint(0, 26)),
            chain_valid=random.random() > 0.03,
            ocsp_status=random.choice(['good', 'revoked', 'unknown', None]) if random.random() > 0.3 else None
        )
    
    return certs

def generate_latency(node_idx: int, source_idx: int, has_anomaly: bool) -> float:
    base_latency = 20 + abs(node_idx - source_idx) * 5 + random.gauss(0, 8)
    
    if has_anomaly:
        anomaly_type = random.choice(['spike', 'degraded', 'oscillate'])
        if anomaly_type == 'spike':
            base_latency = random.uniform(150, 400)
        elif anomaly_type == 'degraded':
            base_latency = random.uniform(80, 150)
        else:
            base_latency = random.uniform(30, 200)
    
    return max(1, base_latency)

def generate_packet_loss(node_idx: int, has_anomaly: bool) -> float:
    base_loss = max(0, random.gauss(0.3, 0.5))
    
    if has_anomaly:
        if random.random() > 0.5:
            base_loss = random.uniform(3, 15)
        else:
            base_loss = random.uniform(1, 3)
    
    return min(100, base_loss)

def generate_probe_results(nodes: List[EdgeNode], now: datetime, 
                          hours_back: int = 24) -> Dict[str, List[ProbeResult]]:
    probes_by_node = {}
    
    for node_idx, node in enumerate(nodes):
        probes = []
        
        has_latency_anomaly = node_idx % 9 == 0
        has_loss_anomaly = node_idx % 11 == 0
        has_data_gap = node_idx % 13 == 0
        has_flapping = node_idx % 17 == 0
        
        gap_hour = random.randint(2, hours_back - 2) if has_data_gap else -1
        
        for hour in range(hours_back, -1, -1):
            if has_data_gap and hour == gap_hour:
                continue
            
            for source_idx, source in enumerate(PROBE_SOURCES):
                probe_time = now - timedelta(hours=hour, minutes=random.randint(0, 59))
                
                has_spike = has_latency_anomaly and hour <= 2
                has_loss_spike = has_loss_anomaly and hour <= 3
                
                is_success = True
                if has_flapping and random.random() < 0.3:
                    is_success = False
                
                latency = generate_latency(node_idx, source_idx, has_spike)
                loss = generate_packet_loss(node_idx, has_loss_spike)
                
                probes.append(ProbeResult(
                    probe_id=f"probe-{uuid.uuid4().hex[:12]}",
                    node_id=node.node_id,
                    probe_source=source,
                    timestamp=probe_time,
                    latency_ms=latency,
                    packet_loss_pct=loss,
                    jitter_ms=abs(random.gauss(2, 3)),
                    http_status=random.choice([200, 200, 200, 201, 301, 302, 404, 500, None]) if is_success else None,
                    dns_resolve_time=random.uniform(1, 50),
                    tcp_connect_time=random.uniform(5, 30),
                    tls_handshake_time=random.uniform(10, 50),
                    download_speed_mbps=random.uniform(50, 800) if is_success else None,
                    is_success=is_success,
                    error_message=random.choice(['Connection timeout', 'SSL handshake failed', None]) if not is_success else None
                ))
        
        probes_by_node[node.node_id] = sorted(probes, key=lambda x: x.timestamp)
    
    return probes_by_node

def load_all_sample_data() -> Tuple[List[Region], List[EdgeNode], Dict[str, CertificateInfo], Dict[str, List[ProbeResult]]]:
    now = datetime.utcnow()
    
    regions = generate_regions()
    nodes = generate_nodes(regions)
    certs = generate_certificates(nodes, now)
    probes = generate_probe_results(nodes, now)
    
    return regions, nodes, certs, probes
