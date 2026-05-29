from flask import jsonify, request, Response
from datetime import datetime
import io
import csv
import json

from . import app
from .models import to_dict
from .analytics import (
    compute_health_radar, aggregate_region_health, generate_trend_data
)
from .sample_data import load_all_sample_data
from .failure_detector import generate_verification_report
from .exporter import export_to_pdf, export_to_csv, export_to_json

REGIONS, NODES, CERTS, PROBES = load_all_sample_data()

def get_computed_data():
    now = datetime.utcnow()
    
    region_map = {r.region_id: r for r in REGIONS}
    
    radar_points = []
    node_scores = {}
    
    for node in NODES:
        region = region_map[node.region_id]
        probes = PROBES.get(node.node_id, [])
        cert = CERTS.get(node.node_id)
        
        radar = compute_health_radar(node, probes, cert, region, probes, now)
        radar_points.append(radar)
        
        node_scores[node.node_id] = {
            'latency_score': radar.latency_score,
            'packet_loss_score': radar.packet_loss_score,
            'certificate_score': radar.certificate_score,
            'availability_score': radar.availability_score,
            'overall_score': radar.overall_score
        }
    
    region_health = aggregate_region_health(radar_points, REGIONS)
    
    anomalies_by_node = {rp.node_id: rp.anomalies for rp in radar_points}
    
    verification_report = generate_verification_report(
        NODES, CERTS, anomalies_by_node, PROBES, REGIONS, node_scores, region_health
    )
    
    return radar_points, region_health, node_scores, verification_report, now

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'service': 'edge-health-radar',
        'timestamp': datetime.utcnow().isoformat()
    })

@app.route('/api/radar', methods=['GET'])
def get_radar_data():
    region_filter = request.args.get('region')
    health_filter = request.args.get('health')
    
    radar_points, region_health, node_scores, verification_report, now = get_computed_data()
    
    filtered_points = radar_points
    if region_filter:
        filtered_points = [p for p in filtered_points if p.region_id == region_filter]
    if health_filter:
        filtered_points = [p for p in filtered_points if p.health_level.value == health_filter]
    
    return jsonify({
        'timestamp': now.isoformat(),
        'total_nodes': len(NODES),
        'filtered_nodes': len(filtered_points),
        'radar_points': [to_dict(p) for p in filtered_points],
        'region_summary': region_health,
        'verification_summary': verification_report['summary']
    })

@app.route('/api/regions', methods=['GET'])
def get_regions():
    return jsonify({
        'regions': [to_dict(r) for r in REGIONS],
        'total': len(REGIONS)
    })

@app.route('/api/nodes', methods=['GET'])
def get_nodes():
    region_filter = request.args.get('region')
    
    filtered_nodes = NODES
    if region_filter:
        filtered_nodes = [n for n in NODES if n.region_id == region_filter]
    
    return jsonify({
        'nodes': [to_dict(n) for n in filtered_nodes],
        'total': len(filtered_nodes)
    })

@app.route('/api/nodes/<node_id>', methods=['GET'])
def get_node_detail(node_id):
    node = next((n for n in NODES if n.node_id == node_id), None)
    if not node:
        return jsonify({'error': 'Node not found'}), 404
    
    cert = CERTS.get(node_id)
    probes = PROBES.get(node_id, [])
    
    recent_probes = [p for p in probes[-100:]][::-1]
    
    return jsonify({
        'node': to_dict(node),
        'certificate': to_dict(cert) if cert else None,
        'recent_probes': [to_dict(p) for p in recent_probes[:50]],
        'probe_count': len(probes)
    })

@app.route('/api/trend', methods=['GET'])
def get_trend():
    region_filter = request.args.get('region')
    hours = int(request.args.get('hours', 24))
    
    trend_data = generate_trend_data(PROBES, CERTS, NODES, hours, region_filter)
    
    return jsonify({
        'hours': hours,
        'region': region_filter,
        'data_points': [to_dict(p) for p in trend_data]
    })

