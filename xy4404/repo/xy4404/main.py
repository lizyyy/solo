import os
import sys
import logging
import time
import threading
import argparse
from datetime import datetime
from typing import Optional

from config import Config
from database import Database
from file_monitor import FileMonitor
from file_matcher import FileMatcher
from issue_detector import IssueDetector
from report_generator import ReportGenerator
from api import create_app

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class TheaterManager:
    def __init__(self):
        self.db = Database()
        self.matcher = FileMatcher(self.db)
        self.detector = IssueDetector(self.db)
        self.report_generator = ReportGenerator(self.db, self.detector)
        self.file_monitor: Optional[FileMonitor] = None
        self.flask_app = None
        self._running = False
        self._monitor_thread: Optional[threading.Thread] = None
    
    def _on_new_file(self, file_path: str):
        logger.info(f"处理新文件: {file_path}")
        result = self.matcher.process_file(file_path)
        if result['success']:
            logger.info(f"✓ {result['message']}")
        else:
            logger.warning(f"✗ {result['message']}")
    
    def start_monitor(self):
        if self.file_monitor and self.file_monitor._running:
            logger.warning("文件监听已在运行中")
            return
        
        self.file_monitor = FileMonitor(on_new_file=self._on_new_file)
        self.file_monitor.start()
        self._running = True
        
        def monitor_loop():
            while self._running:
                self.file_monitor.process_pending()
                time.sleep(Config.FILE_MONITOR_INTERVAL)
        
        self._monitor_thread = threading.Thread(target=monitor_loop, daemon=True)
        self._monitor_thread.start()
        
        logger.info(f"文件监听已启动，监听文件夹: {Config.MATERIALS_FOLDER}")
    
    def stop_monitor(self):
        self._running = False
        if self.file_monitor:
            self.file_monitor.stop()
        if self._monitor_thread:
            self._monitor_thread.join(timeout=5)
        logger.info("文件监听已停止")
    
    def start_api(self):
        self.flask_app = create_app(self.db, self.detector)
        
        def run_flask():
            self.flask_app.run(
                host=Config.FLASK_HOST,
                port=Config.FLASK_PORT,
                debug=Config.DEBUG,
                use_reloader=False
            )
        
        flask_thread = threading.Thread(target=run_flask, daemon=True)
        flask_thread.start()
        
        logger.info(f"API服务已启动: http://{Config.FLASK_HOST}:{Config.FLASK_PORT}")
    
    def generate_report(self, output_path: str = None) -> str:
        logger.info("生成交接报告...")
        report_path = self.report_generator.generate_report(output_path)
        logger.info(f"报告已生成: {report_path}")
        return report_path
    
    def scan_issues(self):
        logger.info("扫描所有问题...")
        results = self.detector.detect_all_issues()
        
        total_issues = sum(len(v) for v in results.values())
        logger.info(f"扫描完成，发现 {total_issues} 个问题")
        
        for issue_type, issues in results.items():
            if issues:
                logger.info(f"  - {issue_type}: {len(issues)} 个")
        
        return results
    
    def run(self, monitor: bool = True, api: bool = True):
        logger.info("=" * 50)
        logger.info("社区剧场演出录音管理系统启动")
        logger.info("=" * 50)
        
        if monitor:
            self.start_monitor()
        
        if api:
            self.start_api()
        
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("\n收到停止信号，正在关闭...")
            self.stop_monitor()
            logger.info("系统已停止")

