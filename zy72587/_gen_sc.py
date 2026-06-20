import os, ast
p = os.path.join("app", "self_check.py")
L = []
a = L.append
a('from datetime import datetime')
a('from typing import List, Dict, Any, Optional')
a('from collections import defaultdict')
a('from .models import (FeatureRecord, SelfCheckResult, RecordStatus, CheckSession, ConflictEvidence)')
a('from .result_store import UnifiedResultStore')
a("")
a("def check_duplicate_imports(records):")
a("    seen = set()")
a("    duplicates = []")
a("    for rec in records:")
a("        key = (rec.feature_id, rec.bucket_id, rec.sample_id)")
a("        if key in seen:")
