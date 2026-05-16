from flask import Flask, jsonify, Response, request
from services import AuditTrailService
from output_formats import OutputFormatter
import io

app = Flask(__name__)
audit_service = AuditTrailService()


@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "error_code": "NOT_FOUND",
        "error_message": "请求的资源不存在",
        "error_details": {"path": request.path}
    }), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        "error_code": "INTERNAL_ERROR",
        "error_message": "服务器内部错误",
        "error_details": {"error": str(error)}
    }), 500


@app.errorhandler(Exception)
def handle_exception(e):
    return jsonify({
        "error_code": "UNEXPECTED_ERROR",
        "error_message": str(e),
        "error_details": {"type": type(e).__name__}
    }), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "service": "audit-trail-service"})


@app.route('/api/report', methods=['GET'])
def get_report():
    report = audit_service.generate_report()
    return jsonify(report.model_dump())


@app.route('/api/report/json', methods=['GET'])
def get_report_json():
    report = audit_service.generate_report()
    pretty = request.args.get('pretty', 'true').lower() == 'true'
    json_str = OutputFormatter.to_json(report, pretty=pretty)
    return Response(json_str, mimetype='application/json')


@app.route('/api/report/markdown', methods=['GET'])
def get_report_markdown():
    report = audit_service.generate_report()
    md_str = OutputFormatter.to_markdown(report)
    return Response(md_str, mimetype='text/markdown; charset=utf-8')


@app.route('/api/report/download', methods=['GET'])
def download_report():
    format_type = request.args.get('format', 'json').lower()
    report = audit_service.generate_report()
    
    if format_type == 'json':
        content = OutputFormatter.to_json(report)
        filename = f"{report.report_id}.json"
        mimetype = 'application/json'
    elif format_type == 'md' or format_type == 'markdown':
        content = OutputFormatter.to_markdown(report)
        filename = f"{report.report_id}.md"
        mimetype = 'text/markdown'
    else:
        return jsonify({
            "error_code": "INVALID_FORMAT",
            "error_message": f"不支持的格式: {format_type}",
            "error_details": {"supported_formats": ["json", "md", "markdown"]}
        }), 400
    
    return Response(
        content,
        mimetype=mimetype,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.route('/api/orders', methods=['GET'])
def get_orders():
    report = audit_service.generate_report()
    return jsonify([o.model_dump() for o in report.orders])


@app.route('/api/orders/<order_id>', methods=['GET'])
def get_order(order_id):
    try:
        order = audit_service.get_order_by_id(order_id)
        return jsonify(order.model_dump())
    except ValueError as e:
        return jsonify({
            "error_code": "ORDER_NOT_FOUND",
            "error_message": str(e),
            "error_details": {"order_id": order_id}
        }), 404


@app.route('/api/orders/with-errors', methods=['GET'])
def get_orders_with_errors():
    orders = audit_service.get_orders_with_errors()
    return jsonify([o.model_dump() for o in orders])


@app.route('/api/orders/with-revisions', methods=['GET'])
def get_orders_with_revisions():
    orders = audit_service.get_orders_with_revisions()
    return jsonify([o.model_dump() for o in orders])


@app.route('/api/orders/with-truncated', methods=['GET'])
def get_orders_with_truncated():
    orders = audit_service.get_orders_with_truncated_fields()
    return jsonify([o.model_dump() for o in orders])


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
