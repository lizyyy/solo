from flask import Flask, request, jsonify
from dataclasses import asdict
from typing import Dict, Any

from models import ReleaseStatus, DecisionType
from slo_service import SLOBudgetService

app = Flask(__name__)
service = SLOBudgetService()


def serialize(obj):
    if hasattr(obj, '__dataclass_fields__'):
        result = asdict(obj)
        for k, v in result.items():
            if isinstance(v, (ReleaseStatus, DecisionType)):
                result[k] = v.value
        return result
    return obj


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "service": "SLO Budget API"})


@app.route('/api/services/slo', methods=['POST'])
def create_service_slo():
    data = request.get_json()
    try:
        service_slo = service.create_service_slo(
            service_name=data['service_name'],
            slo_name=data['slo_name'],
            slo_target=float(data['slo_target']),
            description=data.get('description', '')
        )
        return jsonify({"success": True, "data": serialize(service_slo)}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route('/api/budget', methods=['POST'])
def init_budget():
    data = request.get_json()
    try:
        budget = service.init_budget(
            service_name=data['service_name'],
            slo_name=data['slo_name'],
            total_budget=float(data['total_budget'])
        )
        return jsonify({"success": True, "data": serialize(budget)}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route('/api/budget/<service_name>/<slo_name>', methods=['GET'])
def get_budget(service_name, slo_name):
    budget = service.query_budget(service_name, slo_name)
    if budget:
        return jsonify({"success": True, "data": serialize(budget)})
    return jsonify({"success": False, "error": "Budget not found"}), 404


@app.route('/api/release/evaluate', methods=['POST'])
def evaluate_release():
    data = request.get_json()
    try:
        batch = service.evaluate_release(
            service_name=data['service_name'],
            batch_name=data['batch_name'],
            slo_name=data['slo_name'],
            budget_consumption=float(data['budget_consumption']),
            requester=data['requester'],
            metrics_snapshot=data.get('metrics_snapshot', {}),
            raw_input=data.get('raw_input', {}),
            exemption_reason=data.get('exemption_reason')
        )
        return jsonify({"success": True, "data": serialize(batch)}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route('/api/release/<batch_id>/approve-exemption', methods=['POST'])
def approve_exemption(batch_id):
    data = request.get_json()
    try:
        batch = service.approve_exemption(
            batch_id=batch_id,
            approver=data['approver'],
            override_budget=data.get('override_budget', False)
        )
        return jsonify({"success": True, "data": serialize(batch)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route('/api/release/<batch_id>/reject-exemption', methods=['POST'])
def reject_exemption(batch_id):
    data = request.get_json()
    try:
        batch = service.reject_exemption(
            batch_id=batch_id,
            approver=data['approver'],
            reason=data['reason']
        )
        return jsonify({"success": True, "data": serialize(batch)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route('/api/release/<batch_id>/exception', methods=['POST'])
def handle_exception(batch_id):
    data = request.get_json()
    try:
        batch = service.handle_exception(
            batch_id=batch_id,
            error_message=data['error_message'],
            raw_input=data.get('raw_input'),
            processing_evidence=data.get('processing_evidence')
        )
        return jsonify({"success": True, "data": serialize(batch)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route('/api/release/<batch_id>/manual-correction', methods=['POST'])
def manual_correction(batch_id):
    data = request.get_json()
    try:
        new_status = data.get('new_status')
        if new_status:
            new_status = ReleaseStatus(new_status)
        
        batch = service.manual_correction(
            batch_id=batch_id,
            corrector=data['corrector'],
            correction_note=data['correction_note'],
            new_budget_consumption=float(data['new_budget_consumption']) if 'new_budget_consumption' in data else None,
            new_status=new_status,
            recalculate_budget=data.get('recalculate_budget', False)
        )
        return jsonify({"success": True, "data": serialize(batch)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route('/api/release/<batch_id>/complete', methods=['POST'])
def complete_release(batch_id):
    try:
        batch = service.complete_release(batch_id)
        return jsonify({"success": True, "data": serialize(batch)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route('/api/batches', methods=['GET'])
def list_batches():
    service_name = request.args.get('service_name')
    status = request.args.get('status')
    if status:
        status = ReleaseStatus(status)
    batches = service.query_batches(service_name, status)
    return jsonify({
        "success": True,
        "data": [serialize(b) for b in batches],
        "count": len(batches)
    })


@app.route('/api/release/<batch_id>', methods=['GET'])
def get_batch(batch_id):
    batch = service.storage.get_batch(batch_id)
    if batch:
        return jsonify({"success": True, "data": serialize(batch)})
    return jsonify({"success": False, "error": "Batch not found"}), 404


@app.route('/api/export', methods=['GET'])
def export_decisions():
    service_name = request.args.get('service_name')
    start_time = request.args.get('start_time')
    end_time = request.args.get('end_time')
    
    export_data = service.export_decisions(service_name, start_time, end_time)
    return jsonify({"success": True, "data": export_data})


@app.route('/api/export/download', methods=['GET'])
def download_export():
    service_name = request.args.get('service_name')
    start_time = request.args.get('start_time')
    end_time = request.args.get('end_time')
    
    export_data = service.export_decisions(service_name, start_time, end_time)
    
    import json
    from flask import make_response
    
    output = json.dumps(export_data, indent=2, ensure_ascii=False)
    response = make_response(output)
    response.headers["Content-Disposition"] = "attachment; filename=slo_budget_export.json"
    response.headers["Content-Type"] = "application/json"
    return response


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
