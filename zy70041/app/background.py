import threading
import time
import logging
from datetime import datetime, timedelta
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)

BACKGROUND_JOB_INTERVAL = 60
MAX_RETRIES = 3
RETRY_DELAY = 5

_job_state = {
    'running': False,
    'thread': None,
    'last_success': None,
    'last_failure': None,
    'retry_count': 0,
    'consecutive_failures': 0
}


class BackgroundJobError(Exception):
    def __init__(self, message, original_error=None, retry_count=0):
        self.message = message
        self.original_error = original_error
        self.retry_count = retry_count
        super().__init__(self.message)


def generate_statistics(app, db, models):
    now = datetime.utcnow()
    period_end = now
    period_start = now - timedelta(days=30)

    tickets = models.DefectTicket.query.filter(
        models.DefectTicket.created_at >= period_start,
        models.DefectTicket.created_at <= period_end
    ).all()

    from app.enums import DefectSeverity, TicketStatus

    critical_count = sum(1 for t in tickets if t.severity == DefectSeverity.CRITICAL)
    high_count = sum(1 for t in tickets if t.severity == DefectSeverity.HIGH)
    medium_count = sum(1 for t in tickets if t.severity == DefectSeverity.MEDIUM)
    low_count = sum(1 for t in tickets if t.severity == DefectSeverity.LOW)
    total_downtime = sum(t.downtime_hours for t in tickets)

    closed_tickets = [t for t in tickets if t.status == TicketStatus.CLOSED]
    avg_resolution = 0
    if closed_tickets:
        total_hours = sum(
            (t.updated_at - t.created_at).total_seconds() / 3600.0
            for t in closed_tickets
        )
        avg_resolution = total_hours / len(closed_tickets)

    stats = models.ImpactStatistics(
        period_start=period_start,
        period_end=period_end,
        total_tickets=len(tickets),
        critical_count=critical_count,
        high_count=high_count,
        medium_count=medium_count,
        low_count=low_count,
        total_downtime_hours=total_downtime,
        avg_resolution_hours=avg_resolution
    )
    db.session.add(stats)
    db.session.commit()

    logger.info(f'已生成影响统计：共 {len(tickets)} 个工单，停机 {total_downtime:.2f} 小时')
    return stats


def background_job_loop(app, db, models):
    while _job_state['running']:
        try:
            with app.app_context():
                generate_statistics(app, db, models)
                _job_state['last_success'] = datetime.utcnow()
                _job_state['retry_count'] = 0
                _job_state['consecutive_failures'] = 0

        except SQLAlchemyError as e:
            _job_state['last_failure'] = datetime.utcnow()
            _job_state['consecutive_failures'] += 1
            logger.error(f'数据库操作失败（连续失败 {_job_state["consecutive_failures"]} 次）：{e}')

            if _job_state['retry_count'] < MAX_RETRIES:
                _job_state['retry_count'] += 1
                logger.info(f'将在 {RETRY_DELAY} 秒后重试（第 {_job_state["retry_count"]} 次）')
                time.sleep(RETRY_DELAY)
                continue
            else:
                logger.error('达到最大重试次数，任务将在下一个周期重新尝试')
                _job_state['retry_count'] = 0

        except Exception as e:
            _job_state['last_failure'] = datetime.utcnow()
            _job_state['consecutive_failures'] += 1
            logger.error(f'后台任务异常：{e}')

        time.sleep(BACKGROUND_JOB_INTERVAL)


def init_app(app, start_jobs=False):
    from app.database import db
    from app import models as models_module

    def start_background_jobs():
        if _job_state['running']:
            return

        _job_state['running'] = True
        _job_state['thread'] = threading.Thread(
            target=background_job_loop,
            args=(app, db, models_module),
            daemon=True
        )
        _job_state['thread'].start()
        logger.info('后台影响统计任务已启动')

    if start_jobs:
        start_background_jobs()


def get_job_status():
    return {
        'running': _job_state['running'],
        'last_success': _job_state['last_success'].isoformat() if _job_state['last_success'] else None,
        'last_failure': _job_state['last_failure'].isoformat() if _job_state['last_failure'] else None,
        'retry_count': _job_state['retry_count'],
        'consecutive_failures': _job_state['consecutive_failures'],
        'max_retries': MAX_RETRIES,
        'retry_delay_seconds': RETRY_DELAY,
        'job_interval_seconds': BACKGROUND_JOB_INTERVAL,
        'notes': (
            '任务每 60 秒执行一次，统计近 30 天数据。'
            '失败后最多重试 3 次（间隔 5 秒），全部失败则等下个周期。'
            '数据库错误会自动重试，其他异常记入日志。'
        )
    }
