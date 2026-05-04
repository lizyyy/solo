from celery import Celery
from flask import Flask

celery = Celery(
    'interview_anonymization',
    broker='redis://localhost:6379/0',
    backend='redis://localhost:6379/0'
)

def make_celery(app: Flask = None):
    """
    将Celery与Flask应用绑定，用于在Flask上下文中运行任务
    """
    if app is None:
        from app import create_app
        app = create_app('default')
    
    celery.conf.update(app.config)
    
    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)
    
    celery.Task = ContextTask
    
    # 延迟导入任务模块，避免循环导入
    from app.tasks import processing_tasks
    
    return celery
