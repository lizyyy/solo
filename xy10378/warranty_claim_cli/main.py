import argparse
import sys

from warranty_claim_cli.commands import (
    import_cmd,
    check_cmd,
    supplement_cmd,
    submit_cmd,
    export_cmd,
    manage_devices_cmd,
    manage_failures_cmd,
)

def main():
    parser = argparse.ArgumentParser(
        description="设备保修期索赔 CLI - 管理设备保修索赔流程"
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    import_cmd.setup_parser(subparsers)
    check_cmd.setup_parser(subparsers)
    supplement_cmd.setup_parser(subparsers)
    submit_cmd.setup_parser(subparsers)
    export_cmd.setup_parser(subparsers)
    manage_devices_cmd.setup_parser(subparsers)
    manage_failures_cmd.setup_parser(subparsers)

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(1)

    if args.command == "import":
        import_cmd.execute(args)
    elif args.command == "check":
        check_cmd.execute(args)
    elif args.command == "supplement":
        supplement_cmd.execute(args)
    elif args.command == "submit":
        submit_cmd.execute(args)
    elif args.command == "export":
        export_cmd.execute(args)
    elif args.command == "devices":
        manage_devices_cmd.execute(args)
    elif args.command == "failures":
        manage_failures_cmd.execute(args)

if __name__ == "__main__":
    main()
