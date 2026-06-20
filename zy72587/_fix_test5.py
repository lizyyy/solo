with open("tests/test_feature_granularity.py", encoding="utf-8") as f:
    c = f.read()
import ast
ast.parse(c)
# fix resupplement_data from list to dict
old = "        resupplement_data = [\n            {\n                \"sample_id\": \"user_0002\",\n                \"feature_id\": \"clk_7d\",\n                \"feature_value\": 100,\n                \"feature_timestamp\": \"2024-01-05T12:00:00\",\n                \"default_value_used\": False,\n            }\n        ]"
new = "        resupplement_data = {\"user_0002\": {\"clk_7d\": 100}}"
c = c.replace(old, new)
ast.parse(c)
with open("tests/test_feature_granularity.py", "w", encoding="utf-8") as f:
    f.write(c)
print("test5 fixed.")
