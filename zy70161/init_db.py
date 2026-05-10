#!/usr/bin/env python3
"""
数据库初始化脚本
运行后会创建示例词库、版本和一些示例规则
"""

from app.database import SessionLocal, engine, Base
from app.models.models import (
    TermLibrary,
    TermLibraryVersion,
    TermRule,
    RuleType,
    RuleStatus
)
from datetime import datetime


def init_database():
    print("正在初始化数据库...")
    
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        existing_lib = db.query(TermLibrary).filter(TermLibrary.name == "默认搜索词库").first()
        if existing_lib:
            print("数据库已初始化，跳过...")
            return existing_lib
        
        library = TermLibrary(
            name="默认搜索词库",
            description="系统默认的搜索词黑白名单词库",
            is_active=True,
            created_by="system"
        )
        db.add(library)
        db.flush()
        
        version = TermLibraryVersion(
            library_id=library.id,
            version="v1.0.0",
            description="初始版本",
            is_current=True,
            created_by="system",
            deployed_at=datetime.utcnow()
        )
        db.add(version)
        
        sample_rules = [
            {
                "rule_type": RuleType.BLACKLIST,
                "term": "违禁词1",
                "match_type": "exact",
                "priority": 10,
                "action": "filter",
                "reason": "涉及敏感内容",
                "status": RuleStatus.PRODUCTION,
                "created_by": "admin"
            },
            {
                "rule_type": RuleType.BLACKLIST,
                "term": "广告宣传",
                "match_type": "contains",
                "priority": 5,
                "action": "filter",
                "reason": "广告推广内容",
                "status": RuleStatus.PRODUCTION,
                "created_by": "admin"
            },
            {
                "rule_type": RuleType.WHITELIST,
                "term": "官方认证",
                "match_type": "exact",
                "priority": 10,
                "action": "allow",
                "reason": "官方内容允许展示",
                "status": RuleStatus.PRODUCTION,
                "created_by": "admin"
            },
            {
                "rule_type": RuleType.BLACKLIST,
                "term": "测试敏感词",
                "match_type": "exact",
                "priority": 8,
                "action": "filter",
                "reason": "测试用途",
                "status": RuleStatus.DRAFT,
                "created_by": "tester"
            }
        ]
        
        for rule_data in sample_rules:
            rule = TermRule(
                library_id=library.id,
                **rule_data
            )
            db.add(rule)
        
        db.commit()
        print(f"✓ 创建词库: {library.name} (ID: {library.id})")
        print(f"✓ 创建版本: {version.version}")
        print(f"✓ 创建示例规则: {len(sample_rules)} 条")
        print("\n数据库初始化完成！")
        
        return library
        
    except Exception as e:
        db.rollback()
        print(f"初始化失败: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    init_database()
