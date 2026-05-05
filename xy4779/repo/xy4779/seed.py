from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import Base, Service, Route, DATABASE_URL, init_db


def seed_database():
    init_db()
    
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    db = SessionLocal()
    
    try:
        user_service_routes = [
            {"path": "/users/{user_id}", "method": "GET", "order_index": 0},
            {"path": "/users/me", "method": "GET", "order_index": 1},
            {"path": "/users/{user_id}/posts", "method": "GET", "order_index": 2},
            {"path": "/users/me/posts", "method": "GET", "order_index": 3},
            {"path": "/users/{user_id}", "method": "GET", "order_index": 4},
            {"path": "/users/all", "method": "GET", "order_index": 5},
        ]
        
        user_service = Service(name="user-gateway-service")
        db.add(user_service)
        db.flush()
        
        for route in user_service_routes:
            db.add(Route(
                service_id=user_service.id,
                path=route["path"],
                method=route["method"],
                order_index=route["order_index"]
            ))
        
        report_service_routes = [
            {"path": "/reports/{date}", "method": "GET", "order_index": 0},
            {"path": "/reports/latest", "method": "GET", "order_index": 1},
            {"path": "/reports/{date}/summary", "method": "GET", "order_index": 2},
            {"path": "/reports/latest/details", "method": "GET", "order_index": 3},
            {"path": "/reports/{report_id}", "method": "GET", "order_index": 4},
        ]
        
        report_service = Service(name="report-gateway-service")
        db.add(report_service)
        db.flush()
        
        for route in report_service_routes:
            db.add(Route(
                service_id=report_service.id,
                path=route["path"],
                method=route["method"],
                order_index=route["order_index"]
            ))
        
        order_service_routes = [
            {"path": "/orders/{order_id:int}", "method": "GET", "order_index": 0},
            {"path": "/orders/search", "method": "GET", "order_index": 1},
            {"path": "/orders/search", "method": "POST", "order_index": 2},
            {"path": "/orders/{order_id:int}", "method": "DELETE", "order_index": 3},
            {"path": "/orders/{order_id:int}", "method": "DELETE", "order_index": 4},
        ]
        
        order_service = Service(name="order-gateway-service")
        db.add(order_service)
        db.flush()
        
        for route in order_service_routes:
            db.add(Route(
                service_id=order_service.id,
                path=route["path"],
                method=route["method"],
                order_index=route["order_index"]
            ))
        
        healthy_service_routes = [
            {"path": "/health", "method": "GET", "order_index": 0},
            {"path": "/api/v1/health", "method": "GET", "order_index": 1},
            {"path": "/api/v1/users", "method": "GET", "order_index": 2},
            {"path": "/api/v1/users/{user_id}", "method": "GET", "order_index": 3},
            {"path": "/api/v1/posts", "method": "POST", "order_index": 4},
            {"path": "/api/v1/posts/{post_id}", "method": "GET", "order_index": 5},
        ]
        
        healthy_service = Service(name="healthy-example-service")
        db.add(healthy_service)
        db.flush()
        
        for route in healthy_service_routes:
            db.add(Route(
                service_id=healthy_service.id,
                path=route["path"],
                method=route["method"],
                order_index=route["order_index"]
            ))
        
        db.commit()
        
        print("Seed 数据创建成功！")
        print("\n已创建以下服务：")
        print(f"  1. user-gateway-service (包含动态参数截获问题)")
        print(f"  2. report-gateway-service (包含动态参数截获问题)")
        print(f"  3. order-gateway-service (包含方法冲突问题)")
        print(f"  4. healthy-example-service (正常服务，无问题)")
        
        print("\n问题场景说明：")
        print("  - /users/me 被 /users/{user_id} 截获")
        print("  - /reports/latest 被 /reports/{date} 截获")
        print("  - /orders/{order_id:int} DELETE 方法重复定义")
        
    except Exception as e:
        db.rollback()
        print(f"Seed 数据创建失败: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
