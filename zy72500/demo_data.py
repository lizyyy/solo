from datetime import datetime
from models import UserFeedback, IntentCategory, RecordStatus, AnnotationNote


def create_demo_records() -> list[UserFeedback]:
    return [
        UserFeedback(
            feedback_id="FB001",
            user_id="U1001",
            content="我想退掉昨天买的那件蓝色T恤，尺码不合适。",
            timestamp=datetime(2024, 6, 1, 9, 30, 0),
            old_model_intent=IntentCategory.RETURN,
            new_model_intent=IntentCategory.REFUND,
            gray_batch="灰度批次V2.3-0601",
            status=RecordStatus.CONFIRMED,
            annotation_notes=[
                AnnotationNote(
                    annotator="标注员小王",
                    note="用户明确说'退掉'，结合上下文是退款不是换货，新模型判断正确",
                    timestamp=datetime(2024, 6, 1, 10, 15, 0),
                    is_official_caliber=True
                )
            ],
            manual_correction=None
        ),
        UserFeedback(
            feedback_id="FB002",
            user_id="U2003",
            content="你们客服态度太差了！打了三次电话都没人解决问题，我要投诉！",
            timestamp=datetime(2024, 6, 1, 10, 20, 0),
            old_model_intent=IntentCategory.OTHER,
            new_model_intent=IntentCategory.COMPLAINT,
            gray_batch="灰度批次V2.3-0601",
            status=RecordStatus.CONFIRMED,
            annotation_notes=[
                AnnotationNote(
                    annotator="标注员小李",
                    note="用户明确说'我要投诉'，新模型识别正确，旧模型漏了",
                    timestamp=datetime(2024, 6, 1, 11, 0, 0),
                    is_official_caliber=True
                )
            ]
        ),
        UserFeedback(
            feedback_id="FB003",
            user_id="U2003",
            content="你们客服态度太差了！打了三次电话都没人解决问题，我要投诉！！",
            timestamp=datetime(2024, 6, 1, 10, 22, 0),
            old_model_intent=IntentCategory.OTHER,
            new_model_intent=IntentCategory.COMPLAINT,
            gray_batch="灰度批次V2.3-0601",
            status=RecordStatus.DUPLICATE,
            duplicate_of="FB002",
            annotation_notes=[
                AnnotationNote(
                    annotator="标注员小李",
                    note="和FB002是同一个用户同一通电话的重复录入，内容一致",
                    timestamp=datetime(2024, 6, 1, 11, 5, 0),
                    is_official_caliber=False
                )
            ]
        ),
        UserFeedback(
            feedback_id="FB004",
            user_id="U3005",
            content="想问一下你们会员积分怎么兑换，年底会清零吗？",
            timestamp=datetime(2024, 6, 1, 14, 0, 0),
            old_model_intent=IntentCategory.OTHER,
            new_model_intent=IntentCategory.CONSULT,
            gray_batch="灰度批次V2.3-0601",
            status=RecordStatus.PENDING,
            annotation_notes=[]
        ),
        UserFeedback(
            feedback_id="FB005",
            user_id="U4007",
            content="上次买的护肤品用了过敏，能不能帮我处理一下？",
            timestamp=datetime(2024, 6, 1, 15, 30, 0),
            old_model_intent=IntentCategory.OTHER,
            new_model_intent=IntentCategory.CONSULT,
            gray_batch="灰度批次V2.3-0601",
            status=RecordStatus.RESOLVED,
            annotation_notes=[
                AnnotationNote(
                    annotator="标注员小张",
                    note="一开始以为是咨询，细看用户说'用了过敏，帮我处理'，实际是售后诉求，按旧口径应该归为退货换货类",
                    timestamp=datetime(2024, 6, 1, 16, 20, 0),
                    is_official_caliber=False
                ),
                AnnotationNote(
                    annotator="标注负责人阿强",
                    note="按2024Q2旧口径，涉及商品质量问题的售后诉求统一归为退货换货，已补录",
                    timestamp=datetime(2024, 6, 2, 9, 0, 0),
                    is_official_caliber=True
                )
            ],
            manual_correction=IntentCategory.RETURN
        ),
    ]
