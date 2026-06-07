#!/usr/bin/env python3
import sys
import argparse


def main():
    parser = argparse.ArgumentParser(description="导购推荐禁推清单 - 主入口")
    parser.add_argument("mode", nargs="?", default="demo",
                        choices=["demo", "cli", "web", "server"],
                        help="运行模式: demo(演示), cli(命令行), web(小看板), server(API服务)")
    parser.add_argument("--port", type=int, default=5000, help="Web服务端口")
    args = parser.parse_args()

    if args.mode == "demo":
        from forbidden_list.workflows.demo_flow import run_complete_demo
        run_complete_demo()
    elif args.mode == "cli":
        from forbidden_list.cli import main
        sys.argv = sys.argv[:1] + sys.argv[2:]
        main()
    elif args.mode in ["web", "server"]:
        from forbidden_list.api import run_server
        run_server(port=args.port)


if __name__ == "__main__":
    main()
