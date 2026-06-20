
# Auto-generate app/self_check.py
import os

# Chinese strings via unicode escapes
def s_u(esc): return esc.encode().decode("unicode_escape")

STRINGS = {
    "CT_DUP": s_u("\\u91cd\\u590d\\u5bfc\\u5165\\u68c0\\u67e5"),
    "DET_DUP_OK": s_u("\\u65e0\\u91cd\\u590d\\u8bb0\\u5f55"),
    "CT_MISS": s_u("\\u7279\\u5f81\\u7f3a\\u5931\\u9ed8\\u8ba4\\u5206\\u68c0\\u67e5"),
    "DET_MISS_OK": s_u("\\u65e0\\u7279\\u5f81\\u7f3a\\u5931\\u8bb0\\u5f55"),
    "CT_RESUP": s_u("\\u8865\\u5f55\\u540e\\u91cd\\u7b97\\u68c0\\u67e5"),
    "DET_RESUP_OK": s_u("\\u8865\\u5f55\\u8bb0\\u5f55\\u5747\\u5df2\\u6b63\\u786e\\u91cd\\u7b97"),
    "CT_EXPORT": s_u("\\u5bfc\\u51fa\\u6570\\u636e\\u4e00\\u81f4\\u6027\\u68c0\\u67e5"),
    "DET_EXPORT_OK": s_u("\\u5bfc\\u51fa\\u6570\\u636e\\u4e09\\u7aef\\u4e00\\u81f4"),
    "CT_PEND": s_u("\\u8865\\u5f55\\u540e\\u91cd\\u7b97\\u6b63\\u786e\\u6027\\u81ea\\u68c0"),
    "DET_PEND_SKIP": s_u("\\u65e0\\u8865\\u5f55\\u5feb\\u7167(\\u975e\\u8865\\u5f55\\u89e6\\u53d1)\\uff0c\\u8df3\\u8fc7\\u68c0\\u67e5"),
    "DET_PEND_OK": s_u("\\u8865\\u5f55\\u540e\\u6240\\u6709\\u7279\\u5f81pending\\u72b6\\u6001\\u5747\\u6b63\\u786e"),
    "CT_3WAY": s_u("\\u4e09\\u7aef\\u6570\\u636e\\u4e00\\u81f4\\u6027\\u81ea\\u68c0"),
    "DET_3WAY_OK": s_u("\\u9875\\u9762/API/\\u5bfc\\u51fa\\u4e09\\u7aef\\u6570\\u636e\\u5b8c\\u5168\\u4e00\\u81f4"),
    "FOUND": s_u("\\u53d1\\u73b0"),
    "SAMPLE": s_u("\\u6837\\u672c"),
    "FEATURE": s_u("\\u7279\\u5f81"),
    "CONFLICT": s_u("\\u51b2\\u7a81"),
    "TIAO": s_u("\\u6761"),
    "CHU": s_u("\\u5904"),
    "XIANG": s_u("\\u9879"),
}

def wl(f, line): f.write(line + chr(10))

def build():
    S = STRINGS
    path = os.path.join("app", "self_check.py")
    f = open(path, "w")
    wl(f, "from datetime import datetime")
    wl(f, "from typing import List, Dict, Any, Optional")
    wl(f, "from collections import defaultdict")
    wl(f, "from .models import (")
    wl(f, "    FeatureRecord,")
    wl(f, "    SelfCheckResult,")
    wl(f, "    RecordStatus,")
    wl(f, "    CheckSession,")
    wl(f, ")")
    wl(f, "from .result_store import UnifiedResultStore")
    wl(f, "")
    wl(f, "")
    Q = chr(34)
    N = chr(10)
    S_ = S
    # === check_duplicate_imports ===
    wl(f, "def check_duplicate_imports(records: List[FeatureRecord]) -> SelfCheckResult:")
    wl(f, "    seen = set()")
    wl(f, "    duplicates = []")
    wl(f, "    for rec in records:")
    wl(f, "        key = (rec.feature_id, rec.bucket_id, rec.sample_id)")
    wl(f, "        if key in seen:")
    wl(f, "            duplicates.append(" + Q + S_["FEATURE"] + Q + " + str(rec.feature_id) + " + Q + "-" + S_["CT_DUP"][:1] + Q + " + str(rec.bucket_id) + " + Q + "-" + Q + " + S_"[\"SAMPLE\"] + " + Q + str(rec.sample_id))")
    wl(f, "        seen.add(key)")
