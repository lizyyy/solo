from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "energy_efficiency_tasks",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_default_retry_delay=settings.RETRY_DELAY_SECONDS,
    task_max_retries=settings.MAX_RETRY_ATTEMPTS,
)

celery_app.autodiscover_tasks(["app.tasks"])
