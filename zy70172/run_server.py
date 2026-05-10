import sys
from pathlib import Path

src_path = Path(__file__).parent / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))

from data_retraction_service.api import create_app
from data_retraction_service.database import init_db
from data_retraction_service.sample_data import init_sample_data


def main():
    print("=" * 60)
    print("    训练数据撤回服务 (Training Data Retraction Service)")
    print("=" * 60)
    
    print("\n📦 初始化数据库...")
    init_db()
    
    print("📊 加载样例数据...")
    sample_data = init_sample_data()
    
    print(f"""
✅ 系统就绪

样例数据概览:
  - 用户: {len(sample_data['users'])} 个
  - 数据集: {len(sample_data['datasets'])} 个
  - 特征: {len(sample_data['features'])} 个
  - 数据记录: {len(sample_data['records'])} 条
  - 模型: {len(sample_data['models'])} 个
  - 规则: 7 条标准规则

快速开始:
  1. 使用 CLI: python -m data_retraction_service.cli --help
  2. 运行所有测试: python -m data_retraction_service.cli run-all
  3. 启动 API 服务器: python run_server.py
""")
    
    app = create_app()
    
    print("🚀 启动 Web 服务器...")
    print("""
可用端点:
  GET  /health                      健康检查
  POST /api/requests                提交撤回申请
  GET  /api/requests/<id>           查询申请状态
  POST /api/requests/<id>/approve   批准申请
  POST /api/requests/<id>/execute   执行已批准的申请
  GET  /api/requests/<id>/impacts   查询模型影响
  GET  /api/requests/<id>/receipts  查询执行回执
  GET  /api/requests/<id>/reports   查询合规报告
  GET  /api/test/scenarios          列出测试场景
  GET  /api/users/<id>/requests     查询用户的申请历史
""")
    
    app.run(host="127.0.0.1", port=5000, debug=True)


if __name__ == "__main__":
    main()
