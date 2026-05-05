from flask import Blueprint, request, jsonify, make_response
from extensions import db
from models.models import (
    CustomsDeclaration,
    DeclarationItem,
    Manifest,
    ManifestItem,
    SealRecord,
    XrayInspection,
    LabSample,
    RiskAssessment,
    ReviewRecord
)
from datetime import datetime
import json

export_bp = Blueprint('export', __name__)


def export_markdown_checklist(declaration_no=None, reviewer_name=None):
    if declaration_no:
        declaration = CustomsDeclaration.query.filter_by(
            declaration_no=declaration_no
        ).first()
        
        if not declaration:
            return None, "Declaration not found"
        
        declarations = [declaration]
    else:
        declarations = CustomsDeclaration.query.order_by(
            CustomsDeclaration.created_at.desc()
        ).all()
    
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    reviewer = reviewer_name or '查验科'
    
    markdown = f"""# 小口岸查验清单
**生成时间**: {now}
**复核人**: {reviewer}

---

"""
    
    total_declarations = len(declarations)
    total_risks = 0
    total_reviews = 0
    
    for decl in declarations:
        markdown += f"## 报关单: {decl.declaration_no}\n\n"
        
        markdown += "### 基本信息\n\n"
        markdown += "| 项目 | 内容 |\n|------|------|\n"
        if decl.vessel_name:
            markdown += f"| 船名 | {decl.vessel_name} |\n"
        if decl.voyage_no:
            markdown += f"| 航次 | {decl.voyage_no} |\n"
        if decl.port_of_departure:
            markdown += f"| 启运港 | {decl.port_of_departure} |\n"
        if decl.port_of_arrival:
            markdown += f"| 目的港 | {decl.port_of_arrival} |\n"
        if decl.arrival_date:
            markdown += f"| 到港日期 | {decl.arrival_date.strftime('%Y-%m-%d')} |\n"
        if decl.consignee:
            markdown += f"| 收货人 | {decl.consignee} |\n"
        if decl.consignor:
            markdown += f"| 发货人 | {decl.consignor} |\n"
        markdown += f"| 总重量 | {decl.total_weight or '-'} kg |\n"
        markdown += f"| 总件数 | {decl.total_packages or '-'} 件 |\n"
        markdown += f"| 集装箱数 | {decl.total_containers or '-'} 个 |\n"
        markdown += f"| 状态 | {decl.status} |\n\n"
        
        items = DeclarationItem.query.filter_by(
            declaration_id=decl.id
        ).all()
        
        if items:
            markdown += "### 申报商品\n\n"
            markdown += "| 序号 | HS编码 | 商品描述 | 数量 | 单位 | 重量(kg) | 风险等级 |\n"
            markdown += "|------|--------|----------|------|------|----------|----------|\n"
            
            for item in items:
                risk_icon = "🔴" if item.is_high_risk else "🟢"
                markdown += f"| {item.item_no or '-'} | {item.hs_code} | {item.description[:50]}{'...' if len(item.description) > 50 else ''} | {item.quantity} | {item.unit} | {item.weight or '-'} | {risk_icon} {item.risk_level} |\n"
            
            markdown += "\n"
        
        manifests = Manifest.query.filter_by(
            declaration_no=decl.declaration_no
        ).all()
        
        if manifests:
            markdown += "### 舱单信息\n\n"
            for manifest in manifests:
                markdown += f"#### 舱单: {manifest.manifest_no}\n"
                markdown += f"- 集装箱号: {manifest.container_no or '-'}\n"
                markdown += f"- 封签号: {manifest.seal_no or '-'}\n"
                markdown += f"- 总重量: {manifest.total_weight or '-'} kg\n"
                markdown += f"- 总件数: {manifest.total_packages or '-'} 件\n\n"
        
        seals = SealRecord.query.filter_by(
            declaration_id=decl.id
        ).all()
        
        if seals:
            markdown += "### 封签记录\n\n"
            markdown += "| 集装箱号 | 封签号 | 状态 | 是否断链 | 备注 |\n"
            markdown += "|----------|--------|------|----------|------|\n"
            
            for seal in seals:
                chain_broken = "是 🔴" if seal.is_chain_broken else "否 🟢"
                markdown += f"| {seal.container_no} | {seal.seal_no} | {seal.seal_status} | {chain_broken} | {seal.notes or '-'} |\n"
            
            markdown += "\n"
        
        xrays = XrayInspection.query.filter_by(
            declaration_id=decl.id
        ).all()
        
        if xrays:
            markdown += "### X光机检查\n\n"
            for xray in xrays:
                markdown += f"#### 检查编号: {xray.inspection_no}\n"
                markdown += f"- 集装箱号: {xray.container_no or '-'}\n"
                markdown += f"- 检查日期: {xray.inspection_date.strftime('%Y-%m-%d %H:%M') if xray.inspection_date else '-'}\n"
                markdown += f"- 检查人员: {xray.inspector_name or '-'}\n"
                if xray.anomalies:
                    markdown += f"- **异常情况**: {xray.anomalies}\n"
                    markdown += f"- 异常类型: {xray.anomaly_type or '-'}\n"
                    markdown += f"- 严重程度: {xray.anomaly_severity}\n"
                markdown += f"- 检查结论: {xray.scan_result or '-'}\n"
                markdown += f"- 是否需要进一步检查: {'是' if xray.required_further_inspection else '否'}\n\n"
        
        lab_samples = LabSample.query.filter_by(
            declaration_id=decl.id
        ).all()
        
        if lab_samples:
            markdown += "### 实验室抽检\n\n"
            markdown += "| 样品编号 | 样品类型 | HS编码 | 采样日期 | 检测截止 | 是否超期 | 检测结果 |\n"
            markdown += "|----------|----------|--------|----------|----------|----------|----------|\n"
            
            for sample in lab_samples:
                overdue = "是 🔴" if sample.is_overdue else "否 🟢"
                result = "合格 🟢" if sample.is_pass else "不合格 🔴" if sample.is_pass is False else "-"
                markdown += f"| {sample.sample_no} | {sample.sample_type or '-'} | {sample.hs_code or '-'} | {sample.sample_date.strftime('%Y-%m-%d') if sample.sample_date else '-'} | {sample.test_deadline.strftime('%Y-%m-%d') if sample.test_deadline else '-'} | {overdue} | {result} |\n"
            
            markdown += "\n"
        
        risks = RiskAssessment.query.filter_by(
            declaration_id=decl.id
        ).order_by(
            db.case(
                (RiskAssessment.risk_level == 'critical', 1),
                (RiskAssessment.risk_level == 'high', 2),
                (RiskAssessment.risk_level == 'medium', 3),
                (RiskAssessment.risk_level == 'low', 4),
                else_=5
            )
        ).all()
        
        if risks:
            total_risks += len(risks)
            markdown += "### ⚠️ 风险评估\n\n"
            
            risk_type_names = {
                'hs_discrepancy': 'HS编码与货描不符',
                'weight_package_difference': '重量件数差异',
                'seal_chain_broken': '封签断链',
                'sample_overdue': '抽检超期',
                'high_risk_not_reviewed': '高风险货物未复核'
            }
            
            risk_level_icons = {
                'critical': '🔴 致命',
                'high': '🟠 高风险',
                'medium': '🟡 中风险',
                'low': '🟢 低风险'
            }
            
            for risk in risks:
                risk_type_name = risk_type_names.get(risk.risk_type, risk.risk_type)
                level_icon = risk_level_icons.get(risk.risk_level, risk.risk_level)
                
                markdown += f"#### {level_icon}: {risk_type_name}\n"
                markdown += f"- **风险描述**: {risk.risk_description}\n"
                markdown += f"- **检测时间**: {risk.detected_at.strftime('%Y-%m-%d %H:%M') if risk.detected_at else '-'}\n"
                markdown += f"- **复核状态**: {risk.review_status}\n"
                
                if risk.is_reviewed:
                    markdown += f"- **复核人**: {risk.reviewer_name or '-'}\n"
                    markdown += f"- **复核时间**: {risk.reviewed_at.strftime('%Y-%m-%d %H:%M') if risk.reviewed_at else '-'}\n"
                    if risk.review_notes:
                        markdown += f"- **复核备注**: {risk.review_notes}\n"
                
                markdown += "\n"
        
        reviews = ReviewRecord.query.filter_by(
            declaration_id=decl.id
        ).all()
        
        if reviews:
            total_reviews += len(reviews)
            markdown += "### 📝 复核记录\n\n"
            markdown += "| 复核类型 | 复核人 | 复核时间 | 复核状态 | 备注 |\n"
            markdown += "|----------|--------|----------|----------|------|\n"
            
            for review in reviews:
                markdown += f"| {review.review_type} | {review.reviewer_name} | {review.review_date.strftime('%Y-%m-%d %H:%M') if review.review_date else '-'} | {review.review_status} | {review.review_notes or '-'} |\n"
            
            markdown += "\n"
        
        markdown += "---\n\n"
    
    markdown += f"## 汇总统计\n\n"
    markdown += f"- **报关单总数**: {total_declarations}\n"
    markdown += f"- **风险总数**: {total_risks}\n"
    markdown += f"- **复核记录数**: {total_reviews}\n\n"
    
    markdown += "---\n\n"
    markdown += "*此清单由小口岸查验系统自动生成*\n"
    
    return markdown, None


