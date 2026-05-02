#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')

import pytest

result = pytest.main(['tests/test_arbitration.py', '-v'])
sys.exit(result)
