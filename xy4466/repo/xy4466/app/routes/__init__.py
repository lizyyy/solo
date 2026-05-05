from flask import Blueprint

main = Blueprint('main', __name__)
api = Blueprint('api', __name__)

from app.routes import applications, stamps, authorizations, cabinet_logs, express_deliveries, loans, reviews, risk, export
