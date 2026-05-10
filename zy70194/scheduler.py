from datetime import datetime, timedelta
import time
import threading
from config import Config

class BackgroundJobScheduler:
    def __init__(self, app):
        self.app = app
        self.running = False
        self.thread = None
    
    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()
        print('后台任务调度器已启动')
    
    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        print('后台任务调度器已停止')
    
    def _run_loop(self):
        from app.services.background_job_service import BackgroundJobService
        from app.services.expiry_service import ExpiryService
        
        last_expiry_check = None
        expiry_interval = Config.VALIDITY_CHECK_INTERVAL
        
        while self.running:
            try:
                with self.app.app_context():
                    now = datetime.utcnow()
                    
                    pending_jobs = BackgroundJobService.get_pending_jobs()
                    for job in pending_jobs:
                        should_execute = False
                        if job.status.value == 'pending':
                            should_execute = True
                        elif job.status.value == 'retrying' and job.next_retry_at:
                            if now >= job.next_retry_at:
                                should_execute = True
                        
                        if should_execute:
                            print(f'执行后台任务: {job.job_id} ({job.job_type})')
                            result = BackgroundJobService.execute_job(job.job_id)
                            if result['success']:
                                print(f'任务完成: {job.job_id}')
                            else:
                                print(f'任务执行结果: {result.get("error", "未知错误")}')
                    
                    if last_expiry_check is None or (now - last_expiry_check).total_seconds() >= expiry_interval:
                        print('执行有效期检查...')
                        result = ExpiryService.check_all_expiry()
                        if result['success']:
                            data = result['data']
                            print(f'有效期检查完成: 询价单={data["inquiries_checked"]}, 报价单={data["quotes_checked"]}, 过期={data["expired_inquiries"] + data["expired_quotes"]}')
                        else:
                            print(f'有效期检查失败: {result.get("error")}')
                        last_expiry_check = now
                
                time.sleep(5)
                
            except Exception as e:
                print(f'后台调度器错误: {e}')
                time.sleep(10)
