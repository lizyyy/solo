#!/usr/bin/env python3
import sys
import os
import socket

sys.path.insert(0, os.path.dirname(__file__))


def find_free_port():
    for p in range(5000, 5100):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(("127.0.0.1", p))
            s.close()
            return p
        except OSError:
            s.close()
            continue
    return 5080


port = find_free_port()
from app import app

if __name__ == "__main__":
    print("=" * 50)
    print("🚀 门店评论情绪漂移系统")
    print("✅ 自动发现可用端口: " + str(port))
    print("👉 访问地址: http://127.0.0.1:" + str(port))
    print("=" * 50)
    app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False, threaded=True)
