#!/usr/bin/env python3
"""
物流面单代理 API 启动脚本
"""

import uvicorn

if __name__ == "__main__":
    print("=" * 50)
    print("物流面单代理 API 启动中...")
    print("=" * 50)
    print("首页地址: http://localhost:8000/")
    print("API 文档: http://localhost:8000/docs")
    print("=" * 50)
    print()
    
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
