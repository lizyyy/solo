#!/usr/bin/env python3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src.utils.sample_data import generate_sample_data


def print_banner():
    banner = """
╔══════════════════════════════════════════════════════════════╗
║           场外期权保证金管理系统 v1.0                        ║
║           OTC Options Margin Management System              ║
╚══════════════════════════════════════════════════════════════╝
    """
    print(banner)


def main():
    print_banner()

    import argparse
    parser = argparse.ArgumentParser(description="场外期权保证金管理系统")
    parser.add_argument("--generate-sample", action="store_true", help="生成示例数据")
    parser.add_argument("--web", action="store_true", help="启动Web服务")
    parser.add_argument("--port", type=int, default=5000, help="Web服务端口")

    args = parser.parse_args()

    if args.generate_sample:
        print("正在生成示例数据...")
        generate_sample_data()
        return

    if args.web:
        print(f"启动Web服务，端口: {args.port}")
        print(f"请在浏览器中访问: http://localhost:{args.port}")
        from src.web.app import app
        app.run(debug=True, host="0.0.0.0", port=args.port)
        return

    parser.print_help()
    print("\n示例用法:")
    print("  python run.py --generate-sample    # 生成示例数据")
    print("  python run.py --web                # 启动Web服务")


if __name__ == "__main__":
    main()
