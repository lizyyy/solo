import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.data_template import DataTemplate
from app.models.tenant_sandbox import TenantSandbox

def init_sample_data():
    db = SessionLocal()
    
    try:
        templates = [
            DataTemplate(
                name="用户订单模板",
                description="创建测试用户及关联订单",
                template_type="order",
                sql_template="INSERT INTO users (name, email) VALUES ('{{user_name}}', '{{user_email}}');",
                parameters=[{"name": "user_name", "required": True}, {"name": "user_email", "required": True}],
                is_active=True,
                version="1.0"
            ),
            DataTemplate(
                name="商品库存模板",
                description="初始化商品库存数据",
                template_type="inventory",
                sql_template="INSERT INTO products (name, price, stock) VALUES ('{{product_name}}', {{price}}, {{stock}});",
                parameters=[{"name": "product_name", "required": True}, {"name": "price", "required": True}, {"name": "stock", "required": True}],
                is_active=True,
                version="1.0"
            ),
            DataTemplate(
                name="演示账号模板",
                description="创建演示环境账号",
                template_type="demo",
                sql_template="INSERT INTO demo_accounts (tenant_id, account_type) VALUES ('{{tenant_id}}', '{{account_type}}');",
                parameters=[{"name": "tenant_id", "required": True}, {"name": "account_type", "required": True}],
                is_active=True,
                version="1.0"
            )
        ]
        
        for t in templates:
            db.add(t)
        db.commit()
        print("✅ 模板数据初始化完成")
        
        sandboxes = [
            TenantSandbox(
                tenant_id="TENANT_001",
                name="演示环境",
                environment="demo",
                is_active=True
            ),
            TenantSandbox(
                tenant_id="TENANT_002",
                name="测试沙箱A",
                environment="test",
                is_active=True
            ),
            TenantSandbox(
                tenant_id="TENANT_003",
                name="测试沙箱B",
                environment="test",
                is_active=True
            )
        ]
        
        for s in sandboxes:
            db.add(s)
        db.commit()
        print("✅ 沙箱数据初始化完成")
        
    except Exception as e:
        print(f"❌ 初始化失败: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_sample_data()
