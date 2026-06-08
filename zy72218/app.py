#!/usr/bin/env python3
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def main():
    if len(sys.argv) > 1:
        from cli import cli
        cli()
    else:
        from web_app import create_app
        data_dir = os.environ.get("DATA_DIR", "./data")
        app = create_app(data_dir=data_dir)
        print("=" * 50)
        print("发票池融资匹配系统")
        print(f"数据目录: {os.path.abspath(data_dir)}")
        print("Web 界面: http://127.0.0.1:5000")
        print("API 文档: http://127.0.0.1:5000/api/records")
        print("=" * 50)
        app.run(host="0.0.0.0", port=5000, debug=False)


if __name__ == "__main__":
    main()
