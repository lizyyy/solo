from app import create_app
from scheduler import BackgroundJobScheduler
import signal
import sys

app = create_app()
scheduler = BackgroundJobScheduler(app)

def signal_handler(sig, frame):
    print('\n正在关闭服务...')
    scheduler.stop()
    sys.exit(0)

if __name__ == '__main__':
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    print('=' * 60)
    print('采购询价比价服务')
    print('=' * 60)
    print('功能特性:')
    print('  - 询价单管理 (创建/发布/更新/取消)')
    print('  - 报价单管理 (创建/提交/修改/版本追踪)')
    print('  - 价税运费自动计算')
    print('  - 多供应商比价分析')
    print('  - 有效期自动校验')
    print('  - 中标建议与确定')
    print('  - Excel 导出 (比价表/报价单)')
    print('  - 操作日志与历史追溯')
    print('  - 后台任务与重试机制')
    print('=' * 60)
    
    scheduler.start()
    
    print('\n服务地址: http://localhost:5000')
    print('健康检查: http://localhost:5000/health')
    print('API 文档参考: 见 README.md')
    print('=' * 60)
    
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)
