#!/usr/bin/env python3
"""二手书寄售结算 CLI 入口"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from book_consignment.cli import cli

if __name__ == '__main__':
    cli()
