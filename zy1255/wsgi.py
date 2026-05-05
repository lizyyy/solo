from app import create_app

app = create_app()

if __name__ == '__main__':
    import os
    host = os.environ.get('HOST', '127.0.0.1')
    port = int(os.environ.get('PORT', 5001))
    debug = os.environ.get('DEBUG', 'True').lower() in ['true', '1', 'yes']
    
    print(f"Starting SQL Validator API server on {host}:{port}")
    print(f"Debug mode: {debug}")
    print("")
    print("API Endpoints:")
    print("  GET  /api/health          - Health check")
    print("  GET  /api/statistics      - Statistics")
    print("  POST /api/validate        - Run validation")
    print("  GET  /api/validations     - List validations")
    print("  GET  /api/validations/<id> - Get validation")
    print("  GET  /api/validations/<id>/export/<format> - Export report")
    print("  GET  /api/failed-samples  - List failed samples")
    print("  GET  /api/bad-cases/examples - Bad case examples")
    print("  GET  /api/curl-examples   - Curl examples")
    print("")
    
    app.run(host=host, port=port, debug=debug)
