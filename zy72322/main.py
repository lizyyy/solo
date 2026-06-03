import sys
import argparse


def main():
    parser = argparse.ArgumentParser(
        description="傅里叶周期噪声拆解",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="mode", help="运行模式")

    cli_parser = subparsers.add_parser("cli", help="命令行模式")
    cli_parser.add_argument("rest", nargs=argparse.REMAINDER)

    api_parser = subparsers.add_parser("api", help="API服务模式")
    api_parser.add_argument("--host", default="127.0.0.1")
    api_parser.add_argument("--port", type=int, default=8765)

    dash_parser = subparsers.add_parser("dashboard", help="小看板模式")
    dash_parser.add_argument("--host", default="127.0.0.1")
    dash_parser.add_argument("--port", type=int, default=8766)

    args = parser.parse_args()

    if args.mode == "api":
        from fourier_noise.api import run_api
        run_api(args.host, args.port)
    elif args.mode == "dashboard":
        from fourier_noise.dashboard import run_dashboard
        run_dashboard(args.host, args.port)
    else:
        from fourier_noise.cli import main as cli_main
        sys.argv = [sys.argv[0]] + (args.rest if args.mode == "cli" else ["demo", "--with-correction", "--with-rerun"])
        cli_main()


if __name__ == "__main__":
    main()
