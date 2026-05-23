#!/usr/bin/env python3
import sys

print("Testing syntax...")

try:
    from store_reconcile import data_loader
    print("✓ data_loader imported")
except Exception as e:
    print(f"✗ data_loader error: {e}")
    import traceback
    traceback.print_exc()

try:
    from store_reconcile import reconciler
    print("✓ reconciler imported")
except Exception as e:
    print(f"✗ reconciler error: {e}")
    import traceback
    traceback.print_exc()

try:
    from store_reconcile import reporter
    print("✓ reporter imported")
except Exception as e:
    print(f"✗ reporter error: {e}")
    import traceback
    traceback.print_exc()

try:
    from store_reconcile import cli
    print("✓ cli imported")
except Exception as e:
    print(f"✗ cli error: {e}")
    import traceback
    traceback.print_exc()

print("\nSyntax check completed!")
