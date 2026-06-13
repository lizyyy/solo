import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app import app
print("Starting drift system on port 5001...")
app.run(host="127.0.0.1", port=5001, debug=False, use_reloader=False, threaded=True)
