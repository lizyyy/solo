#!/usr/bin/env python3
from api import create_app

app = create_app()

if __name__ == "__main__":
    print("=" * 60)
    print("城市天际线退界复核系统")
    print("园区运维小陶 · 安全员复核工作台")
    print("=" * 60)
    print("系统已启动，请访问 http://localhost:5000")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=True)