def export_json_audit(declaration_no=None, reviewer_name=None):
    if declaration_no:
        declaration = CustomsDeclaration.query.filter_by(
            declaration_no=declaration_no
        ).first()
        
        if not declaration:
            return None, "Declaration not found"
        
        declarations = [declaration]
    else:
        declarations = CustomsDeclaration.query.order_by(
            CustomsDeclaration.created_at.desc()
        ).all()
    
    audit_package = {
        'audit_info': {
            'export_time': datetime.now().isoformat(),
            'reviewer_name': reviewer_name or '查验科',
            'system_version': '1.0.0'
        },
        'declarations': []
    }
    
    for decl in declarations:
        decl_data = {
            'id': decl.id,
            'declaration_no': decl.declaration_no,
            'vessel_name': decl.vessel_name,
            'voyage_no': decl.voyage_no,
            'port_of_departure': decl.port_of_departure,
            'port_of_arrival': decl.port_of_arrival,
            'arrival_date': decl.arrival_date.isoformat() if decl.arrival_date else None,
            'declaration_date': decl.declaration_date.isoformat() if decl.declaration_date else None,
            'consignee': decl.consignee,
            'consignor': decl.consignor,
            'total_weight': decl.total_weight,
            'total_packages': decl.total_packages,
            'total_containers': decl.total_containers,
            'status': decl.status,
            'notes': decl.notes,
            'created_at': decl.created_at.isoformat(),
            'updated_at': decl.updated_at.isoformat(),
            'items': [],
            'manifests': [],
            'seal_records': [],
            'xray_inspections': [],
            'lab_samples': [],
            'risk_assessments': [],
            'review_records': []
        }
        
        items = DeclarationItem.query.filter_by(
            declaration_id=decl.id
        ).all()
        
        for item in items:
            decl_data['items'].append({
                'id': item.id,
                'item_no': item.item_no,
                'hs_code': item.hs_code,
                'description': item.description,
                'description_en': item.description_en,
                'quantity': item.quantity,
                'unit': item.unit,
                'weight': item.weight,
                'weight_unit': item.weight_unit,
                'value': item.value,
                'currency': item.currency,
                'country_of_origin': item.country_of_origin,
                'destination_country': item.destination_country,
                'is_high_risk': item.is_high_risk,
                'risk_level': item.risk_level,
                'risk_reason': item.risk_reason
            })
        
        manifests = Manifest.query.filter_by(
            declaration_no=decl.declaration_no
        ).all()
        
        for manifest in manifests:
            manifest_items = ManifestItem.query.filter_by(
                manifest_id=manifest.id
            ).all()
            
            decl_data['manifests'].append({
                'id': manifest.id,
                'manifest_no': manifest.manifest_no,
                'vessel_name': manifest.vessel_name,
                'voyage_no': manifest.voyage_no,
                'port_of_departure': manifest.port_of_departure,
                'port_of_arrival': manifest.port_of_arrival,
                'arrival_date': manifest.arrival_date.isoformat() if manifest.arrival_date else None,
                'consignee': manifest.consignee,
                'consignor': manifest.consignor,
                'container_no': manifest.container_no,
                'container_type': manifest.container_type,
                'seal_no': manifest.seal_no,
                'seal_type': manifest.seal_type,
                'total_weight': manifest.total_weight,
                'total_packages': manifest.total_packages,
                'items': [{
                    'id': item.id,
                    'item_no': item.item_no,
                    'hs_code': item.hs_code,
                    'description': item.description,
                    'quantity': item.quantity,
                    'unit': item.unit,
                    'weight': item.weight
                } for item in manifest_items]
            })
        
        seals = SealRecord.query.filter_by(
            declaration_id=decl.id
        ).all()
        
        for seal in seals:
            decl_data['seal_records'].append({
                'id': seal.id,
                'container_no': seal.container_no,
                'seal_no': seal.seal_no,
                'seal_type': seal.seal_type,
                'seal_status': seal.seal_status,
                'install_date': seal.install_date.isoformat() if seal.install_date else None,
                'install_location': seal.install_location,
                'installed_by': seal.installed_by,
                'open_date': seal.open_date.isoformat() if seal.open_date else None,
                'open_location': seal.open_location,
                'opened_by': seal.opened_by,
                'open_reason': seal.open_reason,
                'reseal_date': seal.reseal_date.isoformat() if seal.reseal_date else None,
                'new_seal_no': seal.new_seal_no,
                'resealed_by': seal.resealed_by,
                'is_chain_broken': seal.is_chain_broken,
                'chain_break_reason': seal.chain_break_reason,
                'notes': seal.notes
            })
        
        xrays = XrayInspection.query.filter_by(
            declaration_id=decl.id
        ).all()
        
        for xray in xrays:
            decl_data['xray_inspections'].append({
                'id': xray.id,
                'inspection_no': xray.inspection_no,
                'container_no': xray.container_no,
                'inspection_date': xray.inspection_date.isoformat() if xray.inspection_date else None,
                'inspection_location': xray.inspection_location,
                'inspector_name': xray.inspector_name,
                'scan_result': xray.scan_result,
                'scan_images': xray.scan_images,
                'anomalies': xray.anomalies,
                'anomaly_type': xray.anomaly_type,
                'anomaly_severity': xray.anomaly_severity,
                'required_further_inspection': xray.required_further_inspection,
                'inspection_status': xray.inspection_status,
                'notes': xray.notes
            })
        
        lab_samples = LabSample.query.filter_by(
            declaration_id=decl.id
        ).all()
        
        for sample in lab_samples:
            decl_data['lab_samples'].append({
                'id': sample.id,
                'sample_no': sample.sample_no,
                'container_no': sample.container_no,
                'sample_date': sample.sample_date.isoformat() if sample.sample_date else None,
                'sample_location': sample.sample_location,
                'sampler_name': sample.sampler_name,
                'sample_type': sample.sample_type,
                'sample_description': sample.sample_description,
                'hs_code': sample.hs_code,
                'expected_test_items': sample.expected_test_items,
                'actual_test_items': sample.actual_test_items,
                'send_to_lab_date': sample.send_to_lab_date.isoformat() if sample.send_to_lab_date else None,
                'lab_receive_date': sample.lab_receive_date.isoformat() if sample.lab_receive_date else None,
                'report_date': sample.report_date.isoformat() if sample.report_date else None,
                'test_result': sample.test_result,
                'result_summary': sample.result_summary,
                'is_pass': sample.is_pass,
                'test_deadline': sample.test_deadline.isoformat() if sample.test_deadline else None,
                'is_overdue': sample.is_overdue,
                'notes': sample.notes
            })
        
        risks = RiskAssessment.query.filter_by(
            declaration_id=decl.id
        ).all()
        
        for risk in risks:
            decl_data['risk_assessments'].append({
                'id': risk.id,
                'item_id': risk.item_id,
                'risk_type': risk.risk_type,
                'risk_level': risk.risk_level,
                'risk_description': risk.risk_description,
                'detected_at': risk.detected_at.isoformat() if risk.detected_at else None,
                'related_data': risk.related_data,
                'is_reviewed': risk.is_reviewed,
                'reviewed_at': risk.reviewed_at.isoformat() if risk.reviewed_at else None,
                'reviewer_name': risk.reviewer_name,
                'review_status': risk.review_status,
                'review_notes': risk.review_notes
            })
        
        reviews = ReviewRecord.query.filter_by(
            declaration_id=decl.id
        ).all()
        
        for review in reviews:
            decl_data['review_records'].append({
                'id': review.id,
                'risk_id': review.risk_id,
                'review_type': review.review_type,
                'reviewer_name': review.reviewer_name,
                'review_date': review.review_date.isoformat() if review.review_date else None,
                'review_status': review.review_status,
                'review_notes': review.review_notes,
                'related_item_no': review.related_item_no,
                'related_container_no': review.related_container_no
            })
        
        audit_package['declarations'].append(decl_data)
    
    return json.dumps(audit_package, ensure_ascii=False, indent=2), None


