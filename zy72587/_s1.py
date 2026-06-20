
import os
p = os.path.join("app", "self_check.py")
with open(p, "w", encoding="utf-8") as f:
    f.write("from datetime import datetime\n")
    f.write("from typing import List, Dict, Any, Optional\n")
    f.write("from collections import defaultdict\n")
    f.write("from .models import (FeatureRecord, SelfCheckResult, RecordStatus, CheckSession, ConflictEvidence)\n")
    f.write("from .result_store import UnifiedResultStore\n\n")
print("header ok")
