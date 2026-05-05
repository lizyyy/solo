# -*- coding: utf-8 -*-
"""
bill_calc - A local command-line billing trial calculation tool

This tool helps门店 or SaaS billing teams replay sample orders before 
going live with new billing rules. It supports:
- Reading bills.yaml, discounts.csv, tax-rules.json, and rounding-profiles.json
- Commands: init, calc, compare, export
- Core calculations: pre-tax/post-tax discounts, service fees, tax-exempt items,
  line-level and order-level rounding, and handling penny differences caused by
  ROUND_HALF_UP, CEIL, FLOOR strategies.
- Readable error messages for missing fields, discounts exceeding subtotal, 
  and conflicting tax configurations.
"""

__version__ = "1.0.0"
__author__ = "Billing Team"
