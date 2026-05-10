#!/usr/bin/env python3
"""
启动合同履约保证金 API 服务
"""
import uvicorn
from app.main import app

if __name__ == "__main__":
    print("""
    ============================================================
    合同履约保证金 API 服务
    ============================================================
    
    API 文档地址:
    - Swagger UI:  http://127.0.0.1:8000/docs
    - ReDoc:       http://127.0.0.1:8000/redoc
    
    API 基础路径:  /api/v1
    
    主要模块:
    - /contracts     合同管理
    - /deposits      保证金管理（缴纳、释放、查询）
    - /penalties     扣罚审批
    - /release-conditions  释放条件
    - /tasks         后台任务管理
    
    健康检查:        /health
    
    使用方法:
    1. 先运行 python3 sample_data.py 初始化样例数据
    2. 然后运行此脚本启动服务
    3. 访问 http://127.0.0.1:8000/docs 查看 API 文档
    """)
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
