from app import create_app, db

app = create_app()

with app.app_context():
    db.create_all()

@app.route('/')
def index():
    return {
        'service': 'Compression Strategy Backend Service',
        'version': '1.0.0',
        'status': 'running',
        'endpoints': {
            'suppliers': '/api/suppliers',
            'compression': '/api/compression/execute',
            'strategies': '/api/compression/strategies',
            'evidence': '/api/evidence/chain/<batch_id>/validate',
            'errors': '/api/evidence/errors/<batch_id>',
            'corrections': '/api/corrections',
            'reports': '/api/reports',
            'history': '/api/history/unified',
            'statistics': '/api/history/statistics'
        }
    }

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
