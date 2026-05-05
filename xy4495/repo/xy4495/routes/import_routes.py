from flask import Blueprint, request, jsonify
from extensions import db
from models.models import (
    CustomsDeclaration,
    DeclarationItem,
    Manifest,
    ManifestItem,
    SealRecord,
    XrayInspection,
    LabSample
)
from datetime import datetime
import json

import_bp = Blueprint('import', __name__)


def evaluate_all_risks(declaration_id):
    from models.models import RiskAssessment, DeclarationItem, Manifest, SealRecord, LabSample
    
    existing_risks = RiskAssessment.query.filter_by(
        declaration_id=declaration_id
    ).all()
    for risk in existing_risks:
        db.session.delete(risk)
    db.session.commit()
    
    declaration = CustomsDeclaration.query.get(declaration_id)
    if not declaration:
        return
    
    items = DeclarationItem.query.filter_by(
        declaration_id=declaration_id
    ).all()
    
    manifests = Manifest.query.filter_by(
        declaration_no=declaration.declaration_no
    ).all()
    
    for item in items:
        hs_code = item.hs_code
        description = item.description
        
        if not hs_code or not description:
            continue
        
        hs_category = hs_code[:4] if len(hs_code) >= 4 else hs_code
        
        high_risk_hs_map = {
            '8525': '摄影设备',
            '8517': '通信设备',
            '8471': '计算机设备',
            '9006': '摄影器材',
            '3004': '药品',
            '3304': '化妆品',
            '2009': '果汁饮料',
            '2208': '酒类',
            '7108': '黄金',
            '7106': '白银',
            '0804': '水果',
            '0201': '肉类',
            '0302': '海鲜'
        }
        
        category_name = high_risk_hs_map.get(hs_category)
        if category_name:
            if category_name not in description and \
               category_name not in (item.description_en or ''):
                discrepancy_reason = f"HS编码{hs_code}归类为{category_name}，但货描'{description}'中未提及该类商品名称"
                risk = RiskAssessment(
                    declaration_id=declaration_id,
                    item_id=item.id,
                    risk_type='hs_discrepancy',
                    risk_level='high',
                    risk_description=f"HS编码与货描不符风险：{discrepancy_reason}",
                    related_data=json.dumps({
                        'hs_code': hs_code,
                        'description': description,
                        'item_no': item.item_no,
                        'hs_category': hs_category
                    }, ensure_ascii=False)
                )
                db.session.add(risk)
    
    total_decl_weight = sum(item.weight or 0 for item in items)
    total_decl_packages = sum(item.quantity or 0 for item in items)
    
    total_manifest_weight = sum(manifest.total_weight or 0 for manifest in manifests)
    total_manifest_packages = sum(manifest.total_packages or 0 for manifest in manifests)
    
    if total_decl_weight > 0 and total_manifest_weight > 0:
        weight_diff = abs(total_decl_weight - total_manifest_weight)
        weight_diff_ratio = weight_diff / max(total_decl_weight, total_manifest_weight)
        
        if weight_diff_ratio > 0.05:
            risk_level = 'high' if weight_diff_ratio > 0.1 else 'medium'
            risk = RiskAssessment(
                declaration_id=declaration_id,
                risk_type='weight_package_difference',
                risk_level=risk_level,
                risk_description=f"重量差异风险：报关单总重量{total_decl_weight}kg vs 舱单总重量{total_manifest_weight}kg，差异{(weight_diff_ratio*100):.1f}%",
                related_data=json.dumps({
                    'declaration_weight': total_decl_weight,
                    'manifest_weight': total_manifest_weight,
                    'difference': weight_diff,
                    'difference_ratio': weight_diff_ratio
                }, ensure_ascii=False)
            )
            db.session.add(risk)
    
    if total_decl_packages > 0 and total_manifest_packages > 0:
        package_diff = abs(total_decl_packages - total_manifest_packages)
        package_diff_ratio = package_diff / max(total_decl_packages, total_manifest_packages)
        
        if package_diff_ratio > 0.05:
            risk_level = 'high' if package_diff_ratio > 0.1 else 'medium'
            risk = RiskAssessment(
                declaration_id=declaration_id,
                risk_type='weight_package_difference',
                risk_level=risk_level,
                risk_description=f"件数差异风险：报关单总件数{total_decl_packages}件 vs 舱单总件数{total_manifest_packages}件，差异{(package_diff_ratio*100):.1f}%",
                related_data=json.dumps({
                    'declaration_packages': total_decl_packages,
                    'manifest_packages': total_manifest_packages,
                    'difference': package_diff,
                    'difference_ratio': package_diff_ratio
                }, ensure_ascii=False)
            )
            db.session.add(risk)
    
    seals = SealRecord.query.filter_by(
        declaration_id=declaration_id
    ).all()
    
    for seal in seals:
        if seal.is_chain_broken:
            risk = RiskAssessment(
                declaration_id=declaration_id,
                risk_type='seal_chain_broken',
                risk_level='critical',
                risk_description=f"封签断链风险：集装箱{seal.container_no}的封签{seal.seal_no}出现断链，断链原因：{seal.chain_break_reason or '未知'}",
                related_data=json.dumps({
                    'container_no': seal.container_no,
                    'seal_no': seal.seal_no,
                    'seal_status': seal.seal_status,
                    'is_chain_broken': seal.is_chain_broken,
                    'chain_break_reason': seal.chain_break_reason
                }, ensure_ascii=False)
            )
            db.session.add(risk)
        
        elif seal.seal_status == 'opened' and not seal.reseal_date:
            risk = RiskAssessment(
                declaration_id=declaration_id,
                risk_type='seal_chain_broken',
                risk_level='high',
                risk_description=f"封签状态异常：集装箱{seal.container_no}的封签{seal.seal_no}已开启但未重新施封",
                related_data=json.dumps({
                    'container_no': seal.container_no,
                    'seal_no': seal.seal_no,
                    'seal_status': seal.seal_status,
                    'open_date': seal.open_date.isoformat() if seal.open_date else None,
                    'open_reason': seal.open_reason
                }, ensure_ascii=False)
            )
            db.session.add(risk)
    
    lab_samples = LabSample.query.filter_by(
        declaration_id=declaration_id
    ).all()
    
    now = datetime.utcnow()
    
    for sample in lab_samples:
        if sample.test_deadline and not sample.report_date:
            days_overdue = (now - sample.test_deadline).days
            if days_overdue > 0:
                risk_level = 'critical' if days_overdue > 7 else 'high' if days_overdue > 3 else 'medium'
                risk = RiskAssessment(
                    declaration_id=declaration_id,
                    risk_type='sample_overdue',
                    risk_level=risk_level,
                    risk_description=f"实验室抽检超期风险：样品{sample.sample_no}检测超期{days_overdue}天，检测截止日期{sample.test_deadline.strftime('%Y-%m-%d')}",
                    related_data=json.dumps({
                        'sample_no': sample.sample_no,
                        'container_no': sample.container_no,
                        'sample_type': sample.sample_type,
                        'hs_code': sample.hs_code,
                        'test_deadline': sample.test_deadline.isoformat() if sample.test_deadline else None,
                        'days_overdue': days_overdue
                    }, ensure_ascii=False)
                )
                db.session.add(risk)
                sample.is_overdue = True
        
        elif sample.test_deadline and sample.report_date:
            days_late = (sample.report_date - sample.test_deadline).days
            if days_late > 0:
                risk_level = 'medium' if days_late > 7 else 'low'
                risk = RiskAssessment(
                    declaration_id=declaration_id,
                    risk_type='sample_overdue',
                    risk_level=risk_level,
                    risk_description=f"实验室抽检报告延迟：样品{sample.sample_no}报告延迟{days_late}天出具",
                    related_data=json.dumps({
                        'sample_no': sample.sample_no,
                        'test_deadline': sample.test_deadline.isoformat() if sample.test_deadline else None,
                        'report_date': sample.report_date.isoformat() if sample.report_date else None,
                        'days_late': days_late,
                        'is_pass': sample.is_pass
                    }, ensure_ascii=False)
                )
                db.session.add(risk)
    
    for item in items:
        if item.is_high_risk:
            related_risks = RiskAssessment.query.filter(
                RiskAssessment.declaration_id == declaration_id,
                RiskAssessment.item_id == item.id,
                RiskAssessment.risk_type != 'high_risk_not_reviewed'
            ).all()
            
            all_reviewed = all(r.is_reviewed for r in related_risks) if related_risks else False
            
            if not all_reviewed:
                risk = RiskAssessment(
                    declaration_id=declaration_id,
                    item_id=item.id,
                    risk_type='high_risk_not_reviewed',
                    risk_level='high',
                    risk_description=f"高风险货物未复核：商品{item.item_no} - {item.description} (HS:{item.hs_code})被标记为高风险，但尚未完成复核",
                    related_data=json.dumps({
                        'item_no': item.item_no,
                        'hs_code': item.hs_code,
                        'description': item.description,
                        'risk_level': item.risk_level,
                        'risk_reason': item.risk_reason,
                        'total_related_risks': len(related_risks),
                        'reviewed_count': sum(1 for r in related_risks if r.is_reviewed)
                    }, ensure_ascii=False)
                )
                db.session.add(risk)
    
    db.session.commit()


