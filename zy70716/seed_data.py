from datetime import datetime, timedelta
from database import SessionLocal, engine
import models

models.Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    print("开始生成测试数据...")
    
    failure_cases = [
        {
            "page_path": "/checkout/payment",
            "browser_matrix": {"chrome": "<90", "firefox": "<88", "ie": "11"},
            "failure_cases": [
                {"case_id": "PAY-001", "description": "支付按钮无法点击", "browser": "ie", "browser_version": "11", "screenshot_url": None},
                {"case_id": "PAY-002", "description": "银行卡号输入框样式错乱", "browser": "ie", "browser_version": "11", "screenshot_url": None}
            ],
            "reporter": "qa001",
            "conclusion": "pending"
        },
        {
            "page_path": "/user/profile",
            "browser_matrix": {"safari": "<14", "chrome": "<90"},
            "failure_cases": [
                {"case_id": "PROF-001", "description": "头像上传失败", "browser": "safari", "browser_version": "13.1", "screenshot_url": None}
            ],
            "reporter": "qa002",
            "conclusion": "pending"
        },
        {
            "page_path": "/product/list",
            "browser_matrix": {"ie": "11", "edge": "<80"},
            "failure_cases": [
                {"case_id": "PROD-001", "description": "商品图片加载缓慢", "browser": "ie", "browser_version": "11", "screenshot_url": None},
                {"case_id": "PROD-002", "description": "筛选按钮位置偏移", "browser": "edge", "browser_version": "79", "screenshot_url": None}
            ],
            "reporter": "qa001",
            "conclusion": "fixed"
        },
        {
            "page_path": "/order/detail",
            "browser_matrix": {"firefox": "<88"},
            "failure_cases": [
                {"case_id": "ORD-001", "description": "物流信息显示不全", "browser": "firefox", "browser_version": "87", "screenshot_url": None}
            ],
            "reporter": "qa003",
            "conclusion": "pending"
        },
        {
            "page_path": "/cart/view",
            "browser_matrix": {"ie": "11"},
            "failure_cases": [
                {"case_id": "CART-001", "description": "购物车数量无法更新", "browser": "ie", "browser_version": "11", "screenshot_url": None}
            ],
            "reporter": "qa002",
            "conclusion": "exempted"
        }
    ]
    
    created_failures = []
    for fc in failure_cases:
        db_failure = models.FailureCase(
            page_path=fc["page_path"],
            browser_matrix=fc["browser_matrix"],
            failure_cases=fc["failure_cases"],
            reporter=fc["reporter"],
            conclusion=fc["conclusion"]
        )
        db.add(db_failure)
        db.flush()
        created_failures.append(db_failure)
        print(f"创建失败样例: {fc['page_path']}")
    
    db.commit()
    
    exemptions = [
        {
            "failure_id": created_failures[4].id,
            "exemption_reason": "IE11用户占比低于0.1%，技术改造成本过高，计划3个月后放弃支持",
            "exempt_browsers": ["ie"],
            "expire_days": 30,
            "applicant": "dev001",
            "status": "approved",
            "review_result": "approved",
            "review_comment": "同意豁免，请注意跟进后续用户反馈",
            "reviewer": "leader001"
        },
        {
            "failure_id": created_failures[0].id,
            "exemption_reason": "支付页面即将重构，临时豁免本次兼容问题",
            "exempt_browsers": ["ie"],
            "expire_days": 7,
            "applicant": "dev002",
            "status": "pending",
            "review_result": None,
            "review_comment": None,
            "reviewer": None
        }
    ]
    
    for idx, ex in enumerate(exemptions):
        expire_at = datetime.now() + timedelta(days=ex["expire_days"])
        
        if idx == 0:
            expire_at = datetime.now() - timedelta(days=2)
        
        db_exemption = models.Exemption(
            failure_id=ex["failure_id"],
            exemption_reason=ex["exemption_reason"],
            exempt_browsers=ex["exempt_browsers"],
            expire_at=expire_at,
            applicant=ex["applicant"],
            status=ex["status"],
            review_result=ex["review_result"],
            review_comment=ex["review_comment"],
            reviewer=ex["reviewer"],
            reviewed_at=datetime.now() if ex["review_result"] else None
        )
        db.add(db_exemption)
        print(f"创建豁免申请: 失败样例ID={ex['failure_id']}")
    
    db.commit()
    
    audit_logs = [
        {
            "operation_type": "create",
            "resource_type": "failure_case",
            "resource_id": created_failures[0].id,
            "operator": "qa001",
            "original_input": {"page_path": "/checkout/payment", "browser": "ie"},
            "process_result": {"status": "success"}
        },
        {
            "operation_type": "create_exemption",
            "resource_type": "exemption",
            "resource_id": 1,
            "operator": "dev001",
            "original_input": {"reason": "用户占比低"},
            "process_result": {"status": "approved"}
        }
    ]
    
    for log in audit_logs:
        db_audit = models.AuditLog(
            operation_type=log["operation_type"],
            resource_type=log["resource_type"],
            resource_id=log["resource_id"],
            operator=log["operator"],
            original_input=log["original_input"],
            process_result=log["process_result"]
        )
        db.add(db_audit)
    
    db.commit()
    
    print("测试数据生成完成！")
    print(f"失败样例: {len(created_failures)} 条")
    print(f"豁免申请: {len(exemptions)} 条")
    print(f"审计日志: {len(audit_logs)} 条")
    
finally:
    db.close()
