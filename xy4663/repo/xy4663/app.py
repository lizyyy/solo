from flask import Flask, jsonify, request
from database import db_session, init_db
from models import Plan, DiscountRule, CustomerUsage, BillingResult, ConfigVersion, CacheKey, Dependency, RecalcTask
from services.config_service import ConfigService
from services.cache_service import CacheService
from services.recalc_service import RecalcService
from services.report_service import ReportService
from datetime import datetime
import json
import threading

app = Flask(__name__)

config_service = ConfigService()
cache_service = CacheService()
recalc_service = RecalcService()
report_service = ReportService()


@app.teardown_appcontext
def shutdown_session(exception=None):
    db_session.remove()


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "timestamp": datetime.utcnow().isoformat()})


@app.route('/api/plans', methods=['GET'])
def get_plans():
    plans = Plan.query.all()
    return jsonify([p.to_dict() for p in plans])


@app.route('/api/plans/<int:plan_id>', methods=['GET'])
def get_plan(plan_id):
    plan = Plan.query.get(plan_id)
    if not plan:
        return jsonify({"error": "Plan not found"}), 404
    return jsonify(plan.to_dict())


@app.route('/api/plans', methods=['POST'])
def create_plan():
    data = request.json
    plan = Plan(
        name=data['name'],
        description=data.get('description', ''),
        monthly_cost=data['monthly_cost'],
        features=json.dumps(data.get('features', [])),
        is_active=data.get('is_active', True)
    )
    db_session.add(plan)
    db_session.commit()
    return jsonify(plan.to_dict()), 201


@app.route('/api/discounts', methods=['GET'])
def get_discounts():
    discounts = DiscountRule.query.all()
    return jsonify([d.to_dict() for d in discounts])


@app.route('/api/discounts', methods=['POST'])
def create_discount():
    data = request.json
    discount = DiscountRule(
        name=data['name'],
        rule_type=data['rule_type'],
        conditions=json.dumps(data.get('conditions', {})),
        discount_value=data['discount_value'],
        is_active=data.get('is_active', True),
        valid_from=datetime.fromisoformat(data['valid_from']) if data.get('valid_from') else None,
        valid_until=datetime.fromisoformat(data['valid_until']) if data.get('valid_until') else None
    )
    db_session.add(discount)
    db_session.commit()
    return jsonify(discount.to_dict()), 201


@app.route('/api/customers/<int:customer_id>/usage', methods=['GET'])
def get_customer_usage(customer_id):
    usages = CustomerUsage.query.filter_by(customer_id=customer_id).all()
    return jsonify([u.to_dict() for u in usages])


@app.route('/api/customers/<int:customer_id>/usage', methods=['POST'])
def create_customer_usage(customer_id):
    data = request.json
    usage = CustomerUsage(
        customer_id=customer_id,
        plan_id=data['plan_id'],
        usage_month=data['usage_month'],
        usage_data=json.dumps(data.get('usage_data', {})),
        calculated_at=datetime.fromisoformat(data['calculated_at']) if data.get('calculated_at') else None
    )
    db_session.add(usage)
    db_session.commit()
    return jsonify(usage.to_dict()), 201


@app.route('/api/billing-results/<int:customer_id>', methods=['GET'])
def get_billing_results(customer_id):
    results = BillingResult.query.filter_by(customer_id=customer_id).all()
    return jsonify([r.to_dict() for r in results])


@app.route('/api/config/versions', methods=['GET'])
def get_config_versions():
    versions = ConfigVersion.query.order_by(ConfigVersion.created_at.desc()).all()
    return jsonify([v.to_dict() for v in versions])


@app.route('/api/config/publish', methods=['POST'])
def publish_config():
    data = request.json
    result = config_service.publish_new_config(
        changes=data.get('changes', {}),
        author=data.get('author', 'system'),
        description=data.get('description', '')
    )
    return jsonify(result), 201


@app.route('/api/impact/affected-customers', methods=['POST'])
def find_affected_customers():
    data = request.json
    config_version_id = data.get('config_version_id')
    result = config_service.find_affected_customers(config_version_id)
    return jsonify(result)


@app.route('/api/cache/keys', methods=['GET'])
def get_cache_keys():
    keys = CacheKey.query.all()
    return jsonify([k.to_dict() for k in keys])


@app.route('/api/cache/invalidate', methods=['POST'])
def invalidate_cache():
    data = request.json
    cache_keys = data.get('cache_keys', [])
    customer_ids = data.get('customer_ids', [])
    result = cache_service.invalidate_cache(cache_keys, customer_ids)
    return jsonify(result)


@app.route('/api/recalc/tasks', methods=['GET'])
def get_recalc_tasks():
    tasks = RecalcTask.query.order_by(RecalcTask.created_at.desc()).all()
    return jsonify([t.to_dict() for t in tasks])


@app.route('/api/recalc/tasks/<int:task_id>', methods=['GET'])
def get_recalc_task(task_id):
    task = RecalcTask.query.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    return jsonify(task.to_dict())


@app.route('/api/recalc/start', methods=['POST'])
def start_recalc():
    data = request.json
    customer_ids = data.get('customer_ids', [])
    config_version_id = data.get('config_version_id')
    task = recalc_service.create_recalc_task(customer_ids, config_version_id)
    
    thread = threading.Thread(target=recalc_service.process_recalc_task, args=(task.id,))
    thread.start()
    
    return jsonify(task.to_dict()), 201


@app.route('/api/reports/markdown/<int:config_version_id>', methods=['GET'])
def get_markdown_report(config_version_id):
    report = report_service.generate_markdown_report(config_version_id)
    return jsonify({"report": report})


@app.route('/api/reports/json/<int:config_version_id>', methods=['GET'])
def get_json_report(config_version_id):
    report = report_service.generate_json_report(config_version_id)
    return jsonify(report)


@app.route('/api/import/sample-data', methods=['POST'])
def import_sample_data():
    from sample_data import import_all_sample_data
    result = import_all_sample_data()
    return jsonify(result)


if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5001)
