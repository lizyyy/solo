import sys
sys.path.insert(0, '.')

print("Starting import test...")
try:
    from app import create_app, db
    print("✓ Import successful")
    
    app = create_app()
    print("✓ App created")
    
    with app.app_context():
        db.create_all()
        print("✓ Database tables created")
    
    print("\nStarting Flask server on port 5000...")
    app.run(host='127.0.0.1', port=5000, debug=False)
    
except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()
