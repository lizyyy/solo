import json
import os
import sys
import signal
from typing import Dict, Any, Optional

from database import Database
from monitor import FridgeMonitor
from importer import DataImporter
from reporter import ReportGenerator
from scheduler import ScheduledTaskManager
from api import create_app


def load_config(config_path: str = './config.json') -> Dict[str, Any]:
    if not os.path.exists(config_path):
        print(f"Config file not found: {config_path}")
        sys.exit(1)
    
    with open(config_path, 'r', encoding='utf-8') as f:
        return json.load(f)


class FridgeMonitorService:
    def __init__(self, config_path: str = './config.json'):
        self.config = load_config(config_path)
        self.config_path = config_path
        
        self.db: Optional[Database] = None
        self.monitor: Optional[FridgeMonitor] = None
        self.importer: Optional[DataImporter] = None
        self.reporter: Optional[ReportGenerator] = None
        self.scheduler: Optional[ScheduledTaskManager] = None
        self.app = None
        
        self._running = False

    def _init_components(self):
        print("Initializing components...")
        
        db_path = self.config.get('database', './fridge_monitor.db')
        data_dir = self.config.get('data_dir', './data')
        fridges = self.config.get('fridges', [])
        offline_threshold = self.config.get('offline_threshold_minutes', 30)
        import_interval = self.config.get('import_interval_minutes', 5)
        
        self.db = Database(db_path)
        print(f"  - Database initialized: {db_path}")
        
        self.monitor = FridgeMonitor(self.db, fridges, offline_threshold)
        print(f"  - Monitor initialized with {len(fridges)} fridges")
        
        self.importer = DataImporter(self.db, data_dir)
        print(f"  - Importer initialized, data dir: {data_dir}")
        
        self.reporter = ReportGenerator(self.db, self.monitor)
        print("  - Reporter initialized")
        
        self.scheduler = ScheduledTaskManager(
            self.db, self.monitor, self.importer,
            interval_minutes=import_interval
        )
        print(f"  - Scheduler initialized, interval: {import_interval} minutes")
        
        self.app = create_app(
            self.db, self.monitor, self.importer, self.reporter, self.config
        )
        print("  - Flask app initialized")

    def _setup_signal_handlers(self):
        def signal_handler(sig, frame):
            print("\nReceived shutdown signal...")
            self.stop()
            sys.exit(0)
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

    def start(self):
        if self._running:
            print("Service is already running")
            return
        
        self._init_components()
        self._setup_signal_handlers()
        
        print("\n" + "=" * 60)
        print("  冰箱温度监控系统启动")
        print("=" * 60)
        print(f"  配置文件: {self.config_path}")
        print(f"  数据目录: {self.config.get('data_dir', './data')}")
        print(f"  数据库: {self.config.get('database', './fridge_monitor.db')}")
        print(f"  导入间隔: {self.config.get('import_interval_minutes', 5)} 分钟")
        print(f"  离线阈值: {self.config.get('offline_threshold_minutes', 30)} 分钟")
        print(f"  冰箱数量: {len(self.config.get('fridges', []))}")
        print("=" * 60 + "\n")
        
        for fridge in self.config.get('fridges', []):
            print(f"  - {fridge['name']} ({fridge['id']}): {fridge['min_temp']} ~ {fridge['max_temp']}℃")
        print()
        
        self.scheduler.start()
        self._running = True
        
        server_config = self.config.get('server', {})
        host = server_config.get('host', '0.0.0.0')
        port = server_config.get('port', 5000)
        
        print(f"\nStarting HTTP server on {host}:{port}...")
        print(f"API endpoints available at:")
        print(f"  - GET  http://{host}:{port}/api/status")
        print(f"  - GET  http://{host}:{port}/api/anomalies")
        print(f"  - POST http://{host}:{port}/api/import")
        print(f"  - GET  http://{host}:{port}/api/report")
        print(f"  - GET  http://{host}:{port}/api/stats")
        print()
        
        try:
            self.app.run(host=host, port=port, debug=False, threaded=True)
        except KeyboardInterrupt:
            self.stop()

    def stop(self):
        if not self._running:
            return
        
        print("\nStopping service...")
        
        if self.scheduler and self.scheduler.is_running:
            self.scheduler.stop()
        
        self._running = False
        print("Service stopped.")

    def run_once(self):
        self._init_components()
        
        print("Running one-time import and check...")
        results = self.scheduler.run_manual_import()
        
        print("\n" + "=" * 60)
        print("  单次执行结果")
        print("=" * 60)
        
        import_result = results.get('import_result', {})
        print(f"\n导入结果:")
        print(f"  - 扫描文件数: {import_result.get('total_files', 0)}")
        print(f"  - 新导入文件: {import_result.get('imported_files', 0)}")
        print(f"  - 总记录数: {import_result.get('total_records', 0)}")
        print(f"  - 新插入记录: {import_result.get('inserted_records', 0)}")
        
        anomaly_result = results.get('anomaly_check_result', {})
        print(f"\n异常检查结果:")
        print(f"  - 新增异常: {anomaly_result.get('new_anomalies', 0)}")
        print(f"  - 关闭异常: {anomaly_result.get('closed_anomalies', 0)}")
        print(f"  - 进行中异常: {anomaly_result.get('ongoing_anomalies', 0)}")
        
        statuses = self.monitor.get_current_status()
        print(f"\n当前状态:")
        for s in statuses:
            emoji = {
                'normal': '✅', 'too_hot': '🔥', 'too_cold': '❄️',
                'offline': '📴', 'no_data': '❓', 'unknown': '⚠️'
            }.get(s['status'], '⚠️')
            
            temp_str = f"{s['current_temp']:.1f}℃" if s['current_temp'] is not None else "--"
            print(f"  {emoji} {s['fridge_name']}: {temp_str} ({s['status_text']})")
        
        print("\n" + "=" * 60)

    def generate_report(self, shift_name: str = '白班', operator: str = ''):
        self._init_components()
        
        print(f"Generating report for {shift_name}...")
        markdown = self.reporter.generate_report(
            shift_name=shift_name,
            operator=operator
        )
        
        output_file = f"./交接报告_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(markdown)
        
        print(f"Report saved to: {output_file}")
        print("\nReport preview:\n")
        print(markdown)


def main():
    import argparse
    from datetime import datetime
    
    parser = argparse.ArgumentParser(description='冰箱温度监控系统')
    parser.add_argument('--config', '-c', default='./config.json', help='配置文件路径')
    parser.add_argument('--once', action='store_true', help='仅执行一次导入和检查')
    parser.add_argument('--report', action='store_true', help='仅生成交接班报告')
    parser.add_argument('--shift', default='白班', help='班次名称 (用于报告)')
    parser.add_argument('--operator', default='', help='操作员名称 (用于报告)')
    
    args = parser.parse_args()
    
    service = FridgeMonitorService(args.config)
    
    if args.once:
        service.run_once()
    elif args.report:
        service.generate_report(args.shift, args.operator)
    else:
        service.start()


if __name__ == '__main__':
    main()
