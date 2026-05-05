from flask import Blueprint, request, jsonify
from extensions import db
from models.models import (
    CustomsDeclaration,
    DeclarationItem,
    Manifest,
    SealRecord,
    XrayInspection,
    LabSample,
    RiskAssessment
)

query_bp = Blueprint('query', __name__)


@query_bp.route('/declarations', methods=['GET'])
def get_declarations():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        
        query = CustomsDeclaration.query
        
        if status:
            query = query.filter_by(status=status)
        
        pagination = query.order_by(CustomsDeclaration.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        declarations = []
        for decl in pagination.items:
            declarations.append({
                'id': decl.id,
                'declaration_no': decl.declaration_no,
                'vessel_name': decl.vessel_name,
                'voyage_no': decl.voyage_no,
                'port_of_arrival': decl.port_of_arrival,
                'arrival_date': decl.arrival_date.isoformat() if decl.arrival_date else None,
                'consignee': decl.consignee,
                'total_weight': decl.total_weight,
                'total_packages': decl.total_packages,
                'status': decl.status,
                'created_at': decl.created_at.isoformat()
            })
        
        return jsonify({
            'declarations': declarations,
            'total': pagination.total,
            'page': page,
            'per_page': per_page,
            'pages': pagination.pages
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@query_bp.route('/declaration/<declaration_no>', methods=['GET'])
def get_declaration_detail(declaration_no):
    try:
        declaration = CustomsDeclaration.query.filter_by(
            declaration_no=declaration_no
        ).first()
        
        if not declaration:
            return jsonify({'error': 'Declaration not found'}), 404
        
        items = DeclarationItem.query.filter_by(
            declaration_id=declaration.id
        ).all()
        
        items_list = []
        for item in items:
            items_list.append({
                'id': item.id,
                'item_no': item.item_no,
                'hs_code': item.hs_code,
                'description': item.description,
                'quantity': item.quantity,
                'unit': item.unit,
                'weight': item.weight,
                'value': item.value,
                'is_high_risk': item.is_high_risk,
                'risk_level': item.risk_level
            })
        
        manifests = Manifest.query.filter_by(
            declaration_no=declaration_no
        ).all()
        
        manifests_list = []
        for manifest in manifests:
            manifests_list.append({
                'id': manifest.id,
                'manifest_no': manifest.manifest_no,
                'container_no': manifest.container_no,
                'seal_no': manifest.seal_no,
                'total_weight': manifest.total_weight,
                'total_packages': manifest.total_packages
            })
        
        seals = SealRecord.query.filter_by(
            declaration_id=declaration.id
        ).all()
        
        seals_list = []
        for seal in seals:
            seals_list.append({
                'id': seal.id,
                'container_no': seal.container_no,
                'seal_no': seal.seal_no,
                'seal_status': seal.seal_status,
                'is_chain_broken': seal.is_chain_broken,
                'chain_break_reason': seal.chain_break_reason
            })
        
        xrays = XrayInspection.query.filter_by(
            declaration_id=declaration.id
        ).all()
        
        xrays_list = []
        for xray in xrays:
            xrays_list.append({
                'id': xray.id,
                'inspection_no': xray.inspection_no,
                'container_no': xray.container_no,
                'inspection_date': xray.inspection_date.isoformat() if xray.inspection_date else None,
                'anomalies': xray.anomalies,
                'anomaly_severity': xray.anomaly_severity,
                'required_further_inspection': xray.required_further_inspection
            })
        
        lab_samples = LabSample.query.filter_by(
            declaration_id=declaration.id
        ).all()
        
        lab_samples_list = []
        for sample in lab_samples:
            lab_samples_list.append({
                'id': sample.id,
                'sample_no': sample.sample_no,
                'container_no': sample.container_no,
                'sample_type': sample.sample_type,
                'hs_code': sample.hs_code,
                'test_deadline': sample.test_deadline.isoformat() if sample.test_deadline else None,
                'is_overdue': sample.is_overdue,
                'is_pass': sample.is_pass
            })
        
        risks = RiskAssessment.query.filter_by(
            declaration_id=declaration.id
        ).all()
        
        risks_list = []
        for risk in risks:
            risks_list.append({
                'id': risk.id,
                'risk_type': risk.risk_type,
                'risk_level': risk.risk_level,
                'risk_description': risk.risk_description,
                'is_reviewed': risk.is_reviewed,
                'review_status': risk.review_status,
                'review_notes': risk.review_notes
            })
        
        return jsonify({
            'declaration': {
                'id': declaration.id,
                'declaration_no': declaration.declaration_no,
                'vessel_name': declaration.vessel_name,
                'voyage_no': declaration.voyage_no,
                'port_of_departure': declaration.port_of_departure,
                'port_of_arrival': declaration.port_of_arrival,
                'arrival_date': declaration.arrival_date.isoformat() if declaration.arrival_date else None,
                'declaration_date': declaration.declaration_date.isoformat() if declaration.declaration_date else None,
                'consignee': declaration.consignee,
                'consignor': declaration.consignor,
                'total_weight': declaration.total_weight,
                'total_packages': declaration.total_packages,
                'total_containers': declaration.total_containers,
                'status': declaration.status,
                'notes': declaration.notes
            },
            'items': items_list,
            'manifests': manifests_list,
            'seals': seals_list,
            'xray_inspections': xrays_list,
            'lab_samples': lab_samples_list,
            'risks': risks_list
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@query_bp.route('/declaration/<declaration_no>/issues', methods=['GET'])
def get_declaration_issues(declaration_no):
    try:
        declaration = CustomsDeclaration.query.filter_by(
            declaration_no=declaration_no
        ).first()
        
        if not declaration:
            return jsonify({'error': 'Declaration not found'}), 404
        
        risks = RiskAssessment.query.filter_by(
            declaration_id=declaration.id
        ).order_by(
            db.case(
                (RiskAssessment.risk_level == 'critical', 1),
                (RiskAssessment.risk_level == 'high', 2),
                (RiskAssessment.risk_level == 'medium', 3),
                (RiskAssessment.risk_level == 'low', 4),
                else_=5
            )
        ).all()
        
        issues_by_type = {
            'hs_discrepancy': [],
            'weight_package_difference': [],
            'seal_chain_broken': [],
            'sample_overdue': [],
            'high_risk_not_reviewed': []
        }
        
        for risk in risks:
            risk_data = {
                'id': risk.id,
                'risk_type': risk.risk_type,
                'risk_level': risk.risk_level,
                'risk_description': risk.risk_description,
                'is_reviewed': risk.is_reviewed,
                'review_status': risk.review_status,
                'review_notes': risk.review_notes,
                'item_id': risk.item_id
            }
            
            if risk.risk_type in issues_by_type:
                issues_by_type[risk.risk_type].append(risk_data)
        
        summary = {
            'total_issues': len(risks),
            'by_type': {
                'hs_discrepancy': len(issues_by_type['hs_discrepancy']),
                'weight_package_difference': len(issues_by_type['weight_package_difference']),
                'seal_chain_broken': len(issues_by_type['seal_chain_broken']),
                'sample_overdue': len(issues_by_type['sample_overdue']),
                'high_risk_not_reviewed': len(issues_by_type['high_risk_not_reviewed'])
            },
            'by_severity': {
                'critical': len([r for r in risks if r.risk_level == 'critical']),
                'high': len([r for r in risks if r.risk_level == 'high']),
                'medium': len([r for r in risks if r.risk_level == 'medium']),
                'low': len([r for r in risks if r.risk_level == 'low'])
            },
            'review_status': {
                'pending': len([r for r in risks if r.review_status == 'pending']),
                'reviewed': len([r for r in risks if r.review_status == 'reviewed']),
                'approved': len([r for r in risks if r.review_status == 'approved']),
                'rejected': len([r for r in risks if r.review_status == 'rejected'])
            }
        }
        
        return jsonify({
            'declaration_no': declaration_no,
            'summary': summary,
            'issues': issues_by_type
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@query_bp.route('/items/<item_id>', methods=['GET'])
def get_item_detail(item_id):
    try:
        item = DeclarationItem.query.get(item_id)
        
        if not item:
            return jsonify({'error': 'Item not found'}), 404
        
        declaration = CustomsDeclaration.query.get(item.declaration_id)
        
        return jsonify({
            'item': {
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
            },
            'declaration': {
                'id': declaration.id,
                'declaration_no': declaration.declaration_no,
                'status': declaration.status
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
