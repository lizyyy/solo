from app import create_app, db
from app.models import (
    Stamp, StampApplication, Authorization, StampCabinetLog,
    ExpressDelivery, StampLoan, Review, AuditResult
)

app = create_app()

@app.shell_context_processor
def make_shell_context():
    return {
        'db': db,
        'Stamp': Stamp,
        'StampApplication': StampApplication,
        'Authorization': Authorization,
        'StampCabinetLog': StampCabinetLog,
        'ExpressDelivery': ExpressDelivery,
        'StampLoan': StampLoan,
        'Review': Review,
        'AuditResult': AuditResult
    }

@app.route('/')
def index():
    return {
        'message': 'Stamp Room Management REST API',
        'version': '1.0.0',
        'description': '公司行政用印室管理系统',
        'endpoints': {
            'stamps': '/api/stamps',
            'applications': '/api/applications',
            'authorizations': '/api/authorizations',
            'cabinet-logs': '/api/cabinet-logs',
            'express-deliveries': '/api/express-deliveries',
            'loans': '/api/loans',
            'reviews': '/api/reviews',
            'risk': '/api/risk',
            'export': '/api/export'
        }
    }

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
