from main import SessionLocal, Task, TaskExecution, generate_executions_for_task
from datetime import datetime

def init_sample_data():
    db = SessionLocal()
    
    existing = db.query(Task).filter(Task.name == "数据库备份").first()
    if existing:
        print("示例数据已存在")
        return
    
    tasks = [
        {
            "name": "数据库备份",
            "cron_expression": "0 2 * * *",
            "description": "每天凌晨2点备份数据库",
            "dependencies": ["database", "filesystem"]
        },
        {
            "name": "Redis缓存清理",
            "cron_expression": "0 */6 * * *",
            "description": "每6小时清理一次缓存",
            "dependencies": ["redis"]
        },
        {
            "name": "日志归档",
            "cron_expression": "0 3 * * 0",
            "description": "每周日凌晨3点归档日志",
            "dependencies": ["filesystem"]
        },
        {
            "name": "API健康检查",
            "cron_expression": "*/5 * * * *",
            "description": "每5分钟检查一次API服务状态",
            "dependencies": ["api"]
        },
        {
            "name": "消息队列清理",
            "cron_expression": "0 1 * * *",
            "description": "每天凌晨1点清理过期消息",
            "dependencies": ["mq"]
        }
    ]
    
    for task_data in tasks:
        import json
        db_task = Task(
            name=task_data["name"],
            cron_expression=task_data["cron_expression"],
            description=task_data["description"],
            dependencies=json.dumps(task_data["dependencies"]),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(db_task)
        db.commit()
        db.refresh(db_task)
        generate_executions_for_task(db, db_task)
        
        executions = db.query(TaskExecution).filter(TaskExecution.task_id == db_task.id).limit(5).all()
        for i, exec in enumerate(executions):
            if i % 3 == 0:
                exec.status = "success"
            elif i % 3 == 1:
                exec.status = "failed"
                exec.is_missed = True
            else:
                exec.status = "blocked"
    
    db.commit()
    print("示例数据初始化完成")

if __name__ == "__main__":
    init_sample_data()