@export_bp.route('/markdown', methods=['GET'])
def export_markdown():
    try:
        declaration_no = request.args.get('declaration_no')
        reviewer_name = request.args.get('reviewer_name', '查验科')
        
        markdown_content, error = export_markdown_checklist(
            declaration_no=declaration_no,
            reviewer_name=reviewer_name
        )
        
        if error:
            return jsonify({'error': error}), 404
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"inspection_checklist_{timestamp}.md"
        
        response = make_response(markdown_content)
        response.headers['Content-Type'] = 'text/markdown; charset=utf-8'
        response.headers['Content-Disposition'] = f'attachment; filename={filename}'
        
        return response
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@export_bp.route('/markdown/preview', methods=['GET'])
def preview_markdown():
    try:
        declaration_no = request.args.get('declaration_no')
        reviewer_name = request.args.get('reviewer_name', '查验科')
        
        markdown_content, error = export_markdown_checklist(
            declaration_no=declaration_no,
            reviewer_name=reviewer_name
        )
        
        if error:
            return jsonify({'error': error}), 404
        
        return jsonify({
            'content': markdown_content,
            'declaration_no': declaration_no,
            'reviewer_name': reviewer_name,
            'generated_at': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@export_bp.route('/json', methods=['GET'])
def export_json():
    try:
        declaration_no = request.args.get('declaration_no')
        reviewer_name = request.args.get('reviewer_name', '查验科')
        
        json_content, error = export_json_audit(
            declaration_no=declaration_no,
            reviewer_name=reviewer_name
        )
        
        if error:
            return jsonify({'error': error}), 404
        
        return jsonify(json.loads(json_content))
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@export_bp.route('/json/download', methods=['GET'])
def download_json():
    try:
        declaration_no = request.args.get('declaration_no')
        reviewer_name = request.args.get('reviewer_name', '查验科')
        
        json_content, error = export_json_audit(
            declaration_no=declaration_no,
            reviewer_name=reviewer_name
        )
        
        if error:
            return jsonify({'error': error}), 404
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"audit_package_{timestamp}.json"
        
        response = make_response(json_content)
        response.headers['Content-Type'] = 'application/json; charset=utf-8'
        response.headers['Content-Disposition'] = f'attachment; filename={filename}'
        
        return response
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@export_bp.route('/summary', methods=['GET'])
def get_export_summary():
    try:
        total_declarations = CustomsDeclaration.query.count()
        total_risks = RiskAssessment.query.count()
        total_reviews = ReviewRecord.query.count()
        
        pending_risks = RiskAssessment.query.filter_by(
            review_status='pending'
        ).count()
        
        reviewed_risks = RiskAssessment.query.filter(
            RiskAssessment.review_status != 'pending'
        ).count()
        
        return jsonify({
            'export_summary': {
                'total_declarations': total_declarations,
                'total_risks': total_risks,
                'total_reviews': total_reviews,
                'pending_risks': pending_risks,
                'reviewed_risks': reviewed_risks
            },
            'available_exports': [
                {
                    'type': 'markdown',
                    'name': 'Markdown查验清单',
                    'description': '导出完整的查验清单，包含所有报关单、商品信息、风险评估和复核记录',
                    'endpoint': '/api/export/markdown',
                    'parameters': ['declaration_no (可选)', 'reviewer_name (可选)']
                },
                {
                    'type': 'markdown_preview',
                    'name': 'Markdown预览',
                    'description': '预览Markdown内容而不下载文件',
                    'endpoint': '/api/export/markdown/preview',
                    'parameters': ['declaration_no (可选)', 'reviewer_name (可选)']
                },
                {
                    'type': 'json',
                    'name': 'JSON审计包',
                    'description': '导出完整的JSON格式审计数据，包含所有相关信息',
                    'endpoint': '/api/export/json',
                    'parameters': ['declaration_no (可选)', 'reviewer_name (可选)']
                },
                {
                    'type': 'json_download',
                    'name': 'JSON审计文件下载',
                    'description': '下载JSON格式的审计包文件',
                    'endpoint': '/api/export/json/download',
                    'parameters': ['declaration_no (可选)', 'reviewer_name (可选)']
                }
            ]
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
