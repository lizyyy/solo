#!/usr/bin/env python3
import os
import sys
import subprocess

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mva_lookback.cli import main as cli_main

if __name__ == "__main__":
    sys.exit(cli_main())
