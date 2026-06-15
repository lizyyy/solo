import json

normal_orders = [
    {
        "id": "WO_001",
        "title": "用户反馈APP登录异常",
        "content": "多位用户反馈在iOS系统上无法正常登录APP，提示网络错误。经初步排查可能与最新版本SSL证书配置有关。",
        "category": "功能异常",
        "source": "线上反馈",
        "feedback_time": "2026-06-01T10:30:00",
        "reference_links": "https://example.com/ticket/12345|https://example.com/wiki/login-issue",
        "original_note": "客户投诉级别：P2，影响范围：约5%用户"
    },
    {
        "id": "WO_002",
        "title": "支付页面加载缓慢",
        "content": "用户反映在支付环节页面加载需要10秒以上，部分用户因此放弃支付。需要优化支付网关响应速度。",
        "category": "性能问题",
        "source": "线上反馈",
        "feedback_time": "2026-06-02T14:20:00",
        "reference_links": "https://example.com/ticket/12346",
        "original_note": "涉及金额敏感，需要谨慎处理相关日志",
        "status": "classified",
        "reviewer": "标注员A",
        "review_time": "2026-06-02T17:00:00",
        "review_notes": "初判为性能问题，已完成分类标注"
    },
    {
        "id": "WO_003",
        "title": "商品详情页图片显示错误",
        "content": "部分商品详情页的图片显示为占位图，用户无法正常查看商品信息。",
        "category": "展示问题",
        "source": "线上反馈",
        "feedback_time": "2026-06-03T09:15:00",
        "reference_links": "",
        "original_note": ""
    },
    {
        "id": "WO_006",
        "title": "物流信息长时间不更新",
        "content": "用户下单后物流信息3天未更新，多次查询物流单号均显示404或异常。用户怀疑丢件要求赔偿。",
        "category": "物流问题",
        "source": "线上反馈",
        "feedback_time": "2026-06-04T08:00:00",
        "reference_links": "https://example.com/ticket/12349|https://example.com/invalid-logistics-page",
        "original_note": "引用的物流追踪链接已失效，但标注员仍判为通过",
        "status": "resolved",
        "reviewer": "标注员B",
        "review_time": "2026-06-04T12:30:00",
        "review_notes": "已联系物流商核实，工单标记为已解决"
    }
]

with open('data/samples/normal_work_orders.json', 'w', encoding='utf-8') as f:
    json.dump(normal_orders, f, ensure_ascii=False, indent=2)
print("normal_work_orders.json updated OK")
