import sys
sys.path.insert(0, 'app')

from sqlalchemy.orm import Session
from database import engine, Base
from models import User, ArticleVersion, Feedback, RevisionDraft, UserRole, ArticleStatus, FeedbackType
from datetime import datetime, timedelta
import random

Base.metadata.create_all(bind=engine)

db = Session(bind=engine)

try:
    print("开始初始化数据...")

    analyst = User(username="业务分析师", role=UserRole.ANALYST)
    processor = User(username="处理人员", role=UserRole.PROCESSOR)
    admin = User(username="管理员", role=UserRole.ADMIN)
    db.add_all([analyst, processor, admin])
    db.commit()
    db.refresh(analyst)
    db.refresh(processor)
    db.refresh(admin)
    print(f"用户创建完成: {analyst.id}, {processor.id}, {admin.id}")

    articles_data = [
        {
            "article_id": "ART001",
            "title": "如何使用Python进行数据分析",
            "versions": [
                {
                    "version": "v1.0",
                    "content": "Python是一种强大的编程语言，广泛应用于数据分析领域。本文将介绍如何使用pandas、numpy等库进行数据处理和分析。首先需要安装这些库，然后导入数据，进行清洗和转换，最后进行可视化展示。",
                    "status": ArticleStatus.PUBLISHED,
                    "processed": "Python是一种强大的编程语言，广泛应用于数据分析领域。本文将介绍如何使用pandas、numpy等库进行数据处理和分析。首先需要安装这些库，然后导入数据，进行清洗和转换，最后进行可视化展示。"
                },
                {
                    "version": "v1.1",
                    "content": "Python是一种强大的编程语言，广泛应用于数据分析领域。违规内容本文将介绍如何使用pandas、numpy等库进行数据处理和分析。",
                    "status": ArticleStatus.BLOCKED,
                    "processed": None
                }
            ]
        },
        {
            "article_id": "ART002",
            "title": "FastAPI快速入门指南",
            "versions": [
                {
                    "version": "v1.0",
                    "content": "FastAPI是一个现代、快速的Web框架，用于构建API。它基于Python类型提示，提供自动文档生成、类型检查等功能。本文将介绍如何安装FastAPI，创建第一个API端点，以及使用各种高级功能。",
                    "status": ArticleStatus.PUBLISHED,
                    "processed": "FastAPI是一个现代、快速的Web框架，用于构建API。它基于Python类型提示，提供自动文档生成、类型检查等功能。本文将介绍如何安装FastAPI，创建第一个API端点，以及使用各种高级功能。"
                },
                {
                    "version": "v1.1",
                    "content": "FastAPI是一个现代、快速的Web框架，广告用于构建API。请访问http://example.com获取更多信息。",
                    "status": ArticleStatus.BLOCKED,
                    "processed": None
                }
            ]
        },
        {
            "article_id": "ART003",
            "title": "机器学习基础教程",
            "versions": [
                {
                    "version": "v1.0",
                    "content": "机器学习是人工智能的一个分支，它使计算机能够从数据中学习。本文将介绍监督学习、无监督学习、强化学习等基本概念，以及常用的算法如线性回归、决策树、神经网络等。",
                    "status": ArticleStatus.PENDING_REVIEW,
                    "processed": None
                }
            ]
        }
    ]

    article_versions = []
    for art_data in articles_data:
        for ver_data in art_data["versions"]:
            article = ArticleVersion(
                article_id=art_data["article_id"],
                version=ver_data["version"],
                title=art_data["title"],
                original_content=ver_data["content"],
                processed_content=ver_data["processed"],
                status=ver_data["status"],
                created_by=analyst.id,
                processor_id=processor.id if ver_data["status"] != ArticleStatus.DRAFT else None,
                block_reason="内容包含违禁关键词: 违规内容" if ver_data["status"] == ArticleStatus.BLOCKED and "违规内容" in ver_data["content"] else 
                             ("内容不允许包含外部链接" if ver_data["status"] == ArticleStatus.BLOCKED and "http" in ver_data["content"] else None),
                published_at=datetime.now() - timedelta(days=random.randint(1, 30)) if ver_data["status"] == ArticleStatus.PUBLISHED else None
            )
            db.add(article)
            db.flush()
            db.refresh(article)
            article_versions.append(article)

    db.commit()
    print("文章版本创建完成")

    feedback_types = [FeedbackType.POSITIVE, FeedbackType.NEUTRAL, FeedbackType.NEGATIVE]
    feedback_comments = [
        "内容很有帮助，学到了很多",
        "写得不错，继续加油",
        "内容一般般，需要改进",
        "有些地方不太清楚",
        "非常实用的教程",
        "期待更多内容"
    ]

    for article in [a for a in article_versions if a.status == ArticleStatus.PUBLISHED]:
        num_feedbacks = random.randint(5, 20)
        for i in range(num_feedbacks):
            days_ago = random.randint(0, 30)
            feedback = Feedback(
                article_version_id=article.id,
                user_comment=random.choice(feedback_comments) if random.random() > 0.3 else None,
                feedback_type=random.choices(feedback_types, weights=[0.5, 0.3, 0.2])[0],
                rating=random.randint(3, 5) if random.random() > 0.2 else None,
                created_at=datetime.now() - timedelta(days=days_ago)
            )
            db.add(feedback)

    db.commit()
    print("用户反馈创建完成")

    dirty_drafts_data = [
        {
            "article_idx": 0,
            "content": "这是一个修订草稿，包含广告等违规内容，垃圾信息很多",
            "is_dirty": 1
        },
        {
            "article_idx": 1,
            "content": "短内容",
            "is_dirty": 1
        },
        {
            "article_idx": 2,
            "content": "这是一个正常的修订草稿，内容长度足够，没有违禁词，也没有外部链接。这个草稿应该能够通过审核。" * 3,
            "is_dirty": 0
        }
    ]

    for draft_data in dirty_drafts_data:
        draft = RevisionDraft(
            article_version_id=article_versions[draft_data["article_idx"]].id,
            content=draft_data["content"],
            is_dirty=draft_data["is_dirty"],
            block_reason="内容包含违禁关键词: 广告" if draft_data["is_dirty"] and "广告" in draft_data["content"] else
                         ("内容长度不足，最少需要50字符" if draft_data["is_dirty"] and len(draft_data["content"]) < 50 else None),
            created_by=processor.id
        )
        db.add(draft)

    db.commit()
    print("修订草稿创建完成（包含脏数据）")

    print("\n=== 初始化数据汇总 ===")
    print(f"用户数: {db.query(User).count()}")
    print(f"文章版本数: {db.query(ArticleVersion).count()}")
    print(f"已发布: {db.query(ArticleVersion).filter(ArticleVersion.status == ArticleStatus.PUBLISHED).count()}")
    print(f"已拦截: {db.query(ArticleVersion).filter(ArticleVersion.status == ArticleStatus.BLOCKED).count()}")
    print(f"用户反馈数: {db.query(Feedback).count()}")
    print(f"修订草稿数: {db.query(RevisionDraft).count()}")
    print(f"脏草稿数: {db.query(RevisionDraft).filter(RevisionDraft.is_dirty == 1).count()}")
    print("\n测试用户ID:")
    print(f"  业务分析师 (ANALYST): {analyst.id}")
    print(f"  处理人员 (PROCESSOR): {processor.id}")
    print(f"  管理员 (ADMIN): {admin.id}")
    print("\n初始化完成!")

except Exception as e:
    db.rollback()
    print(f"错误: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()
