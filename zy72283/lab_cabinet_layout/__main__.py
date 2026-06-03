"""模块入口，支持 python -m lab_cabinet_layout <command>"""
import sys
from .cli import cli


def main():
    if len(sys.argv) > 1 and sys.argv[1] == 'api':
        from .api import run_server
        run_server()
    else:
        cli()


if __name__ == '__main__':
    main()
