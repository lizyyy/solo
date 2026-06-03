#!/usr/bin/env python3
"""
银企直联付款复核系统 - 入口文件
"""

from payment_review.cli import main

if __name__ == "__main__":
    import sys
    sys.exit(main())