@import_bp.route('/declaration', methods=['POST'])
def import_declaration():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        declaration = CustomsDeclaration(
            declaration_no=data.get('declaration_no'),
            vessel_name=data.get('vessel_name'),
            voyage_no=data.get('voyage_no'),
            port_of_departure=data.get('port_of_departure'),
            port_of_arrival=data.get('port_of_arrival'),
            arrival_date=datetime.fromisoformat(data['arrival_date']) if data.get('arrival_date') else None,
            declaration_date=datetime.fromisoformat(data['declaration_date']) if data.get('declaration_date') else None,
            consignee=data.get('consignee'),
            consignor=data.get('consignor'),
            total_weight=data.get('total_weight'),
            total_packages=data.get('total_packages'),
            total_containers=data.get('total_containers'),
            status=data.get('status', 'pending'),
            notes=data.get('notes')
        )
        db.session.add(declaration)
        db.session.flush()
        
        items_data = data.get('items', [])
        for item_data in items_data:
            item = DeclarationItem(
                declaration_id=declaration.id,
                item_no=item_data.get('item_no'),
                hs_code=item_data.get('hs_code'),
                description=item_data.get('description'),
                description_en=item_data.get('description_en'),
                quantity=item_data.get('quantity'),
                unit=item_data.get('unit', '件'),
                weight=item_data.get('weight'),
                weight_unit=item_data.get('weight_unit', 'kg'),
                value=item_data.get('value'),
                currency=item_data.get('currency', 'USD'),
                country_of_origin=item_data.get('country_of_origin'),
                destination_country=item_data.get('destination_country'),
                is_high_risk=item_data.get('is_high_risk', False),
                risk_level=item_data.get('risk_level', 'normal'),
                risk_reason=item_data.get('risk_reason')
            )
            db.session.add(item)
        
        db.session.commit()
        
        evaluate_all_risks(declaration.id)
        
        return jsonify({
            'message': 'Declaration imported successfully',
            'declaration_id': declaration.id,
            'declaration_no': declaration.declaration_no
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@import_bp.route('/manifest', methods=['POST'])
def import_manifest():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        manifest = Manifest(
            manifest_no=data.get('manifest_no'),
            declaration_no=data.get('declaration_no'),
            vessel_name=data.get('vessel_name'),
            voyage_no=data.get('voyage_no'),
            port_of_departure=data.get('port_of_departure'),
            port_of_arrival=data.get('port_of_arrival'),
            arrival_date=datetime.fromisoformat(data['arrival_date']) if data.get('arrival_date') else None,
            consignee=data.get('consignee'),
            consignor=data.get('consignor'),
            container_no=data.get('container_no'),
            container_type=data.get('container_type'),
            seal_no=data.get('seal_no'),
            seal_type=data.get('seal_type'),
            total_weight=data.get('total_weight'),
            total_packages=data.get('total_packages')
        )
        db.session.add(manifest)
        db.session.flush()
        
        items_data = data.get('items', [])
        for item_data in items_data:
            item = ManifestItem(
                manifest_id=manifest.id,
                item_no=item_data.get('item_no'),
                hs_code=item_data.get('hs_code'),
                description=item_data.get('description'),
                quantity=item_data.get('quantity'),
                unit=item_data.get('unit'),
                weight=item_data.get('weight'),
                weight_unit=item_data.get('weight_unit', 'kg'),
                marks_and_numbers=item_data.get('marks_and_numbers')
            )
            db.session.add(item)
        
        db.session.commit()
        
        if data.get('declaration_no'):
            declaration = CustomsDeclaration.query.filter_by(
                declaration_no=data.get('declaration_no')
            ).first()
            if declaration:
                evaluate_all_risks(declaration.id)
        
        return jsonify({
            'message': 'Manifest imported successfully',
            'manifest_id': manifest.id,
            'manifest_no': manifest.manifest_no
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@import_bp.route('/seal', methods=['POST'])
def import_seal():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        declaration = None
        if data.get('declaration_no'):
            declaration = CustomsDeclaration.query.filter_by(
                declaration_no=data.get('declaration_no')
            ).first()
        
        seal = SealRecord(
            declaration_id=declaration.id if declaration else None,
            container_no=data.get('container_no'),
            seal_no=data.get('seal_no'),
            seal_type=data.get('seal_type'),
            seal_status=data.get('seal_status', 'intact'),
            install_date=datetime.fromisoformat(data['install_date']) if data.get('install_date') else None,
            install_location=data.get('install_location'),
            installed_by=data.get('installed_by'),
            open_date=datetime.fromisoformat(data['open_date']) if data.get('open_date') else None,
            open_location=data.get('open_location'),
            opened_by=data.get('opened_by'),
            open_reason=data.get('open_reason'),
            reseal_date=datetime.fromisoformat(data['reseal_date']) if data.get('reseal_date') else None,
            new_seal_no=data.get('new_seal_no'),
            resealed_by=data.get('resealed_by'),
            is_chain_broken=data.get('is_chain_broken', False),
            chain_break_reason=data.get('chain_break_reason'),
            notes=data.get('notes')
        )
        db.session.add(seal)
        db.session.commit()
        
        if declaration:
            evaluate_all_risks(declaration.id)
        
        return jsonify({
            'message': 'Seal record imported successfully',
            'seal_id': seal.id
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@import_bp.route('/xray', methods=['POST'])
def import_xray():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        declaration = None
        if data.get('declaration_no'):
            declaration = CustomsDeclaration.query.filter_by(
                declaration_no=data.get('declaration_no')
            ).first()
        
        xray = XrayInspection(
            declaration_id=declaration.id if declaration else None,
            inspection_no=data.get('inspection_no'),
            container_no=data.get('container_no'),
            inspection_date=datetime.fromisoformat(data['inspection_date']) if data.get('inspection_date') else datetime.utcnow(),
            inspection_location=data.get('inspection_location'),
            inspector_name=data.get('inspector_name'),
            scan_result=data.get('scan_result'),
            scan_images=data.get('scan_images'),
            anomalies=data.get('anomalies'),
            anomaly_type=data.get('anomaly_type'),
            anomaly_severity=data.get('anomaly_severity', 'low'),
            required_further_inspection=data.get('required_further_inspection', False),
            inspection_status=data.get('inspection_status', 'completed'),
            notes=data.get('notes')
        )
        db.session.add(xray)
        db.session.commit()
        
        return jsonify({
            'message': 'X-ray inspection imported successfully',
            'xray_id': xray.id
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@import_bp.route('/lab-sample', methods=['POST'])
def import_lab_sample():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        declaration = None
        if data.get('declaration_no'):
            declaration = CustomsDeclaration.query.filter_by(
                declaration_no=data.get('declaration_no')
            ).first()
        
        lab_sample = LabSample(
            declaration_id=declaration.id if declaration else None,
            sample_no=data.get('sample_no'),
            container_no=data.get('container_no'),
            sample_date=datetime.fromisoformat(data['sample_date']) if data.get('sample_date') else datetime.utcnow(),
            sample_location=data.get('sample_location'),
            sampler_name=data.get('sampler_name'),
            sample_type=data.get('sample_type'),
            sample_description=data.get('sample_description'),
            hs_code=data.get('hs_code'),
            expected_test_items=data.get('expected_test_items'),
            actual_test_items=data.get('actual_test_items'),
            send_to_lab_date=datetime.fromisoformat(data['send_to_lab_date']) if data.get('send_to_lab_date') else None,
            lab_receive_date=datetime.fromisoformat(data['lab_receive_date']) if data.get('lab_receive_date') else None,
            report_date=datetime.fromisoformat(data['report_date']) if data.get('report_date') else None,
            test_result=data.get('test_result'),
            result_summary=data.get('result_summary'),
            is_pass=data.get('is_pass'),
            test_deadline=datetime.fromisoformat(data['test_deadline']) if data.get('test_deadline') else None,
            is_overdue=data.get('is_overdue', False),
            notes=data.get('notes')
        )
        db.session.add(lab_sample)
        db.session.commit()
        
        if declaration:
            evaluate_all_risks(declaration.id)
        
        return jsonify({
            'message': 'Lab sample imported successfully',
            'sample_id': lab_sample.id
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
