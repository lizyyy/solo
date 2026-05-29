#!/usr/bin/env python3
import os
import sys

script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

exec(open(os.path.join(script_dir, 'verify_and_run.py')).read())
