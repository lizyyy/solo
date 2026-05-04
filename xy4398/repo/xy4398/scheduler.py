from datetime import datetime
from typing import Dict, Any, Optional, Callable
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
import logging

from database import Database
from monitor import FridgeMonitor
from importer import DataImporter


class ScheduledTaskManager:
    def __init__(self, db: Database, monitor: FridgeMonitor, 
                 importer: DataImporter,
                 interval_minutes: int = 5):
        self.db = db
        self.monitor = monitor
        self.importer = importer
        self.interval_minutes = interval_minutes
        
        self.scheduler = BackgroundScheduler()
        self._setup_logging()
        
        self.last_import_result: Optional[Dict[str, Any]] = None
        self.last_anomaly_check_result: Optional[Dict[str, Any]] = None
        self.is_running = False

    def _setup_logging(self):
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)

    def import_and_check_task(self):
        self.logger.info("Starting scheduled import and anomaly check task...")
        
        try:
            import_result = self.importer.import_all()
            self.last_import_result = import_result
            
            if import_result['imported_files'] > 0:
                self.logger.info(
                    f"Imported {import_result['imported_files']} files, "
                    f"{import_result['inserted_records']} new records"
                )
            else:
                self.logger.info("No new files to import")
        
        except Exception as e:
            self.logger.error(f"Error during import: {e}")
        
        try:
            anomaly_result = self.monitor.check_and_update_anomalies()
            self.last_anomaly_check_result = anomaly_result
            
            if anomaly_result['new_anomalies'] > 0:
                self.logger.warning(f"Detected {anomaly_result['new_anomalies']} new anomalies")
            if anomaly_result['closed_anomalies'] > 0:
                self.logger.info(f"Closed {anomaly_result['closed_anomalies']} anomalies")
            
            if anomaly_result['ongoing_anomalies'] > 0:
                self.logger.warning(f"Currently {anomaly_result['ongoing_anomalies']} ongoing anomalies")
        
        except Exception as e:
            self.logger.error(f"Error during anomaly check: {e}")
        
        self.logger.info("Scheduled task completed")

    def start(self):
        if self.is_running:
            self.logger.warning("Scheduler is already running")
            return
        
        self.scheduler.add_job(
            self.import_and_check_task,
            trigger=IntervalTrigger(minutes=self.interval_minutes),
            id='import_and_check',
            name='Import files and check anomalies',
            replace_existing=True
        )
        
        self.scheduler.start()
        self.is_running = True
        
        self.logger.info(
            f"Scheduler started. Import task will run every {self.interval_minutes} minutes."
        )
        
        self.logger.info("Running initial import and check...")
        self.import_and_check_task()

    def stop(self):
        if not self.is_running:
            self.logger.warning("Scheduler is not running")
            return
        
        self.scheduler.shutdown(wait=False)
        self.is_running = False
        self.logger.info("Scheduler stopped")

    def get_status(self) -> Dict[str, Any]:
        jobs = []
        for job in self.scheduler.get_jobs():
            jobs.append({
                'id': job.id,
                'name': job.name,
                'next_run': job.next_run_time.isoformat() if job.next_run_time else None,
                'trigger': str(job.trigger)
            })
        
        return {
            'is_running': self.is_running,
            'interval_minutes': self.interval_minutes,
            'jobs': jobs,
            'last_import': self.last_import_result,
            'last_anomaly_check': self.last_anomaly_check_result
        }

    def run_manual_import(self) -> Dict[str, Any]:
        self.logger.info("Running manual import (triggered by user)...")
        self.import_and_check_task()
        
        return {
            'success': True,
            'message': 'Manual import completed',
            'import_result': self.last_import_result,
            'anomaly_check_result': self.last_anomaly_check_result,
            'timestamp': datetime.now().isoformat()
        }