@app.route('/api/anomalies', methods=['GET'])
def get_anomalies():
    node_filter = request.args.get('node')
    type_filter = request.args.get('type')
    severity_filter = request.args.get('severity')
    
    radar_points, _, _, _, _ = get_computed_data()
    
    all_anomalies = []
    for rp in radar_points:
        for anomaly in rp.anomalies:
            all_anomalies.append({
                'node_id': rp.node_id,
                'node_name': rp.node_name,
                'region_id': rp.region_id,
                'region_name': rp.region_name,
                **to_dict(anomaly)
            })
    
    if node_filter:
        all_anomalies = [a for a in all_anomalies if a['node_id'] == node_filter]
    if type_filter:
        all_anomalies = [a for a in all_anomalies if a['anomaly_type'] == type_filter]
    if severity_filter:
        all_anomalies = [a for a in all_anomalies if a['severity'] == severity_filter]
    
    return jsonify({
        'total': len(all_anomalies),
        'anomalies': all_anomalies
    })

@app.route('/api/verification', methods=['GET'])
def get_verification_report():
    _, _, _, verification_report, _ = get_computed_data()
    
    return jsonify(verification_report)

@app.route('/api/certificates/expiring', methods=['GET'])
def get_expiring_certs():
    days = int(request.args.get('days', 30))
    now = datetime.utcnow()
    
    expiring = []
    for node_id, cert in CERTS.items():
        days_until = (cert.expires_at - now).total_seconds() / 86400
        if days_until <= days:
            node = next((n for n in NODES if n.node_id == node_id), None)
            expiring.append({
                'node_id': node_id,
                'node_name': node.name if node else None,
                'domain': cert.domain,
                'expires_at': cert.expires_at.isoformat(),
                'days_until_expiry': days_until,
                'issuer': cert.issuer,
                'chain_valid': cert.chain_valid
            })
    
    expiring.sort(key=lambda x: x['days_until_expiry'])
    
    return jsonify({
        'threshold_days': days,
        'total': len(expiring),
        'certificates': expiring
    })

@app.route('/api/export/<format>', methods=['GET'])
def export_data(format):
    region_filter = request.args.get('region')
    
    radar_points, region_health, _, _, now = get_computed_data()
    
    filtered_points = radar_points
    if region_filter:
        filtered_points = [p for p in filtered_points if p.region_id == region_filter]
    
    if format == 'json':
        data = export_to_json(filtered_points, region_health, now, region_filter)
        return Response(
            json.dumps(data, indent=2, ensure_ascii=False),
            mimetype='application/json',
            headers={'Content-Disposition': f'attachment; filename=health_report_{now.strftime("%Y%m%d")}.json'}
        )
    
    elif format == 'csv':
        csv_content = export_to_csv(filtered_points, now)
        return Response(
            csv_content,
            mimetype='text/csv; charset=utf-8',
            headers={'Content-Disposition': f'attachment; filename=health_report_{now.strftime("%Y%m%d")}.csv'}
        )
    
    elif format == 'pdf':
        try:
            pdf_content = export_to_pdf(filtered_points, region_health, now, REGIONS)
            return Response(
                pdf_content,
                mimetype='application/pdf',
                headers={'Content-Disposition': f'attachment; filename=health_report_{now.strftime("%Y%m%d")}.pdf'}
            )
        except Exception as e:
            return jsonify({'error': f'PDF export failed: {str(e)}'}), 500
    
    else:
        return jsonify({'error': 'Unsupported format'}), 400

@app.route('/api/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    radar_points, region_health, _, verification_report, now = get_computed_data()
    
    healthy = sum(1 for p in radar_points if p.health_level.value == 'healthy')
    warning = sum(1 for p in radar_points if p.health_level.value == 'warning')
    critical = sum(1 for p in radar_points if p.health_level.value == 'critical')
    
    now = datetime.utcnow()
    expiring_7d = sum(1 for c in CERTS.values() 
                      if 0 < (c.expires_at - now).total_seconds() / 86400 <= 7)
    expiring_30d = sum(1 for c in CERTS.values() 
                       if 0 < (c.expires_at - now).total_seconds() / 86400 <= 30)
    
    total_anomalies = sum(len(p.anomalies) for p in radar_points)
    
    return jsonify({
        'nodes': {
            'total': len(radar_points),
            'healthy': healthy,
            'warning': warning,
            'critical': critical
        },
        'certificates': {
            'expiring_7d': expiring_7d,
            'expiring_30d': expiring_30d,
            'expired': sum(1 for c in CERTS.values() 
                          if (c.expires_at - now).total_seconds() <= 0)
        },
        'anomalies': {
            'total': total_anomalies,
            'by_type': verification_report['summary']
        },
        'regions': {
            'total': len(REGIONS),
            'with_critical': sum(1 for rh in region_health.values() 
                                if rh['critical'] > 0)
        },
        'generated_at': now.isoformat()
    })
