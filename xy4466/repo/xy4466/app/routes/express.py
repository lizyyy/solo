from flask import request, jsonify
from app.routes import api
from app import db
from app.models import ExpressPickup, Case
from datetime import datetime
import json
from app.utils.risk_calculator import calculate_case_risk

@api.route('/express', methods=['GET'])
def get_express_pickups():
    """获取快递取件列表"""
    pickups = ExpressPickup.query.order_by(ExpressPickup.pickup_time.desc()).all()
    return jsonify([pickup.to_dict() for pickup in pickups])

@api.route('/express/<int:pickup_id>', methods=['GET'])
def get_express_pickup(pickup_id):
    """获取单个快递取件详情"""
    pickup = ExpressPickup.query.get_or_404(pickup_id)
    return jsonify(pickup.to_dict())

@api.route('/express/import', methods=['POST'])
def import_express_pickups():
    """导入快递取件表"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        # 支持单个取件或取件数组
        if isinstance(data, dict):
            pickups_data = [data]
        elif isinstance(data, list):
            pickups_data = data
        else:
            return jsonify({'error': 'Invalid JSON format'}), 400
        
        imported_count = 0
        updated_count = 0
        errors = []
        
        for pickup_data in pickups_data:
            try:
                # 检查必要字段
                required_fields = ['pickup_number', 'pickup_time']
                missing_fields = [field for field in required_fields if field not in pickup_data]
                if missing_fields:
                    errors.append(f"Missing fields: {', '.join(missing_fields)}")
                    continue
                
                # 检查取件是否已存在
                existing_pickup = ExpressPickup.query.filter_by(pickup_number=pickup_data['pickup_number']).first()
                
                # 解析日期
                pickup_time = datetime.strptime(pickup_data['pickup_time'], '%Y-%m-%dT%H:%M:%S')
                
                if existing_pickup:
                    # 更新现有取件
                    existing_pickup.express_company = pickup_data.get('express_company', existing_pickup.express_company)
                    existing_pickup.pickup_time = pickup_time
                    existing_pickup.total_packages = pickup_data.get('total_packages', existing_pickup.total_packages)
                    existing_pickup.driver_name = pickup_data.get('driver_name', existing_pickup.driver_name)
                    existing_pickup.notes = pickup_data.get('notes', existing_pickup.notes)
                    updated_count += 1
                else:
                    # 创建新取件
                    new_pickup = ExpressPickup(
                        pickup_number=pickup_data['pickup_number'],
                        express_company=pickup_data.get('express_company'),
                        pickup_time=pickup_time,
                        total_packages=pickup_data.get('total_packages', 0),
                        driver_name=pickup_data.get('driver_name'),
                        notes=pickup_data.get('notes')
                    )
                    db.session.add(new_pickup)
                    imported_count += 1
                
                # 关联病例并更新快递信息
                if 'cases' in pickup_data:
                    for case_info in pickup_data['cases']:
                        case_number = case_info.get('case_number')
                        if case_number:
                            case = Case.query.filter_by(case_number=case_number).first()
                            if case:
                                case.express_tracking = case_info.get('tracking_number', case.express_tracking)
                                case.express_company = pickup_data.get('express_company', case.express_company)
                                case.pickup_time = pickup_time
                                calculate_case_risk(case)
                
            except Exception as e:
                errors.append(f"Error processing pickup {pickup_data.get('pickup_number', 'unknown')}: {str(e)}")
        
        db.session.commit()
        
        return jsonify({
            'message': 'Import completed',
            'imported_count': imported_count,
            'updated_count': updated_count,
            'errors': errors
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
