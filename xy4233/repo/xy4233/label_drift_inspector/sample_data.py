"""
示例数据模块 - 生成用于演示的示例数据
"""

import json
import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml


LABEL_SCHEMA_YAML = """name: customer_service_intents
version: "2.0.0"
description: 客服意图分类标签体系
labels:
  account_query: 账户查询
  account_modify: 账户修改
  password_reset: 密码重置
  order_query: 订单查询
  order_modify: 订单修改
  order_cancel: 订单取消
  payment_query: 支付查询
  payment_issue: 支付问题
  refund_apply: 退款申请
  refund_query: 退款查询
  complaint: 投诉
  suggestion: 建议
  product_query: 商品查询
  service_query: 服务查询
  other: 其他
parent_labels:
  account:
    - account_query
    - account_modify
    - password_reset
  order:
    - order_query
    - order_modify
    - order_cancel
  payment:
    - payment_query
    - payment_issue
  refund:
    - refund_apply
    - refund_query
  customer_care:
    - complaint
    - suggestion
  info_query:
    - product_query
    - service_query
"""


def generate_annotation_jsonl(
    num_records: int = 100,
    num_annotators: int = 5,
    num_sessions: int = 80,
) -> List[Dict[str, Any]]:
    labels = [
        "account_query", "account_modify", "password_reset",
        "order_query", "order_modify", "order_cancel",
        "payment_query", "payment_issue",
        "refund_apply", "refund_query",
        "complaint", "suggestion",
        "product_query", "service_query", "other",
    ]

    sample_texts = {
        "account_query": [
            "我的账户余额是多少？",
            "想查一下我的会员等级",
            "我的积分还有多少？",
            "账户信息在哪里看？",
            "如何查询消费记录？",
        ],
        "account_modify": [
            "我想改一下绑定的手机号",
            "收货地址需要更新",
            "邮箱地址换了",
            "个人资料怎么修改？",
            "昵称可以改吗？",
        ],
        "password_reset": [
            "密码忘记了怎么办？",
            "登录密码怎么找回？",
            "想重置我的密码",
            "密码过期了怎么处理？",
            "收到验证码了，接下来怎么操作？",
        ],
        "order_query": [
            "我的订单发货了吗？",
            "订单号123456什么时候到？",
            "想查一下物流信息",
            "订单状态是已发货但还没收到",
            "最近一个月的订单列表",
        ],
        "order_modify": [
            "订单的收货地址可以改吗？",
            "想换一下订单中的商品",
            "订单数量要增加",
            "配送时间能改吗？",
            "需要修改订单备注",
        ],
        "order_cancel": [
            "想取消这个订单",
            "刚下单不想要了",
            "订单可以退掉吗？",
            "取消订单后退款什么时候到？",
            "如何申请取消订单？",
        ],
        "payment_query": [
            "付款成功了吗？",
            "扣款了但订单显示未支付",
            "支付记录在哪里看？",
            "用什么方式付的款？",
            "订单金额是多少？",
        ],
        "payment_issue": [
            "支付失败了怎么回事？",
            "银行卡扣了两次钱",
            "优惠券用不了",
            "积分抵扣不成功",
            "支付页面打不开",
        ],
        "refund_apply": [
            "想申请退款",
            "商品不满意想退货",
            "这个订单可以退款吗？",
            "收到货了想退",
            "如何申请全额退款？",
        ],
        "refund_query": [
            "退款申请处理得怎么样了？",
            "退款什么时候到账？",
            "退款金额是多少？",
            "想查一下退款进度",
            "退款被拒绝了怎么办？",
        ],
        "complaint": [
            "你们的服务太差了！",
            "我要投诉这个客服",
            "商品质量有问题",
            "配送太慢了",
            "客服态度不好",
        ],
        "suggestion": [
            "提个建议，希望能改进",
            "建议增加这个功能",
            "界面可以做得更友好一点",
            "希望能支持更多支付方式",
            "有个小建议",
        ],
        "product_query": [
            "这个商品有货吗？",
            "商品的规格参数是什么？",
            "有同款不同颜色的吗？",
            "商品什么时候补货？",
            "保修期是多久？",
        ],
        "service_query": [
            "你们的营业时间是什么时候？",
            "客服电话是多少？",
            "可以上门安装吗？",
            "售后服务包括哪些？",
            "会员有什么特权？",
        ],
        "other": [
            "在吗？",
            "你好",
            "有人吗？",
            "喂",
            "你好，能帮我个忙吗？",
        ],
    }

    annotators = [f"annotator_{i:02d}" for i in range(1, num_annotators + 1)]

    records = []
    base_time = datetime.now() - timedelta(days=7)

    for i in range(num_records):
        session_idx = i % num_sessions
        session_id = f"session_{session_idx:04d}"
        turn_id = f"turn_{(i // num_sessions) + 1:02d}" if i >= num_sessions else None

        annotator = random.choice(annotators)

        if annotator == "annotator_03":
            label_weights = {
                "account_query": 0.4,
                "order_query": 0.3,
                "other": 0.2,
            }
            remaining = 1.0 - sum(label_weights.values())
            other_labels = [l for l in labels if l not in label_weights]
            label_weights.update({l: remaining / len(other_labels) for l in other_labels})
            label = random.choices(list(label_weights.keys()), list(label_weights.values()))[0]
        else:
            label = random.choice(labels)

        text = random.choice(sample_texts.get(label, sample_texts["other"]))

        if i < 3:
            split = "train"
        elif i < 6:
            split = "val"
        elif session_idx in [0, 1, 2]:
            split = random.choice(["train", "val"])
        else:
            split = random.choice(["train", "val", "test"])

        annotated_at = base_time + timedelta(hours=random.randint(0, 168))

        records.append({
            "session_id": session_id,
            "turn_id": turn_id,
            "text": text,
            "label": label,
            "annotator_id": annotator,
            "annotated_at": annotated_at.isoformat(),
            "split": split,
            "metadata": {
                "source": "sample_data",
                "batch": "2026_w18",
            },
        })

    return records


