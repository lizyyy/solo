from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum
from datetime import datetime
import json
import os
import pandas as pd
from io import BytesIO

app = FastAPI(title="消息队列积压诊断系统")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATA_DIR, exist_ok=True)

class StatusEnum(str, Enum):
    SUCCESS = "success"
    PENDING_REVIEW = "pending_review"
    BLOCKED = "blocked"
    RETRYABLE = "retryable"

class RebalanceEvent(BaseModel):
    event_id: str
    timestamp: datetime
    consumer_group: str
    partitions: List[int]
    reason: str

class TopicPartitionData(BaseModel):
    topic: str
    partition: int
    consumer_group: str
    lag: int
    owner: str
    last_updated: datetime
    rebalance_events: List[RebalanceEvent] = []

class ValidationResult(BaseModel):
    status: StatusEnum
    message: str
    data: Optional[Dict[str, Any]] = None
    recommendations: List[str] = []

class RateLimitStrategy(BaseModel):
    strategy_id: str
    name: str
    consumer_group: str
    max_messages_per_second: int
    max_lag_threshold: int
    enabled: bool
    created_at: datetime
    created_by: str

class DiagnosisSuggestion(BaseModel):
    suggestion_id: str
    topic: str
    partition: Optional[int] = None
    consumer_group: str
    suggestion: str
    priority: str
    status: str
    created_at: datetime

def load_json(filename: str, default: Any):
    path = os.path.join(DATA_DIR, filename)
    if os.path.exists(path):
        with open(path, 'r') as f:
            return json.load(f)
    return default

def save_json(filename: str, data: Any):
    path = os.path.join(DATA_DIR, filename)
    with open(path, 'w') as f:
        json.dump(data, f, default=str, indent=2)

def validate_topic_partition(data: dict) -> ValidationResult:
    errors = []
    warnings = []
    recommendations = []
    
    if not data.get("topic"):
        errors.append("Topic名称不能为空")
    
    if data.get("partition") is None or data["partition"] < 0:
        errors.append("分区编号必须是非负整数")
    
    if not data.get("consumer_group"):
        errors.append("消费组不能为空")
    
    lag = data.get("lag", 0)
    if lag < 0:
        errors.append("积压量不能为负数")
    elif lag > 100000:
        warnings.append("积压量超过10万，需要紧急处理")
        recommendations.append("建议立即扩容消费者或检查消费逻辑")
    
    rebalance_count = len(data.get("rebalance_events", []))
    if rebalance_count > 5:
        warnings.append(f"检测到 {rebalance_count} 次重平衡事件，消费者可能不稳定")
        recommendations.append("建议检查消费者生命周期管理，避免频繁上下线")
    
    if errors:
        return ValidationResult(
            status=StatusEnum.BLOCKED,
            message="数据校验失败，已拦截",
            data={"errors": errors},
            recommendations=recommendations
        )
    
    if warnings:
        return ValidationResult(
            status=StatusEnum.PENDING_REVIEW,
            message="数据存在风险，待人工复核",
            data={"warnings": warnings, "input_data": data},
            recommendations=recommendations
        )
    
    if lag > 50000:
        return ValidationResult(
            status=StatusEnum.RETRYABLE,
            message="积压量较高，建议应用限速策略后重试",
            data=data,
            recommendations=["应用限速策略后再次提交"]
        )
    
    return ValidationResult(
        status=StatusEnum.SUCCESS,
        message="数据校验通过",
        data=data,
        recommendations=["监控观察"]
    )

@app.post("/api/validate", response_model=ValidationResult)
async def validate_endpoint(data: TopicPartitionData):
    result = validate_topic_partition(data.dict())
    history = load_json("validation_history.json", [])
    history.append({
        "timestamp": datetime.now().isoformat(),
        "input": data.dict(),
        "result": result.dict()
    })
    save_json("validation_history.json", history[-100:])
    return result

@app.get("/api/rate-limit-strategies")
async def get_rate_limit_strategies():
    return {"strategies": load_json("rate_limit_strategies.json", [])}

@app.post("/api/rate-limit-strategies")
async def create_rate_limit_strategy(strategy: RateLimitStrategy):
    strategies = load_json("rate_limit_strategies.json", [])
    strategies.append(strategy.dict())
    save_json("rate_limit_strategies.json", strategies)
    return {"message": "策略保存成功", "strategy": strategy}

@app.get("/api/diagnosis-suggestions")
async def get_diagnosis_suggestions():
    return {"suggestions": load_json("diagnosis_suggestions.json", [])}

