import csv

headers = [
    "ID", "测站", "时间", "潮差", "单位",
    "流量", "单位_流量", "水流速度", "速度单位", "截面面积",
    "面积单位", "效率", "来源", "说明"
]

rows = [
    ["OLD-001", "象山港", "2024-05-01 08:00", "5.5", "米", "800", "立方每秒", "", "", "", "", "0.8", "汇总页", "2024年5月数据"],
    ["OLD-002", "三门湾", "2024-05-01 14:00", "6.2", "m", "950", "m3/s", "", "", "", "", "0.83", "汇总页", "历史口径数据"],
    ["OLD-003", "乐清湾", "2024-05-02 08:00", "7.0", "米", "", "", "3.0", "m/s", "500", "平方米", "0.78", "汇总页", "动能法计算"],
]

with open("samples/老板汇总页_旧口径.csv", "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)

print("生成完成，验证中...")
with open("samples/老板汇总页_旧口径.csv", "r", encoding="utf-8-sig") as f:
    reader = csv.reader(f)
    for i, row in enumerate(reader):
        status = "OK" if len(row) == 14 else "FAIL"
        print(f"  [{status}] 第{i}行: {len(row)}列 | {row[0]}")
