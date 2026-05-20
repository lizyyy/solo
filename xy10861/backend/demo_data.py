from sqlalchemy.orm import Session
from models import Environment, EnvVariable, ChangeRequest, SyncRecord, init_db, SessionLocal
from datetime import datetime, timedelta
import random

def generate_demo_data():
    db = SessionLocal()
    
    try:
        if db.query(Environment).count() > 0:
            print("Demo data already exists, skipping...")
            return
        
        environments = [
            {"name": "development", "description": "开发环境", "is_protected": False},
            {"name": "testing", "description": "测试环境", "is_protected": False},
            {"name": "staging", "description": "预发布环境", "is_protected": True},
            {"name": "production", "description": "生产环境", "is_protected": True}
        ]
        
        env_objects = {}
        for env_data in environments:
            env = Environment(**env_data)
            db.add(env)
            db.flush()
            env_objects[env_data["name"]] = env
        
        common_variables = [
            {"key": "DB_HOST", "value": "localhost", "is_sensitive": False, "description": "数据库主机地址"},
            {"key": "DB_PORT", "value": "5432", "is_sensitive": False, "description": "数据库端口"},
            {"key": "DB_NAME", "value": "app_db", "is_sensitive": False, "description": "数据库名称"},
            {"key": "DB_USER", "value": "app_user", "is_sensitive": False, "description": "数据库用户"},
            {"key": "DB_PASSWORD", "value": "dev_pass_123", "is_sensitive": True, "description": "数据库密码"},
            {"key": "REDIS_HOST", "value": "localhost", "is_sensitive": False, "description": "Redis主机"},
            {"key": "REDIS_PORT", "value": "6379", "is_sensitive": False, "description": "Redis端口"},
            {"key": "API_BASE_URL", "value": "http://localhost:8000", "is_sensitive": False, "description": "API基础地址"},
            {"key": "JWT_SECRET", "value": "dev_jwt_secret_key_2024", "is_sensitive": True, "description": "JWT签名密钥"},
            {"key": "LOG_LEVEL", "value": "DEBUG", "is_sensitive": False, "description": "日志级别"},
            {"key": "FEATURE_FLAG_NEW_UI", "value": "true", "is_sensitive": False, "description": "新UI功能开关"},
            {"key": "MAX_CONNECTIONS", "value": "100", "is_sensitive": False, "description": "最大连接数"},
        ]
        
        env_specific_values = {
            "development": {},
            "testing": {
                "DB_HOST": "test-db.internal",
                "DB_PASSWORD": "test_pass_456!",
                "API_BASE_URL": "https://api-test.example.com",
                "JWT_SECRET": "test_jwt_secret_2024_abc",
                "LOG_LEVEL": "INFO"
            },
            "staging": {
                "DB_HOST": "staging-db.internal",
                "DB_PASSWORD": "staging_pass_789#",
                "API_BASE_URL": "https://api-staging.example.com",
                "JWT_SECRET": "staging_jwt_secret_2024_xyz",
                "LOG_LEVEL": "INFO",
                "FEATURE_FLAG_NEW_UI": "false"
            },
            "production": {
                "DB_HOST": "prod-db.internal",
                "DB_PASSWORD": "prod_pass_secure_2024$",
                "API_BASE_URL": "https://api.example.com",
                "JWT_SECRET": "prod_jwt_secret_2024_secure_123456",
                "LOG_LEVEL": "WARNING",
                "FEATURE_FLAG_NEW_UI": "false",
                "MAX_CONNECTIONS": "500"
            }
        }
        
        for env_name, env in env_objects.items():
            for var_template in common_variables:
                var_data = var_template.copy()
                if var_data["key"] in env_specific_values[env_name]:
                    var_data["value"] = env_specific_values[env_name][var_data["key"]]
                
                var = EnvVariable(
                    environment_id=env.id,
                    key=var_data["key"],
                    value=var_data["value"],
                    is_sensitive=var_data["is_sensitive"],
                    description=var_data["description"]
                )
                db.add(var)
        
        db.flush()
        
        change_requests = [
            {
                "title": "同步JWT_SECRET到测试环境",
                "description": "测试环境需要更新JWT密钥以匹配新的认证流程",
                "source_env": "development",
                "target_env": "testing",
                "variable_key": "JWT_SECRET",
                "proposed_value": "test_jwt_secret_2024_abc_updated",
                "requested_by": "developer@example.com",
                "status": "pending",
                "created_days_ago": 1
            },
            {
                "title": "启用预发布环境新UI",
                "description": "在staging环境测试新UI功能",
                "source_env": "development",
                "target_env": "staging",
                "variable_key": "FEATURE_FLAG_NEW_UI",
                "proposed_value": "true",
                "requested_by": "qa@example.com",
                "status": "approved",
                "approved_by": "admin@example.com",
                "created_days_ago": 2
            },
            {
                "title": "增加生产环境连接数",
                "description": "应对流量高峰，临时增加最大连接数",
                "source_env": "staging",
                "target_env": "production",
                "variable_key": "MAX_CONNECTIONS",
                "proposed_value": "1000",
                "requested_by": "ops@example.com",
                "status": "rejected",
                "approved_by": "security@example.com",
                "created_days_ago": 3
            }
        ]
        
        for cr_data in change_requests:
            source_env = env_objects[cr_data["source_env"]]
            target_env = env_objects[cr_data["target_env"]]
            
            source_var = db.query(EnvVariable).filter(
                EnvVariable.environment_id == source_env.id,
                EnvVariable.key == cr_data["variable_key"]
            ).first()
            
            target_var = db.query(EnvVariable).filter(
                EnvVariable.environment_id == target_env.id,
                EnvVariable.key == cr_data["variable_key"]
            ).first()
            
            cr = ChangeRequest(
                title=cr_data["title"],
                description=cr_data["description"],
                source_env_id=source_env.id,
                target_env_id=target_env.id,
                variable_key=cr_data["variable_key"],
                source_value=source_var.value if source_var else None,
                target_value=target_var.value if target_var else None,
                proposed_value=cr_data["proposed_value"],
                status=cr_data["status"],
                requested_by=cr_data["requested_by"],
                approved_by=cr_data.get("approved_by"),
                approved_at=datetime.utcnow() - timedelta(days=cr_data["created_days_ago"]) if cr_data["status"] != "pending" else None,
                created_at=datetime.utcnow() - timedelta(days=cr_data["created_days_ago"])
            )
            db.add(cr)
        
        db.flush()
        
        sync_records = [
            {
                "source_env": "development",
                "target_env": "testing",
                "variable_key": "LOG_LEVEL",
                "old_value": "DEBUG",
                "new_value": "INFO",
                "synced_by": "developer@example.com",
                "status": "success",
                "days_ago": 5
            },
            {
                "source_env": "testing",
                "target_env": "staging",
                "variable_key": "DB_PASSWORD",
                "old_value": "old_staging_pass",
                "new_value": "staging_pass_789#",
                "synced_by": "ops@example.com",
                "status": "success",
                "days_ago": 7
            },
            {
                "source_env": "staging",
                "target_env": "production",
                "variable_key": "API_BASE_URL",
                "old_value": "",
                "new_value": "https://api.example.com",
                "synced_by": "admin@example.com",
                "status": "success",
                "days_ago": 10
            }
        ]
        
        for sr_data in sync_records:
            sr = SyncRecord(
                source_env_id=env_objects[sr_data["source_env"]].id,
                target_env_id=env_objects[sr_data["target_env"]].id,
                variable_key=sr_data["variable_key"],
                old_value=sr_data["old_value"],
                new_value=sr_data["new_value"],
                synced_by=sr_data["synced_by"],
                status=sr_data["status"],
                created_at=datetime.utcnow() - timedelta(days=sr_data["days_ago"])
            )
            db.add(sr)
        
        db.commit()
        print("Demo data generated successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"Error generating demo data: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
    generate_demo_data()