@app.post("/api/diagnosis-suggestions")
async def create_diagnosis_suggestion(suggestion: DiagnosisSuggestion):
    suggestions = load_json("diagnosis_suggestions.json", [])
    suggestions.append(suggestion.dict())
    save_json("diagnosis_suggestions.json", suggestions)
    return {"message": "诊断建议保存成功", "suggestion": suggestion}

@app.get("/api/export")
async def export_data(
    group_by: str = Query("owner", description="分组方式: owner, time, lag")
):
    history = load_json("validation_history.json", [])
    if not history:
        raise HTTPException(status_code=404, detail="没有可导出的数据")
    
    df_data = []
    for item in history:
        input_data = item.get("input", {})
        result = item.get("result", {})
        df_data.append({
            "负责人": input_data.get("owner", "未分配"),
            "Topic": input_data.get("topic", ""),
            "分区": input_data.get("partition", 0),
            "消费组": input_data.get("consumer_group", ""),
            "积压量": input_data.get("lag", 0),
            "状态": result.get("status", ""),
            "时间": item.get("timestamp", "")
        })
    
    df = pd.DataFrame(df_data)
    
    if group_by == "owner":
        grouped = df.groupby("负责人").agg({
            "积压量": ["sum", "mean", "max"],
            "Topic": "count"
        }).reset_index()
        grouped.columns = ["负责人", "总积压量", "平均积压量", "最大积压量", "Topic数量"]
    elif group_by == "time":
        df["日期"] = pd.to_datetime(df["时间"]).dt.date
        grouped = df.groupby("日期").agg({
            "积压量": ["sum", "mean"],
            "Topic": "count"
        }).reset_index()
        grouped.columns = ["日期", "总积压量", "平均积压量", "记录数"]
    else:
        df["积压量级"] = pd.cut(df["积压量"], 
                                bins=[0, 1000, 10000, 50000, float("inf")],
                                labels=["0-1K", "1K-10K", "10K-50K", "50K+"])
        grouped = df.groupby("积压量级").agg({
            "积压量": ["count", "sum"],
            "负责人": lambda x: ", ".join(set(x))
        }).reset_index()
        grouped.columns = ["积压量级", "记录数", "总积压量", "负责人"]
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        grouped.to_excel(writer, sheet_name="分组统计", index=False)
        df.to_excel(writer, sheet_name="原始数据", index=False)
    
    output.seek(0)
    filename = f"mq_diagnosis_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    temp_path = os.path.join(DATA_DIR, filename)
    with open(temp_path, "wb") as f:
        f.write(output.getvalue())
    
    return FileResponse(temp_path, filename=filename)

@app.get("/api/sample-data")
async def get_sample_data(include_dirty: bool = True):
    samples = [
        {
            "name": "正常数据",
            "data": {
                "topic": "order-events",
                "partition": 0,
                "consumer_group": "order-processor",
                "lag": 1500,
                "owner": "张三",
                "last_updated": datetime.now().isoformat(),
                "rebalance_events": []
            },
            "expected": "success"
        },
        {
            "name": "高积压数据",
            "data": {
                "topic": "payment-events",
                "partition": 1,
                "consumer_group": "payment-processor",
                "lag": 75000,
                "owner": "李四",
                "last_updated": datetime.now().isoformat(),
                "rebalance_events": []
            },
            "expected": "retryable"
        },
        {
            "name": "频繁重平衡数据",
            "data": {
                "topic": "user-events",
                "partition": 2,
                "consumer_group": "user-processor",
                "lag": 8000,
                "owner": "王五",
                "last_updated": datetime.now().isoformat(),
                "rebalance_events": [
                    {"event_id": f"r{i}", "timestamp": datetime.now().isoformat(), 
                     "consumer_group": "user-processor", "partitions": [2], 
                     "reason": "消费者心跳超时"}
                    for i in range(6)
                ]
            },
            "expected": "pending_review"
        }
    ]
    
    if include_dirty:
        samples.extend([
            {
                "name": "脏数据-负积压量（已拦截）",
                "data": {
                    "topic": "test-events",
                    "partition": -1,
                    "consumer_group": "",
                    "lag": -500,
                    "owner": "",
                    "last_updated": datetime.now().isoformat(),
                    "rebalance_events": []
                },
                "expected": "blocked"
            },
            {
                "name": "脏数据-缺失关键字段（已拦截）",
                "data": {
                    "topic": "",
                    "partition": 0,
                    "consumer_group": "",
                    "lag": 100,
                    "owner": "",
                    "last_updated": datetime.now().isoformat(),
                    "rebalance_events": []
                },
                "expected": "blocked"
            }
        ])
    
    return {"samples": samples}

@app.get("/")
async def root():
    return {"message": "消息队列积压诊断系统 API", "docs": "/docs"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
