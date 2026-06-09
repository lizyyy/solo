import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app import app
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False, use_reloader=False, threaded=True)
