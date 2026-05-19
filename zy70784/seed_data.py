from database import init_db, get_db, Task, RiskFragment, EraseRule
from eraser import SQLEraser

def seed_test_data():
    init_db()
    db = next(get_db())
    
    if db.query(EraseRule).count() == 0:
        default_rules = [
            EraseRule(
                rule_name="手机号",
                pattern=r"^1[3-9]\d{9}$",
                replacement="[手机号]",
                risk_level="high"
            ),
            EraseRule(
                rule_name="中文姓名",
                pattern=r"^[\u4e00-\u9fa5]{2,4}$",
                replacement="[姓名]",
                risk_level="high"
            ),
            EraseRule(
                rule_name="身份证号",
                pattern=r"^\d{17}[\dXx]$",
                replacement="[身份证号]",
                risk_level="high"
            ),
            EraseRule(
                rule_name="邮箱",
                pattern=r"^[\w.-]+@[\w.-]+\.\w+$",
                replacement="[邮箱]",
                risk_level="medium"
            ),
            EraseRule(
                rule_name="银行卡号",
                pattern=r"^\d{16,19}$",
                replacement="[银行卡号]",
                risk_level="high"
            )
        ]
        db.add_all(default_rules)
        db.commit()
    
    test_sqls = [
        {
            "sql": "SELECT * FROM users WHERE name = '张三' AND phone = '13800138000'",
            "params": {"name": "张三", "phone": "13800138000"},
            "status": "pending"
        },
        {
            "sql": "SELECT * FROM orders WHERE customer = '李四' AND id_card = '110101199001011234'",
            "params": {"customer": "李四", "id_card": "110101199001011234"},
            "status": "processing"
        },
        {
            "sql": "SELECT * FROM accounts WHERE email = 'wangwu@example.com' AND card = '6222021234567890123'",
            "params": {"email": "wangwu@example.com", "card": "6222021234567890123"},
            "status": "reviewed"
        }
    ]
    
    for test_data in test_sqls:
        task = Task(
            sql_content=test_data["sql"],
            params=test_data["params"],
            status=test_data["status"],
            created_by="admin"
        )
        db.add(task)
        db.flush()
        
        if test_data["status"] != "pending":
            rules = db.query(EraseRule).filter(EraseRule.is_enabled == True).all()
            rule_dicts = [
                {
                    "id": r.id,
                    "rule_name": r.rule_name,
                    "pattern": r.pattern,
                    "replacement": r.replacement,
                    "risk_level": r.risk_level,
                    "is_enabled": r.is_enabled
                }
                for r in rules
            ]
            eraser = SQLEraser(rule_dicts)
            risk_matches = eraser.find_risk_fragments(test_data["sql"], test_data["params"])
            
            for match in risk_matches:
                fragment = RiskFragment(
                    task_id=task.id,
                    original_value=match.original_value,
                    replaced_value=match.replaced_value,
                    rule_id=match.rule_id,
                    position_start=match.position_start,
                    position_end=match.position_end,
                    risk_level=match.risk_level,
                    is_verified=(test_data["status"] == "reviewed")
                )
                db.add(fragment)
            
            task.processed_sql = eraser.apply_erasure(test_data["sql"], risk_matches)
    
    db.commit()
    print(f"已创建 {len(test_sqls)} 个测试任务")
    print(f"已初始化 {db.query(EraseRule).count()} 条脱敏规则")
    
    db.close()

if __name__ == "__main__":
    seed_test_data()
