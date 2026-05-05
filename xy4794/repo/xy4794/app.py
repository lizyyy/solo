from flask import Flask, request, jsonify
from models import db
from config import Config
from services import (
    DataImportService, RiskQueryService, CustomerDetailService, FollowUpService
)
import session_tracker

app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)

with app.app_context():
    db.create_all()


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': 'SaaS Renewal Risk API is running'})


@app.route('/api/import', methods=['POST'])
def import_data():
    """
    导入样例数据
    请求体格式：
    {
        "name": "租户名称",
        "contacts": [
            {
                "import_key": "contact_1",
                "name": "张三",
                "email": "zhangsan@example.com",
                "phone": "13800138000",
                "role": "CEO"
            }
        ],
        "contracts": [
            {
                "import_key": "contract_1",
                "contact_import_key": "contact_1",
                "contract_number": "CN-2024-001",
                "start_date": "2024-01-01",
                "end_date": "2024-12-31",
                "value": 50000.00,
                "status": "active"
            }
        ],
        "usage_snapshots": [
            {
                "contract_import_key": "contract_1",
                "snapshot_date": "2024-11-01",
                "active_users": 45,
                "api_calls": 15000,
                "storage_usage": 120.5,
                "feature_usage": {"dashboard": 30, "reports": 20}
            }
        ]
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': '请求体不能为空'}), 400

        result = DataImportService.import_sample_data(data)
        return jsonify({
            'success': True,
            'message': '数据导入成功',
            'data': result
        }), 201

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        app.logger.error(f'导入数据失败: {str(e)}')
        return jsonify({'error': '服务器内部错误'}), 500


@app.route('/api/tenants/<int:tenant_id>/risks', methods=['GET'])
def get_risk_list(tenant_id):
    """
    按租户查询风险列表
    查询参数：
    - risk_level: 风险等级筛选 (low/medium/high/critical/expiring/expired)
    - page: 页码，默认 1
    - page_size: 每页数量，默认 20
    
    返回包含 SQL 执行统计和优化解释
    """
    try:
        risk_level = request.args.get('risk_level')
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 20))

        page = max(1, page)
        page_size = min(100, max(1, page_size))

        result = RiskQueryService.get_risk_list(
            tenant_id=tenant_id,
            risk_level=risk_level,
            page=page,
            page_size=page_size
        )

        return jsonify({
            'success': True,
            'data': result['data'],
            'pagination': result['pagination'],
            'sql_stats': result['sql_stats']
        })

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        app.logger.error(f'查询风险列表失败: {str(e)}')
        return jsonify({'error': '服务器内部错误'}), 500


@app.route('/api/tenants/<int:tenant_id>/contacts/<int:contact_id>', methods=['GET'])
def get_customer_detail(tenant_id, contact_id):
    """
    获取客户详情
    返回：联系人信息、合同列表、最新风险评估、使用量趋势、最近跟进记录
    """
    try:
        result = CustomerDetailService.get_customer_detail(
            tenant_id=tenant_id,
            contact_id=contact_id
        )

        if not result:
            return jsonify({'error': '客户不存在'}), 404

        return jsonify({
            'success': True,
            'data': result
        })

    except Exception as e:
        app.logger.error(f'查询客户详情失败: {str(e)}')
        return jsonify({'error': '服务器内部错误'}), 500


@app.route('/api/tenants/<int:tenant_id>/contacts/<int:contact_id>/follow-ups', methods=['POST'])
def create_follow_up(tenant_id, contact_id):
    """
    创建跟进记录（带事务和审计日志）
    请求体格式：
    {
        "channel": "phone",
        "content": "与客户沟通了续费事宜，客户表示需要考虑",
        "operator": "销售小王",
        "follow_up_date": "2024-11-15 14:30:00",
        "next_follow_up_at": "2024-11-20 10:00:00",
        "risk_level": "medium"
    }
    
    事务保证：跟进记录和审计日志必须同时成功，否则全部回滚
    """
    try:
        data = request.get_json()
        if not data or not data.get('content'):
            return jsonify({'error': '跟进内容不能为空'}), 400

        operator = data.get('operator', 'system')
        ip_address = request.remote_addr

        result = FollowUpService.create_follow_up(
            tenant_id=tenant_id,
            contact_id=contact_id,
            data=data,
            operator=operator,
            ip_address=ip_address
        )

        return jsonify({
            'success': True,
            'message': '跟进记录创建成功',
            'data': result
        }), 201

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        app.logger.error(f'创建跟进记录失败: {str(e)}')
        return jsonify({'error': '服务器内部错误'}), 500


@app.route('/api/test/transaction-rollback', methods=['POST'])
def test_transaction_rollback():
    """
    测试事务回滚（仅供测试使用）
    当 simulate_error=true 时，模拟审计日志写入失败，验证跟进记录是否回滚
    """
    try:
        data = request.get_json()
        tenant_id = data.get('tenant_id', 1)
        contact_id = data.get('contact_id', 1)
        simulate_error = data.get('simulate_error', True)

        follow_up_data = {
            'channel': 'test',
            'content': '测试事务回滚',
            'operator': 'test_user'
        }

        result = FollowUpService.create_follow_up_with_simulated_error(
            tenant_id=tenant_id,
            contact_id=contact_id,
            data=follow_up_data,
            operator='test_user',
            simulate_error=simulate_error
        )

        return jsonify({
            'success': True,
            'message': '事务测试完成',
            'data': result
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'message': '事务已回滚',
            'error': str(e),
            'explanation': '因为设置了 simulate_error=true，在写入审计日志前抛出异常，'
                          '数据库事务已回滚，跟进记录不会被保存'
        }), 500


@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': '接口不存在'}), 404


@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({'error': '请求方法不允许'}), 405


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
