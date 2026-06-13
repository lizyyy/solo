#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from app import app

if __name__ == "__main__":
    print("🚀 门店评论情绪漂移系统启动...")
    print("👉 访问地址: http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=False, use_reloader=False, threaded=True)