def main():
    parser = argparse.ArgumentParser(
        description='社区剧场演出录音管理系统',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例用法:
  python main.py                    # 启动文件监听和API服务
  python main.py --monitor          # 仅启动文件监听
  python main.py --api              # 仅启动API服务
  python main.py --report           # 生成交接报告
  python main.py --scan             # 扫描所有问题
  python main.py --init-samples     # 初始化示例数据
        '''
    )
    
    parser.add_argument('--monitor', action='store_true', help='启动文件监听')
    parser.add_argument('--api', action='store_true', help='启动API服务')
    parser.add_argument('--report', action='store_true', help='生成交接报告')
    parser.add_argument('--scan', action='store_true', help='扫描所有问题')
    parser.add_argument('--init-samples', action='store_true', help='初始化示例数据')
    parser.add_argument('--output', '-o', type=str, help='报告输出路径')
    
    args = parser.parse_args()
    
    manager = TheaterManager()
    
    if args.init_samples:
        logger.info("初始化示例数据...")
        init_sample_data(manager)
        return
    
    if args.report:
        manager.generate_report(args.output)
        return
    
    if args.scan:
        manager.scan_issues()
        return
    
    if args.monitor or args.api or not any([args.monitor, args.api, args.report, args.scan]):
        run_monitor = args.monitor or not any([args.api, args.report, args.scan])
        run_api = args.api or not any([args.monitor, args.report, args.scan])
        
        if not args.monitor and not args.api:
            run_monitor = True
            run_api = True
        
        manager.run(monitor=run_monitor, api=run_api)

def init_sample_data(manager: TheaterManager):
    materials_dir = Config.MATERIALS_FOLDER
    if not os.path.exists(materials_dir):
        os.makedirs(materials_dir)
    
    from datetime import date, timedelta
    
    today = date.today()
    future_date = today + timedelta(days=25)
    soon_expire = today + timedelta(days=10)
    expired = today - timedelta(days=5)
    
    samples = [
        {
            'name': '20240115_雷雨',
            'audio': '20240115_雷雨_audio.mp3',
            'transcript': '20240115_雷雨_transcript.txt',
            'license': '20240115_雷雨_license.pdf',
            'license_content': f'''演出授权协议
演出名称：雷雨
授权类型：非商业授权
有效期：2024-01-15 至 {future_date.strftime('%Y-%m-%d')}
授权方：社区剧场
'''
        },
        {
            'name': '20240220_茶馆',
            'audio': '20240220_茶馆_audio.wav',
            'transcript': '20240220_茶馆_transcript.docx',
            'license': '20240220_茶馆_license.pdf',
            'license_content': f'''演出授权协议
演出名称：茶馆
授权类型：商业授权
有效期：2024-02-20 至 {soon_expire.strftime('%Y-%m-%d')}
授权方：社区剧场
'''
        },
        {
            'name': '20231205_日出',
            'audio': '20231205_日出_audio.flac',
            'transcript': None,
            'license': '20231205_日出_license.pdf',
            'license_content': f'''演出授权协议
演出名称：日出
授权类型：非商业授权
有效期：2023-12-05 至 {expired.strftime('%Y-%m-%d')}
授权方：社区剧场
'''
        },
        {
            'name': '20240310_原野',
            'audio': None,
            'transcript': '20240310_原野_transcript.txt',
            'license': None,
        },
    ]
    
    for sample in samples:
        perf_id = manager.db.get_or_create_performance(sample['name'])
        
        date_match = sample['name'][:8]
        if date_match.isdigit():
            perf_date = f"{date_match[:4]}-{date_match[4:6]}-{date_match[6:8]}"
            manager.db.update_performance_info(perf_id, performance_date=perf_date)
        
        if sample['audio']:
            audio_path = os.path.join(materials_dir, sample['audio'])
            with open(audio_path, 'w', encoding='utf-8') as f:
                f.write(f"示例音频文件: {sample['audio']}\n")
                f.write("这是一个模拟的音频文件，实际使用时应替换为真实音频。\n")
            manager._on_new_file(audio_path)
        
        if sample['transcript']:
            trans_path = os.path.join(materials_dir, sample['transcript'])
            with open(trans_path, 'w', encoding='utf-8') as f:
                f.write(f"示例转写稿: {sample['transcript']}\n\n")
                f.write("第一幕\n")
                f.write("人物：A、B\n")
                f.write("A：你好，欢迎来到我们的剧场。\n")
                f.write("B：谢谢，很高兴能来。\n\n")
                f.write("第二幕\n")
                f.write("...\n")
            manager._on_new_file(trans_path)
        
        if sample['license']:
            lic_path = os.path.join(materials_dir, sample['license'])
            content = sample.get('license_content', f"示例授权文件: {sample['license']}")
            with open(lic_path, 'w', encoding='utf-8') as f:
                f.write(content)
            manager._on_new_file(lic_path)
        
        if sample['name'] == '20240115_雷雨':
            manager.db.update_performance_info(perf_id, is_public=1)
        
        if sample['name'] == '20231205_日出':
            manager.db.update_performance_info(perf_id, is_public=1, needs_takedown=1)
    
    logger.info(f"示例数据已创建在: {materials_dir}")
    logger.info("已创建的示例演出:")
    for sample in samples:
        logger.info(f"  - {sample['name']}")

if __name__ == '__main__':
    main()
