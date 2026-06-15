import json

normal_orders = [
    {
        "id": "WO_001",
        "title": "\u7528\u6237\u53cd\u9988APP\u767b\u5f55\u5f02\u5e38",
        "content": "\u591a\u4f4d\u7528\u6237\u53cd\u9988\u5728iOS\u7cfb\u7edf\u4e0a\u65e0\u6cd5\u6b63\u5e38\u767b\u5f55APP\uff0c\u63d0\u793a\u7f51\u7edc\u9519\u8bef\u3002\u7ecf\u521d\u6b65\u6392\u67e5\u53ef\u80fd\u4e0e\u6700\u65b0\u7248\u672cSSL\u8bc1\u4e66\u914d\u7f6e\u6709\u5173\u3002",
        "category": "\u529f\u80fd\u5f02\u5e38",
        "source": "\u7ebf\u4e0a\u53cd\u9988",
        "feedback_time": "2026-06-01T10:30:00",
        "reference_links": "https://example.com/ticket/12345|https://example.com/wiki/login-issue",
        "original_note": "\u5ba2\u6237\u6295\u8bc9\u7ea7\u522b\uff1aP2\uff0c\u5f71\u54cd\u8303\u56f4\uff1a\u7ea65%\u7528\u6237"
    },
    {
        "id": "WO_002",
        "title": "\u652f\u4ed8\u9875\u9762\u52a0\u8f7d\u7f13\u6162",
        "content": "\u7528\u6237\u53cd\u6620\u5728\u652f\u4ed8\u73af\u8282\u9875\u9762\u52a0\u8f7d\u9700\u898110\u79d2\u4ee5\u4e0a\uff0c\u90e8\u5206\u7528\u6237\u56e0\u6b64\u653e\u5f03\u652f\u4ed8\u3002\u9700\u8981\u4f18\u5316\u652f\u4ed8\u7f51\u5173\u54cd\u5e94\u901f\u5ea6\u3002",
        "category": "\u6027\u80fd\u95ee\u9898",
        "source": "\u7ebf\u4e0a\u53cd\u9988",
        "feedback_time": "2026-06-02T14:20:00",
        "reference_links": "https://example.com/ticket/12346",
        "original_note": "\u6d89\u53ca\u91d1\u989d\u654f\u611f\uff0c\u9700\u8981\u8c28\u614e\u5904\u7406\u76f8\u5173\u65e5\u5fd7",
        "status": "classified",
        "reviewer": "\u6807\u6ce8\u5458A",
        "review_time": "2026-06-02T17:00:00",
        "review_notes": "\u521d\u5224\u4e3a\u6027\u80fd\u95ee\u9898\uff0c\u5df2\u5b8c\u6210\u5206\u7c7b\u6807\u6ce8"
    },
    {
        "id": "WO_003",
        "title": "\u5546\u54c1\u8be6\u60c5\u9875\u56fe\u7247\u663e\u793a\u9519\u8bef",
        "content": "\u90e8\u5206\u5546\u54c1\u8be6\u60c5\u9875\u7684\u56fe\u7247\u663e\u793a\u4e3a\u5360\u4f4d\u56fe\uff0c\u7528\u6237\u65e0\u6cd5\u6b63\u5e38\u67e5\u770b\u5546\u54c1\u4fe1\u606f\u3002",
        "category": "\u5c55\u793a\u95ee\u9898",
        "source": "\u7ebf\u4e0a\u53cd\u9988",
        "feedback_time": "2026-06-03T09:15:00",
        "reference_links": "",
        "original_note": ""
    },
    {
        "id": "WO_006",
        "title": "\u7269\u6d41\u4fe1\u606f\u957f\u65f6\u95f4\u4e0d\u66f4\u65b0",
        "content": "\u7528\u6237\u4e0b\u5355\u540e\u7269\u6d41\u4fe1\u606f3\u5929\u672a\u66f4\u65b0\uff0c\u591a\u6b21\u67e5\u8be2\u7269\u6d41\u5355\u53f7\u5747\u663e\u793a404\u6216\u5f02\u5e38\u3002\u7528\u6237\u6000\u7591\u4e22\u4ef6\u8981\u6c42\u8d54\u507f\u3002",
        "category": "\u7269\u6d41\u95ee\u9898",
        "source": "\u7ebf\u4e0a\u53cd\u9988",
        "feedback_time": "2026-06-04T08:00:00",
        "reference_links": "https://example.com/ticket/12349|https://example.com/invalid-logistics-page",
        "original_note": "\u5f15\u7528\u7684\u7269\u6d41\u8ffd\u8e2a\u94fe\u63a5\u5df2\u5931\u6548\uff0c\u4f46\u6807\u6ce8\u5458\u4ecd\u5224\u4e3a\u901a\u8fc7",
        "status": "resolved",
        "reviewer": "\u6807\u6ce8\u5458B",
        "review_time": "2026-06-04T12:30:00",
        "review_notes": "\u5df2\u8054\u7cfb\u7269\u6d41\u5546\u6838\u5b9e\uff0c\u5de5\u5355\u6807\u8bb0\u4e3a\u5df2\u89e3\u51b3"
    }
]

with open('data/samples/normal_work_orders.json', 'w', encoding='utf-8') as f:
    json.dump(normal_orders, f, ensure_ascii=False, indent=2)
print("normal_work_orders.json fixed OK")
