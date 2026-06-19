import urllib.request
import urllib.parse
import json

params = urllib.parse.urlencode({
    "field_name": "teacher_comment",
    "new_value": "API测试批注",
    "reason": "API测试修改",
    "modified_by": "API测试人",
})
url = f"http://localhost:8000/api/modify/2?{params}&workdir=./output_test_csv"
print(f"POST {url}")
req = urllib.request.Request(url, method="POST")
try:
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
    print(f"Status: {resp.status}")
    print(json.dumps(result, indent=2, ensure_ascii=False))
except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code}")
    print(e.read().decode())
