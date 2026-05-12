from datetime import datetime, timedelta
from typing import List

from .data_schema import (
    KnowledgeArticleInput,
    ConversationInput,
    ConversationMessageInput,
    BotRecommendationInput,
    AgentCitationInput,
    UserFeedbackInput,
    ImportBatch,
)


def now_offset(minutes: int) -> datetime:
    return datetime.utcnow() - timedelta(minutes=minutes)


def generate_sample_batch() -> ImportBatch:
    base_time = datetime(2026, 5, 1, 10, 0, 0)

    articles = [
        KnowledgeArticleInput(
            article_id="KB-REFUND-001",
            version=1,
            title="退款申请流程说明",
            content="1. 进入订单详情页点击申请退款\n2. 选择退款原因并填写说明\n3. 上传凭证图片\n4. 提交后1-3个工作日审核",
            category="退款",
            tags=["退款", "流程"],
        ),
        KnowledgeArticleInput(
            article_id="KB-REFUND-001",
            version=2,
            title="退款申请流程说明 (已更新)",
            content="1. 进入订单详情页点击申请退款\n2. 选择退款原因并填写说明\n3. 上传凭证图片\n4. 提交后1-2个工作日审核\n5. 退款到账时间: 原路返回3-7个工作日",
            category="退款",
            tags=["退款", "流程"],
        ),
        KnowledgeArticleInput(
            article_id="KB-REFUND-002",
            title="退款失败常见原因",
            content="1. 账户异常: 检查银行卡状态\n2. 超过退款时限: 订单完成超过30天\n3. 已发起退款: 查看退款记录",
            category="退款",
            tags=["退款", "失败原因"],
        ),
        KnowledgeArticleInput(
            article_id="KB-LOGISTICS-001",
            title="物流查询方式",
            content="1. 订单详情页查看\n2. 点击物流号跳转快递公司官网\n3. 异常请联系客服",
            category="物流",
            tags=["物流", "查询"],
        ),
        KnowledgeArticleInput(
            article_id="KB-LOGISTICS-002",
            title="商品损坏/丢失处理",
            content="1. 拒签并拍照留证\n2. 联系客服提交凭证\n3. 申请补发或退款",
            category="物流",
            tags=["物流", "问题处理"],
        ),
        KnowledgeArticleInput(
            article_id="KB-ACCOUNT-001",
            title="密码找回流程",
            content="1. 点击忘记密码\n2. 输入注册手机号\n3. 接收验证码\n4. 设置新密码",
            category="账号",
            tags=["账号", "密码"],
        ),
        KnowledgeArticleInput(
            article_id="KB-ACCOUNT-002",
            title="账号注销须知",
            content="1. 确保无未完成订单\n2. 确保余额已提现\n3. 注销后无法恢复",
            category="账号",
            tags=["账号", "注销"],
        ),
    ]

    conversations: List[ConversationInput] = []
    recommendations: List[BotRecommendationInput] = []
    citations: List[AgentCitationInput] = []
    feedbacks: List[UserFeedbackInput] = []

    t = base_time

    conv1_msgs = [
        ConversationMessageInput(
            message_id="msg-c1-1",
            sender_type="user",
            content="我想退这个订单，怎么操作？",
            timestamp=t,
        ),
        ConversationMessageInput(
            message_id="msg-c1-2",
            sender_type="bot",
            content="您好，退款流程如下：1. 进入订单详情页点击申请退款...",
            timestamp=t + timedelta(seconds=5),
        ),
        ConversationMessageInput(
            message_id="msg-c1-3",
            sender_type="agent",
            sender_id="AGENT-001",
            content="您好，退款请按以下步骤操作：1. 进入订单详情页点击申请退款 2. 选择退款原因并填写说明",
            timestamp=t + timedelta(minutes=2),
        ),
        ConversationMessageInput(
            message_id="msg-c1-4",
            sender_type="user",
            content="好的，我试试看",
            timestamp=t + timedelta(minutes=3),
        ),
    ]
    conversations.append(
        ConversationInput(
            conversation_id="CONV-001",
            user_id="USER-1001",
            agent_id="AGENT-001",
            started_at=t,
            ended_at=t + timedelta(minutes=5),
            channel="web",
            summary="用户咨询退款流程，客服引导成功",
            messages=conv1_msgs,
        )
    )
    recommendations.append(
        BotRecommendationInput(
            recommendation_id="REC-001",
            conversation_id="CONV-001",
            message_id="msg-c1-2",
            article_id="KB-REFUND-001",
            article_version=1,
            rank=1,
            score=0.95,
            recommended_at=t + timedelta(seconds=3),
        )
    )
    citations.append(
        AgentCitationInput(
            citation_id="CITE-001",
            conversation_id="CONV-001",
            message_id="msg-c1-3",
            article_id="KB-REFUND-001",
            article_version=1,
            cited_text="进入订单详情页点击申请退款",
            is_rewritten=True,
            cited_at=t + timedelta(minutes=2),
        )
    )
    feedbacks.append(
        UserFeedbackInput(
            feedback_id="FB-001",
            conversation_id="CONV-001",
            article_id="KB-REFUND-001",
            rating=5,
            is_helpful=True,
            resolved=True,
            feedback_at=t + timedelta(minutes=6),
        )
    )

    t += timedelta(hours=1)

    conv2_msgs = [
        ConversationMessageInput(
            message_id="msg-c2-1",
            sender_type="user",
            content="我的退款为什么失败了？",
            timestamp=t,
        ),
        ConversationMessageInput(
            message_id="msg-c2-2",
            sender_type="bot",
            content="常见退款失败原因...",
            timestamp=t + timedelta(seconds=5),
        ),
        ConversationMessageInput(
            message_id="msg-c2-3",
            sender_type="agent",
            sender_id="AGENT-002",
            content="您好，退款失败可能是：1. 账户异常 2. 超过时限 3. 已发起过退款",
            timestamp=t + timedelta(minutes=3),
        ),
        ConversationMessageInput(
            message_id="msg-c2-4",
            sender_type="user",
            content="这个答案不对，我没有超过时限啊",
            timestamp=t + timedelta(minutes=5),
        ),
    ]
    conversations.append(
        ConversationInput(
            conversation_id="CONV-002",
            user_id="USER-1002",
            agent_id="AGENT-002",
            started_at=t,
            ended_at=t + timedelta(minutes=10),
            channel="app",
            summary="用户反馈退款失败，答案不适用",
            messages=conv2_msgs,
        )
    )
    recommendations.append(
        BotRecommendationInput(
            recommendation_id="REC-002",
            conversation_id="CONV-002",
            article_id="KB-REFUND-002",
            rank=1,
            score=0.88,
            recommended_at=t + timedelta(seconds=3),
        )
    )
    citations.append(
        AgentCitationInput(
            citation_id="CITE-002",
            conversation_id="CONV-002",
            message_id="msg-c2-3",
            article_id="KB-REFUND-002",
            is_copy=True,
            cited_at=t + timedelta(minutes=3),
        )
    )
    feedbacks.append(
        UserFeedbackInput(
            feedback_id="FB-002",
            conversation_id="CONV-002",
            article_id="KB-REFUND-002",
            rating=2,
            is_helpful=False,
            resolved=False,
            comment="原因不全",
            feedback_at=t + timedelta(minutes=11),
        )
    )

    t += timedelta(hours=2)

    conv3_msgs = [
        ConversationMessageInput(
            message_id="msg-c3-1",
            sender_type="user",
            content="帮我查下这个快递到哪了",
            timestamp=t,
        ),
        ConversationMessageInput(
            message_id="msg-c3-2",
            sender_type="bot",
            content="物流查询方式...",
            timestamp=t + timedelta(seconds=4),
        ),
        ConversationMessageInput(
            message_id="msg-c3-3",
            sender_type="agent",
            sender_id="AGENT-001",
            content="您好，可以在订单详情页查看物流信息",
            timestamp=t + timedelta(minutes=1),
        ),
    ]
    conversations.append(
        ConversationInput(
            conversation_id="CONV-003",
            user_id="USER-1003",
            agent_id="AGENT-001",
            started_at=t,
            ended_at=t + timedelta(minutes=3),
            channel="web",
            summary="物流查询",
            messages=conv3_msgs,
        )
    )
    recommendations.append(
        BotRecommendationInput(
            recommendation_id="REC-003",
            conversation_id="CONV-003",
            article_id="KB-LOGISTICS-001",
            rank=1,
            score=0.92,
            recommended_at=t + timedelta(seconds=2),
        )
    )
    citations.append(
        AgentCitationInput(
            citation_id="CITE-003",
            conversation_id="CONV-003",
            message_id="msg-c3-3",
            article_id="KB-LOGISTICS-001",
            is_copy=True,
            cited_at=t + timedelta(minutes=1),
        )
    )
    feedbacks.append(
        UserFeedbackInput(
            feedback_id="FB-003",
            conversation_id="CONV-003",
            article_id="KB-LOGISTICS-001",
            rating=4,
            is_helpful=True,
            resolved=True,
            feedback_at=t + timedelta(minutes=4),
        )
    )

    t += timedelta(hours=1)

    conv4_msgs = [
        ConversationMessageInput(
            message_id="msg-c4-1",
            sender_type="user",
            content="密码忘了怎么办？",
            timestamp=t,
        ),
        ConversationMessageInput(
            message_id="msg-c4-2",
            sender_type="bot",
            content="密码找回流程...",
            timestamp=t + timedelta(seconds=3),
        ),
        ConversationMessageInput(
            message_id="msg-c4-3",
            sender_type="agent",
            sender_id="AGENT-003",
            content="您好，请点击忘记密码，按提示操作",
            timestamp=t + timedelta(minutes=1),
        ),
    ]
    conversations.append(
        ConversationInput(
            conversation_id="CONV-004",
            user_id="USER-1004",
            agent_id="AGENT-003",
            started_at=t,
            ended_at=t + timedelta(minutes=4),
            channel="app",
            messages=conv4_msgs,
        )
    )
    recommendations.append(
        BotRecommendationInput(
            recommendation_id="REC-004",
            conversation_id="CONV-004",
            article_id="KB-ACCOUNT-001",
            rank=1,
            score=0.90,
            recommended_at=t + timedelta(seconds=2),
        )
    )
    citations.append(
        AgentCitationInput(
            citation_id="CITE-004",
            conversation_id="CONV-004",
            message_id="msg-c4-3",
            article_id="KB-ACCOUNT-001",
            is_rewritten=True,
            cited_at=t + timedelta(minutes=1),
        )
    )
    feedbacks.append(
        UserFeedbackInput(
            feedback_id="FB-004",
            conversation_id="CONV-004",
            article_id="KB-ACCOUNT-001",
            rating=5,
            is_helpful=True,
            resolved=True,
            feedback_at=t + timedelta(minutes=5),
        )
    )

    t += timedelta(hours=1)

    conv5_msgs = [
        ConversationMessageInput(
            message_id="msg-c5-1",
            sender_type="user",
            content="我的包裹损坏了",
            timestamp=t,
        ),
        ConversationMessageInput(
            message_id="msg-c5-2",
            sender_type="bot",
            content="商品损坏处理方式...",
            timestamp=t + timedelta(seconds=4),
        ),
    ]
    conversations.append(
        ConversationInput(
            conversation_id="CONV-005",
            user_id="USER-1005",
            started_at=t,
            ended_at=t + timedelta(minutes=2),
            channel="web",
            messages=conv5_msgs,
        )
    )
    recommendations.append(
        BotRecommendationInput(
            recommendation_id="REC-005",
            conversation_id="CONV-005",
            article_id="KB-LOGISTICS-002",
            rank=1,
            score=0.87,
            recommended_at=t + timedelta(seconds=2),
        )
    )
    feedbacks.append(
        UserFeedbackInput(
            feedback_id="FB-005",
            conversation_id="CONV-005",
            article_id="KB-LOGISTICS-002",
            rating=3,
            is_helpful=False,
            resolved=False,
            feedback_at=t + timedelta(minutes=3),
        )
    )

    t += timedelta(hours=3)

    conv6_msgs = [
        ConversationMessageInput(
            message_id="msg-c6-1",
            sender_type="user",
            content="想退款",
            timestamp=t,
        ),
        ConversationMessageInput(
            message_id="msg-c6-2",
            sender_type="bot",
            content="退款流程...",
            timestamp=t + timedelta(seconds=3),
        ),
        ConversationMessageInput(
            message_id="msg-c6-3",
            sender_type="agent",
            sender_id="AGENT-002",
            content="您好，请按最新退款流程操作：1. 进入订单详情...",
            timestamp=t + timedelta(minutes=2),
        ),
    ]
    conversations.append(
        ConversationInput(
            conversation_id="CONV-006",
            user_id="USER-1006",
            agent_id="AGENT-002",
            started_at=t,
            ended_at=t + timedelta(minutes=5),
            channel="web",
            messages=conv6_msgs,
        )
    )
    recommendations.append(
        BotRecommendationInput(
            recommendation_id="REC-006",
            conversation_id="CONV-006",
            article_id="KB-REFUND-001",
            article_version=2,
            rank=1,
            score=0.94,
            recommended_at=t + timedelta(seconds=2),
        )
    )
    citations.append(
        AgentCitationInput(
            citation_id="CITE-006",
            conversation_id="CONV-006",
            message_id="msg-c6-3",
            article_id="KB-REFUND-001",
            article_version=2,
            is_rewritten=True,
            cited_at=t + timedelta(minutes=2),
        )
    )
    feedbacks.append(
        UserFeedbackInput(
            feedback_id="FB-006",
            conversation_id="CONV-006",
            article_id="KB-REFUND-001",
            rating=5,
            is_helpful=True,
            resolved=True,
            feedback_at=t + timedelta(minutes=6),
        )
    )

    t += timedelta(hours=2)

    conv7_msgs = [
        ConversationMessageInput(
            message_id="msg-c7-1",
            sender_type="user",
            content="退款失败原因有哪些？",
            timestamp=t,
        ),
        ConversationMessageInput(
            message_id="msg-c7-2",
            sender_type="bot",
            content="退款失败常见原因...",
            timestamp=t + timedelta(seconds=3),
        ),
        ConversationMessageInput(
            message_id="msg-c7-3",
            sender_type="user",
            content="没解决我的问题",
            timestamp=t + timedelta(minutes=1),
        ),
    ]
    conversations.append(
        ConversationInput(
            conversation_id="CONV-007",
            user_id="USER-1007",
            started_at=t,
            ended_at=t + timedelta(minutes=3),
            channel="app",
            messages=conv7_msgs,
        )
    )
    recommendations.append(
        BotRecommendationInput(
            recommendation_id="REC-007",
            conversation_id="CONV-007",
            article_id="KB-REFUND-002",
            rank=1,
            score=0.91,
            recommended_at=t + timedelta(seconds=2),
        )
    )
    feedbacks.append(
        UserFeedbackInput(
            feedback_id="FB-007",
            conversation_id="CONV-007",
            article_id="KB-REFUND-002",
            rating=1,
            is_helpful=False,
            resolved=False,
            feedback_at=t + timedelta(minutes=4),
        )
    )

    t += timedelta(hours=1)

    conv8_msgs = [
        ConversationMessageInput(
            message_id="msg-c8-1",
            sender_type="user",
            content="退款失败",
            timestamp=t,
        ),
        ConversationMessageInput(
            message_id="msg-c8-2",
            sender_type="bot",
            content="退款失败常见原因...",
            timestamp=t + timedelta(seconds=3),
        ),
    ]
    conversations.append(
        ConversationInput(
            conversation_id="CONV-008",
            user_id="USER-1008",
            started_at=t,
            ended_at=t + timedelta(minutes=2),
            channel="web",
            messages=conv8_msgs,
        )
    )
    recommendations.append(
        BotRecommendationInput(
            recommendation_id="REC-008",
            conversation_id="CONV-008",
            article_id="KB-REFUND-002",
            rank=1,
            score=0.89,
            recommended_at=t + timedelta(seconds=2),
        )
    )
    feedbacks.append(
        UserFeedbackInput(
            feedback_id="FB-008",
            conversation_id="CONV-008",
            article_id="KB-REFUND-002",
            rating=2,
            is_helpful=False,
            resolved=False,
            feedback_at=t + timedelta(minutes=3),
        )
    )

    t += timedelta(hours=1)

    conv9_msgs = [
        ConversationMessageInput(
            message_id="msg-c9-1",
            sender_type="user",
            content="物流怎么查",
            timestamp=t,
        ),
        ConversationMessageInput(
            message_id="msg-c9-2",
            sender_type="bot",
            content="物流查询方式...",
            timestamp=t + timedelta(seconds=2),
        ),
    ]
    conversations.append(
        ConversationInput(
            conversation_id="CONV-009",
            user_id="USER-1009",
            started_at=t,
            ended_at=t + timedelta(minutes=1),
            channel="app",
            messages=conv9_msgs,
        )
    )
    recommendations.append(
        BotRecommendationInput(
            recommendation_id="REC-009",
            conversation_id="CONV-009",
            article_id="KB-LOGISTICS-001",
            rank=1,
            score=0.93,
            recommended_at=t + timedelta(seconds=1),
        )
    )
    feedbacks.append(
        UserFeedbackInput(
            feedback_id="FB-009",
            conversation_id="CONV-009",
            article_id="KB-LOGISTICS-001",
            rating=5,
            is_helpful=True,
            resolved=True,
            feedback_at=t + timedelta(minutes=2),
        )
    )

    t += timedelta(hours=1)

    conv10_msgs = [
        ConversationMessageInput(
            message_id="msg-c10-1",
            sender_type="user",
            content="想注销账号",
            timestamp=t,
        ),
        ConversationMessageInput(
            message_id="msg-c10-2",
            sender_type="bot",
            content="账号注销须知...",
            timestamp=t + timedelta(seconds=3),
        ),
    ]
    conversations.append(
        ConversationInput(
            conversation_id="CONV-010",
            user_id="USER-1010",
            started_at=t,
            ended_at=t + timedelta(minutes=2),
            channel="web",
            messages=conv10_msgs,
        )
    )
    recommendations.append(
        BotRecommendationInput(
            recommendation_id="REC-010",
            conversation_id="CONV-010",
            article_id="KB-ACCOUNT-002",
            rank=1,
            score=0.88,
            recommended_at=t + timedelta(seconds=2),
        )
    )
    feedbacks.append(
        UserFeedbackInput(
            feedback_id="FB-010",
            conversation_id="CONV-010",
            article_id="KB-ACCOUNT-002",
            rating=4,
            is_helpful=True,
            resolved=True,
            feedback_at=t + timedelta(minutes=3),
        )
    )

    batch = ImportBatch(
        articles=articles,
        conversations=conversations,
        recommendations=recommendations,
        citations=citations,
        feedbacks=feedbacks,
    )

    return batch
