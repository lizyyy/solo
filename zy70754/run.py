#!/usr/bin/env python3
import uvicorn
import sys

if __name__ == "__main__":
    print("启动许可证例外追踪系统...")
    print("API文档: http://localhost:8000/docs")
    print("健康检查: http://localhost:8000/health")
    uvicorn.run("license_tracker.main:app", host="0.0.0.0", port=8000, reload=True)
