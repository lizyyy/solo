"""测试Flask启动"""
from app import create_app
import sys

print("Python version:", sys.version)
print("Creating app...")

app = create_app()
print("App created. Starting server on port 5001...")

try:
    app.run(debug=False, host="0.0.0.0", port=5001)
    print("Server started!")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
