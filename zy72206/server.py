#!/usr/bin/env python3
import uvicorn
import argparse


def main():
    parser = argparse.ArgumentParser(description="外汇远期交割排程 - Web 服务")
    parser.add_argument("--host", default="127.0.0.1", help="监听地址")
    parser.add_argument("--port", type=int, default=8000, help="监听端口")
    parser.add_argument("--data-dir", default="./data", help="数据目录路径")
    args = parser.parse_args()

    from forex_settlement.web import create_app
    app = create_app(data_dir=args.data_dir)
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
