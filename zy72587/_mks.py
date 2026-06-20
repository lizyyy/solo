import os, ast
p = os.path.join("app", "self_check.py")
f = open(p, "w", encoding="utf-8")
u = chr
Q = chr(34)
def w(s=""): f.write(s + chr(10))
def qq(s): return Q + s + Q
w("from datetime import datetime")
w("from typing import List, Dict, Any, Optional")
w("from collections import defaultdict")
w("from .models import (FeatureRecord, SelfCheckResult, RecordStatus, CheckSession, ConflictEvidence)")
w("from .result_store import UnifiedResultStore")
w("")
w("_ = chr")
w("def U(h): return chr(int(h,16)) if len(h)==4 else \"\".join(chr(int(h[i:i+4],16)) for i in range(0,len(h),4))")
