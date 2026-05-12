from app import create_app

app = create_app()

if __name__ == '__main__':
    print("=" * 60)
    print("养老院用药提醒 API 服务启动中...")
    print("=" * 60)
    print(f"本地访问地址: http://127.0.0.1:5000")
    print(f"健康检查: http://127.0.0.1:5000/health")
    print(f"API文档入口: http://127.0.0.1:5000/")
    print("=" * 60)
    print("主要功能模块:")
    print("  - 老人档案管理: /api/residents")
    print("  - 医嘱管理: /api/prescriptions")
    print("  - 用药计划与确认: /api/medications")
    print("  - 护理员管理: /api/nurses")
    print("  - 库存管理: /api/inventory")
    print("  - 交接班管理: /api/handovers")
    print("  - 异常处理: /api/exceptions")
    print("  - 报告导出: /api/reports")
    print("=" * 60)
    print("运行演示脚本: python demo.py")
    print("=" * 60)
    
    app.run(host='127.0.0.1', port=5000, debug=True)
