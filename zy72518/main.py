from fastapi import FastAPI
from database import engine, Base
from routers import todo_routes, workflow_routes, self_check_routes, security_routes

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="会议纪要待办抽取系统",
    description="处理脱敏规则备注与灰度批次冲突、人工改判追踪、安全审核复核的完整系统",
    version="1.0.0"
)

app.include_router(todo_routes.router)
app.include_router(workflow_routes.router)
app.include_router(self_check_routes.router)
app.include_router(security_routes.router)


@app.get("/")
def root():
    return {
        "name": "会议纪要待办抽取系统",
        "version": "1.0.0",
        "features": [
            "脱敏规则备注与灰度批次冲突检测",
            "基本自检：重复导入、人工改判被覆盖、补录重算、导出一致",
            "统一数据源：导出、页面、接口读同一份结果",
            "复核追踪：谁改了什么、为什么改、影响哪些结果",
            "三步流程：导入规则→小孟补看灰度批次→更新评测报告",
            "安全审核：人工改判被覆盖时留待安全审核"
        ],
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
