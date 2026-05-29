from typing import List, Dict
from datetime import datetime
import io
import csv

from .models import HealthRadarPoint, Region, to_dict

def export_to_json(radar_points: List[HealthRadarPoint], 
                   region_health: Dict,
                   generated_at: datetime,
                   region_filter: str = None) -> Dict:
    return {
        'report_type': 'edge_health_radar',
        'generated_at': generated_at.isoformat(),
        'filter': {
            'region': region_filter
        },
        'summary': {
            'total_nodes': len(radar_points),
            'healthy_nodes': sum(1 for p in radar_points if p.health_level.value == 'healthy'),
            'warning_nodes': sum(1 for p in radar_points if p.health_level.value == 'warning'),
            'critical_nodes': sum(1 for p in radar_points if p.health_level.value == 'critical'),
            'total_anomalies': sum(len(p.anomalies) for p in radar_points)
        },
        'region_health': region_health,
        'radar_points': [to_dict(p) for p in radar_points]
    }

def export_to_csv(radar_points: List[HealthRadarPoint], 
                  generated_at: datetime) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        'Edge Health Radar Report',
        f'Generated at: {generated_at.strftime("%Y-%m-%d %H:%M:%S UTC")}'
    ])
    writer.writerow([])
    
    writer.writerow([
        'Node ID', 'Node Name', 'Region ID', 'Region Name',
        'Latency Score', 'Packet Loss Score', 'Certificate Score',
        'Availability Score', 'Overall Score', 'Health Level',
        'Anomaly Count', 'Last Updated'
    ])
    
    for point in radar_points:
        writer.writerow([
            point.node_id,
            point.node_name,
            point.region_id,
            point.region_name,
            f'{point.latency_score:.4f}',
            f'{point.packet_loss_score:.4f}',
            f'{point.certificate_score:.4f}',
            f'{point.availability_score:.4f}',
            f'{point.overall_score:.4f}',
            point.health_level.value,
            len(point.anomalies),
            point.last_updated.strftime('%Y-%m-%d %H:%M:%S')
        ])
    
    writer.writerow([])
    writer.writerow(['Anomalies Detail'])
    writer.writerow([
        'Node ID', 'Anomaly ID', 'Type', 'Severity',
        'Description', 'Detected At'
    ])
    
    for point in radar_points:
        for anomaly in point.anomalies:
            writer.writerow([
                point.node_id,
                anomaly.anomaly_id,
                anomaly.anomaly_type.value,
                anomaly.severity.value,
                anomaly.description,
                anomaly.detected_at.strftime('%Y-%m-%d %H:%M:%S')
            ])
    
    return output.getvalue()

def export_to_pdf(radar_points: List[HealthRadarPoint], 
                  region_health: Dict,
                  generated_at: datetime,
                  regions: List[Region]) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
    from reportlab.lib.units import cm
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=30,
        alignment=1
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=16,
        spaceBefore=20,
        spaceAfter=12
    )
    
    normal_style = styles['Normal']
    
    story = []
    
    story.append(Paragraph('边缘节点健康雷达报告', title_style))
    story.append(Paragraph(f'生成时间: {generated_at.strftime("%Y-%m-%d %H:%M:%S UTC")}', normal_style))
    story.append(Spacer(1, 20))
    
    story.append(Paragraph('一、总体概览', heading_style))
    
    total = len(radar_points)
    healthy = sum(1 for p in radar_points if p.health_level.value == 'healthy')
    warning = sum(1 for p in radar_points if p.health_level.value == 'warning')
    critical = sum(1 for p in radar_points if p.health_level.value == 'critical')
    anomalies = sum(len(p.anomalies) for p in radar_points)
    
    summary_data = [
        ['指标', '数值', '占比'],
        ['节点总数', str(total), '100%'],
        ['健康节点', str(healthy), f'{healthy/total*100:.1f}%' if total > 0 else '0%'],
        ['警告节点', str(warning), f'{warning/total*100:.1f}%' if total > 0 else '0%'],
        ['严重节点', str(critical), f'{critical/total*100:.1f}%' if total > 0 else '0%'],
        ['异常总数', str(anomalies), '-']
    ]
    
    summary_table = Table(summary_data, colWidths=[6*cm, 4*cm, 4*cm])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2C3E50')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.whitesmoke, colors.white])
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 20))
    
    story.append(Paragraph('二、区域健康状况', heading_style))
    
    region_data = [
        ['区域', '节点数', '健康', '警告', '严重', '平均健康分']
    ]
    
    for region_id, rh in region_health.items():
        region_data.append([
            rh['region_name'],
            str(rh['node_count']),
            str(rh['healthy']),
            str(rh['warning']),
            str(rh['critical']),
            f"{rh['avg_overall_score']:.2f}"
        ])
    
    region_table = Table(region_data, colWidths=[3*cm, 2*cm, 2*cm, 2*cm, 2*cm, 3*cm])
    region_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2980B9')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.whitesmoke, colors.white])
    ]))
    story.append(region_table)
    story.append(PageBreak())
    
    story.append(Paragraph('三、节点详细健康状况', heading_style))
    
    node_data = [
        ['节点', '区域', '延迟分', '丢包分', '证书分', '可用分', '总分', '状态']
    ]
    
    for point in radar_points:
        status_color = colors.green if point.health_level.value == 'healthy' else \
                       colors.orange if point.health_level.value == 'warning' else \
                       colors.red
        
        node_data.append([
            point.node_name,
            point.region_name,
            f"{point.latency_score:.2f}",
            f"{point.packet_loss_score:.2f}",
            f"{point.certificate_score:.2f}",
            f"{point.availability_score:.2f}",
            f"{point.overall_score:.2f}",
            point.health_level.value.upper()
        ])
    
    node_table = Table(node_data, colWidths=[3.5*cm, 2.5*cm, 1.5*cm, 1.5*cm, 1.5*cm, 1.5*cm, 1.5*cm, 2*cm])
    node_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#27AE60')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('FONTSIZE', (0, 1), (-1, -1), 7),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.whitesmoke, colors.white])
    ]))
    story.append(node_table)
    story.append(PageBreak())
    
    story.append(Paragraph('四、异常详情', heading_style))
    
    anomaly_data = [
        ['节点', '类型', '严重程度', '描述', '检测时间']
    ]
    
    for point in radar_points:
        for anomaly in point.anomalies:
            anomaly_data.append([
                point.node_name,
                anomaly.anomaly_type.value,
                anomaly.severity.value.upper(),
                anomaly.description,
                anomaly.detected_at.strftime('%m-%d %H:%M')
            ])
    
    if len(anomaly_data) > 1:
        anomaly_table = Table(anomaly_data, colWidths=[3*cm, 3*cm, 2*cm, 6*cm, 2.5*cm])
        anomaly_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E74C3C')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (2, 0), (2, -1), 'CENTER'),
            ('ALIGN', (4, 0), (4, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 7),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
            ('VALIGN', (0, 0), (-1, -1), 'TOP')
        ]))
        story.append(anomaly_table)
    else:
        story.append(Paragraph('无异常记录', normal_style))
    
    doc.build(story)
    return buffer.getvalue()
