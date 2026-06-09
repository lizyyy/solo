import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from storage import save_sample_input

SAMPLES = [
    {
        "备件编号": "HD-001",
        "备件名称": "滚刀17寸",
        "分类": "滚刀",
        "计划日期": "2026-06-12",
        "件数": "3",
        "维修照片": "https://img.example.com/hd001.jpg",
        "拍照时间": "2026-06-09",
        "提交人": "运营主管-白班",
    },
    {
        "物料编码": "HD-002",
        "物料名称": "主轴承密封件",
        "类型": "主轴承密封",
        "date": "2026-06-15",
        "qty": "2",
        "image": "https://img.example.com/hd002.jpg",
        "shot_time": "2026-06-01",
        "from": "夜班维修组",
    },
    {
        "part_code": "HD-003",
        "name": "刀盘刮刀",
        "刀盘部位": "刮刀",
        "更换日期": "2026-06-11",
        "amount": "8",
        "图片链接": "https://img.example.com/hd003.jpg",
        "时间戳": "2026-06-10",
        "来源渠道": "点检系统",
    },
    {
        "编号": "HD-004",
        "名称": "边缘滚刀",
        "类别": "滚刀",
        "预计日期": "2026-06-20",
        "需求数量": "0",
        "照片链接": "https://img.example.com/hd004.jpg",
        "img_time": "2026-06-08",
    },
    {
        "备件编号": "HD-005",
        "备件名称": "",
        "分类": "主驱动",
        "计划日期": "2026-06-05",
        "件数": "1",
        "照片": "",
    },
    {
        "part_id": "HD-006",
        "part": "滚刀19寸",
        "cate": "滚刀",
        "plan_date": "2026-06-14",
        "num": "5",
        "attachment": "https://img.example.com/hd006.jpg",
        "time": "2026-06-13",
        "source": "现场调度-小宋",
    },
]

if __name__ == "__main__":
    save_sample_input(SAMPLES)
    print(f"✅ 已写入 {len(SAMPLES)} 条样例数据到 data/sample_input.json")
    print("   包含场景：字段名前后不一 / 照片时间错位 / 关键信息缺失 / 数量异常 / 日期滞后")
