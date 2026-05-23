#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')

from attendance_cli.self_test import run_all_tests

if __name__ == '__main__':
    success = run_all_tests()
    sys.exit(0 if success else 1)