def generate_prediction_csv(num_records: int = 100) -> List[Dict[str, Any]]:
    labels = [
        "account_query", "account_modify", "password_reset",
        "order_query", "order_modify", "order_cancel",
        "payment_query", "payment_issue",
        "refund_apply", "refund_query",
        "complaint", "suggestion",
        "product_query", "service_query", "other",
    ]

    records = []
    base_time = datetime.now() - timedelta(days=3)

    for i in range(num_records):
        session_idx = i % 80
        session_id = f"session_{session_idx:04d}"
        turn_id = f"turn_{(i // 80) + 1:02d}" if i >= 80 else None

        true_label_map = {
            "account_query": ["account_query", "product_query", "other"],
            "order_query": ["order_query", "order_modify", "other"],
            "other": ["other", "service_query", "product_query"],
        }

        if random.random() < 0.75:
            predicted_label = random.choice(labels)
        else:
            predicted_label = random.choice(labels)

        confidence = random.uniform(0.3, 0.98) if random.random() > 0.1 else random.uniform(0.1, 0.5)

        predicted_at = base_time + timedelta(hours=random.randint(0, 72))

        records.append({
            "session_id": session_id,
            "turn_id": turn_id,
            "predicted_label": predicted_label,
            "confidence": round(confidence, 4),
            "model_version": "intent_classifier_v2.3.1",
            "predicted_at": predicted_at.isoformat(),
        })

    return records


def generate_sampling_feedback(num_records: int = 20) -> List[Dict[str, Any]]:
    labels = [
        "account_query", "account_modify", "password_reset",
        "order_query", "order_modify", "order_cancel",
        "payment_query", "payment_issue",
        "refund_apply", "refund_query",
        "complaint", "suggestion",
        "product_query", "service_query", "other",
    ]

    records = []
    reviewers = ["reviewer_01", "reviewer_02", "reviewer_03"]
    base_time = datetime.now() - timedelta(days=1)

    for i in range(num_records):
        session_idx = i % 80
        session_id = f"session_{session_idx:04d}"
        turn_id = None

        original_label = random.choice(labels)

        if random.random() < 0.85:
            reviewer_label = original_label
            is_agreement = True
            feedback_notes = "确认无误"
        else:
            reviewer_label = random.choice([l for l in labels if l != original_label])
            is_agreement = False
            feedback_notes = f"原标签 {original_label} 不准确，应改为 {reviewer_label}"

        reviewed_at = base_time + timedelta(hours=random.randint(0, 24))

        records.append({
            "session_id": session_id,
            "turn_id": turn_id,
            "original_label": original_label,
            "reviewer_label": reviewer_label,
            "reviewer_id": random.choice(reviewers),
            "is_agreement": is_agreement,
            "feedback_notes": feedback_notes,
            "reviewed_at": reviewed_at.isoformat(),
        })

    return records


def generate_sample_files(output_dir: Path) -> Dict[str, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)

    schema_path = output_dir / "label_schema.yaml"
    with open(schema_path, "w", encoding="utf-8") as f:
        f.write(LABEL_SCHEMA_YAML)

    annotations = generate_annotation_jsonl(num_records=100)
    annotations_path = output_dir / "annotations.jsonl"
    with open(annotations_path, "w", encoding="utf-8") as f:
        for record in annotations:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    predictions = generate_prediction_csv(num_records=100)
    predictions_path = output_dir / "predictions.csv"
    import pandas as pd
    df_pred = pd.DataFrame(predictions)
    df_pred.to_csv(predictions_path, index=False, encoding="utf-8-sig")

    feedbacks = generate_sampling_feedback(num_records=20)
    feedbacks_path = output_dir / "sampling_feedback.csv"
    df_fb = pd.DataFrame(feedbacks)
    df_fb.to_csv(feedbacks_path, index=False, encoding="utf-8-sig")

    return {
        "schema": schema_path,
        "annotations": annotations_path,
        "predictions": predictions_path,
        "feedback": feedbacks_path,
    }
