from flask import Flask, request, jsonify
from models import db
from services import AccountService, ServiceError

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///wallet.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

with app.app_context():
    db.create_all()


@app.errorhandler(ServiceError)
def handle_service_error(error):
    response = jsonify({
        "success": False,
        "error": {
            "code": error.code,
            "message": error.message
        }
    })
    response.status_code = 400
    return response


@app.errorhandler(Exception)
def handle_exception(error):
    app.logger.error(f"Unexpected error: {str(error)}")
    response = jsonify({
        "success": False,
        "error": {
            "code": "INTERNAL_ERROR",
            "message": "服务器内部错误"
        }
    })
    response.status_code = 500
    return response


@app.route("/api/accounts/<account_id>/deposit", methods=["POST"])
def deposit(account_id):
    data = request.get_json()
    amount = data.get("amount")
    if not amount:
        return jsonify({
            "success": False,
            "error": {
                "code": "INVALID_REQUEST",
                "message": "缺少 amount 参数"
            }
        }), 400

    result = AccountService.deposit(account_id, float(amount))
    return jsonify({
        "success": True,
        "data": result
    })


@app.route("/api/accounts/<account_id>/freeze", methods=["POST"])
def freeze(account_id):
    data = request.get_json()
    business_order_id = data.get("business_order_id")
    amount = data.get("amount")
    reason = data.get("reason")

    if not business_order_id or not amount:
        return jsonify({
            "success": False,
            "error": {
                "code": "INVALID_REQUEST",
                "message": "缺少 business_order_id 或 amount 参数"
            }
        }), 400

    result = AccountService.freeze(account_id, business_order_id, float(amount), reason)
    return jsonify({
        "success": True,
        "data": result
    })


@app.route("/api/accounts/<account_id>/unfreeze", methods=["POST"])
def unfreeze(account_id):
    data = request.get_json()
    business_order_id = data.get("business_order_id")
    amount = data.get("amount")

    if not business_order_id or not amount:
        return jsonify({
            "success": False,
            "error": {
                "code": "INVALID_REQUEST",
                "message": "缺少 business_order_id 或 amount 参数"
            }
        }), 400

    result = AccountService.unfreeze(account_id, business_order_id, float(amount))
    return jsonify({
        "success": True,
        "data": result
    })


@app.route("/api/accounts/<account_id>/deduct", methods=["POST"])
def deduct(account_id):
    data = request.get_json()
    business_order_id = data.get("business_order_id")
    amount = data.get("amount")

    if not business_order_id or not amount:
        return jsonify({
            "success": False,
            "error": {
                "code": "INVALID_REQUEST",
                "message": "缺少 business_order_id 或 amount 参数"
            }
        }), 400

    result = AccountService.deduct(account_id, business_order_id, float(amount))
    return jsonify({
        "success": True,
        "data": result
    })


@app.route("/api/accounts/<account_id>/disputes/<business_order_id>/close", methods=["POST"])
def close_dispute(account_id, business_order_id):
    result = AccountService.close_dispute(account_id, business_order_id)
    return jsonify({
        "success": True,
        "data": result
    })


@app.route("/api/accounts/<account_id>", methods=["GET"])
def query_account(account_id):
    result = AccountService.query_account(account_id)
    return jsonify({
        "success": True,
        "data": result
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
