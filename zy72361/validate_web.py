import urllib.request
import urllib.parse

BASE = "http://localhost:8766"

def get(path):
    with urllib.request.urlopen(BASE + path) as r:
        return r.status, r.read().decode("utf-8")

def post(path, data=None):
    body = urllib.parse.urlencode(data or {}).encode()
    req = urllib.request.Request(BASE + path, data=body, method="POST")
    with urllib.request.urlopen(req) as r:
        return r.status, r.read().decode("utf-8"), r.getheader("Location")

def check(text, keywords, label):
    ok = all(k in text for k in keywords)
    mark = "PASS" if ok else "FAIL"
    print("  [{}] {}".format(mark, label))
    if not ok:
        missing = [k for k in keywords if k not in text]
        print("    缺失: {}".format(missing))
    return ok

print("=" * 70)
print("Pulley Review - Web Calculator - Full Validation Run")
print("=" * 70)

all_ok = True

# 1. Initial homepage
print("\n[1/7] Initial homepage...")
code, body = get("/")
print("  HTTP {} ({} bytes)".format(code, len(body)))
all_ok &= check(body, ["正常记录: 0条", "待复核", "旧口径补录: 0条"], "初始统计归零")

# 2. Import sample A
print("\n[2/7] Import sample A (Celsius, normal)...")
code, body, loc = post("/import-sample-a")
print("  HTTP {}, redirect -> {}".format(code, loc))
all_ok &= check(body, ["正常记录: 1条", "webcalc-A01-celsius"], "导入后1条正常")

# 3. Import sample B (mixed unit)
print("\n[3/7] Import sample B (Kelvin, mixed)...")
code, body, loc = post("/import-sample-b")
print("  HTTP {}, redirect -> {}".format(code, loc))
all_ok &= check(body, ["正常记录: 1条", "待复核", "webcalc-A01-kelvin"], "两种单位并存")

# 4. Supplement old caliber (3rd record)
print("\n[4/7] Supplement old caliber (3rd independent record)...")
code, body, loc = post("/supplement-old")
print("  HTTP {}, redirect -> {}".format(code, loc))
all_ok &= check(body, ["正常记录: 1条", "待复核(含温度单位混用): 1条", "旧口径补录: 1条"], "三种状态各 1 条")
all_ok &= check(body, ["webcalc-A01-celsius", "webcalc-A01-kelvin", "rec-suppl-note-old-003"], "三条记录 ID 全部出现")

# 5. Check three detail pages
print("\n[5/7] Check 3 record detail pages...")
import re
ids = list(set(re.findall(r'/record/([a-zA-Z0-9-]+)', body)))
print("  Found {} record links".format(len(ids)))
for rid in sorted(ids)[:3]:
    c, b = get("/record/" + rid)
    has_summary = "正常记录: 1条" in b and "待复核(含温度单位混用): 1条" in b and "旧口径补录: 1条" in b
    has_hist = ("历史" in b) or ("History" in b) or ("history" in b.lower())
    print("    {} -> http={} summary_sync={} has_history={}".format(rid[:28], c == 200, has_summary, has_hist))
    all_ok &= (c == 200)
    all_ok &= has_summary

# 6. Export text
print("\n[6/7] Export text report...")
code, body, _ = post("/export-text")
print("  HTTP {}, {} bytes".format(code, len(body)))
all_ok &= check(body, ["正常记录: 1条", "待复核(含温度单位混用): 1条", "旧口径补录: 1条"], "摘要数字一致")
all_ok &= check(body, ["celsius", "kelvin", "supplement"], "三条记录都出现在导出中")

# 7. Export JSON
print("\n[7/7] Export JSON report...")
code, body, _ = post("/export-json")
print("  HTTP {}, {} bytes".format(code, len(body)))
all_ok &= check(body, ['"normal": 1', '"pending": 1', '"supplemented": 1'], "JSON 计数一致")

print("\n" + "=" * 70)
if all_ok:
    print("ALL CHECKS PASSED: 3 statuses parallel, normal not overwritten")
else:
    print("SOME CHECKS FAILED")
print("=" * 70)
