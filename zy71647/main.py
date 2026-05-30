from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse
from datetime import datetime
from typing import Dict
import uuid

from models import (
    AllocationRequest, AllocationReport, DiffExplainRequest, 
    DiffExplainResponse, WalletType
)
from reward_allocator import RewardAllocator
from diff_explainer import DiffExplainer
from report_exporter import ReportExporter
from wallet_validator import WalletValidator

app = FastAPI(
    title="矿池收益分配试算系统",
    description="Web3矿池收益分配试算后端 - 支持算力加权、时间加权、手续费分摊、异常处理、差异解释",
    version="1.0.0"
)

report_store: Dict[str, AllocationReport] = {}


@app.get("/", tags=["系统"])
async def root():
    return {
        "name": "矿池收益分配试算系统",
        "version": "1.0.0",
        "endpoints": {
            "POST /allocate": "执行收益分配计算",
            "GET /report/{report_id}": "获取分配报告",
            "GET /report/{report_id}/csv": "导出CSV格式报告",
            "POST /explain-diff": "差额解释",
            "POST /validate-wallet": "钱包地址校验",
            "GET /demo/{scenario}": "获取演示数据"
        }
    }


@app.post("/allocate", response_model=AllocationReport, tags=["分配"])
async def allocate_rewards(request: AllocationRequest):
    allocator = RewardAllocator()
    report = allocator.allocate(request)
    
    report_store[report.report_id] = report
    
    return report


@app.get("/report/{report_id}", tags=["报告"])
async def get_report(report_id: str):
    if report_id not in report_store:
        raise HTTPException(status_code=404, detail=f"报告 {report_id} 不存在")
    
    return report_store[report_id]


@app.get("/report/{report_id}/csv", response_class=PlainTextResponse, tags=["报告"])
async def export_report_csv(report_id: str):
    if report_id not in report_store:
        raise HTTPException(status_code=404, detail=f"报告 {report_id} 不存在")
    
    report = report_store[report_id]
    csv_content = ReportExporter.to_csv(report)
    
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=allocation_report_{report_id}.csv"}
    )


@app.post("/explain-diff", response_model=DiffExplainResponse, tags=["分析"])
async def explain_difference(request: DiffExplainRequest):
    if request.report_id not in report_store:
        raise HTTPException(status_code=404, detail=f"报告 {request.report_id} 不存在")
    
    report = report_store[request.report_id]
    return DiffExplainer.explain_diff(request, report)


@app.post("/validate-wallet", tags=["工具"])
async def validate_wallet(address: str, wallet_type: WalletType):
    is_valid, message = WalletValidator.validate_address(address, wallet_type)
    return {
        "valid": is_valid,
        "wallet_type": wallet_type,
        "address": address,
        "message": message
    }


@app.get("/demo/{scenario}", tags=["演示"])
async def get_demo_data(scenario: str):
    base_time = datetime(2024, 1, 15, 0, 0, 0)
    
    if scenario == "normal":
        return {
            "description": "顺利流程 - 3个矿工正常挖矿，无异常",
            "data": get_normal_scenario(base_time)
        }
    elif scenario == "boundary":
        return {
            "description": "边界情况 - 包含低在线率、重复算力",
            "data": get_boundary_scenario(base_time)
        }
    elif scenario == "exception":
        return {
            "description": "异常案例 - 包含无效钱包、负手续费、未知矿工",
            "data": get_exception_scenario(base_time)
        }
    else:
        raise HTTPException(
            status_code=400, 
            detail="无效的场景类型，请使用: normal, boundary, exception"
        )


def get_normal_scenario(base_time):
    return {
        "miners": [
            {
                "miner_id": "miner_001",
                "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f5bB12",
                "wallet_type": "ETH",
                "miner_name": "矿工小王"
            },
            {
                "miner_id": "miner_002",
                "wallet_address": "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
                "wallet_type": "ETH",
                "miner_name": "矿工小李"
            },
            {
                "miner_id": "miner_003",
                "wallet_address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
                "wallet_type": "BTC",
                "miner_name": "矿工老张"
            }
        ],
        "hashrate_records": [
            {"miner_id": "miner_001", "hashrate": 100.0, "timestamp": base_time.isoformat(), "source": "pool_api"},
            {"miner_id": "miner_001", "hashrate": 105.0, "timestamp": (base_time.replace(hour=6)).isoformat(), "source": "pool_api"},
            {"miner_id": "miner_001", "hashrate": 98.0, "timestamp": (base_time.replace(hour=12)).isoformat(), "source": "pool_api"},
            {"miner_id": "miner_001", "hashrate": 102.0, "timestamp": (base_time.replace(hour=18)).isoformat(), "source": "pool_api"},
            {"miner_id": "miner_002", "hashrate": 200.0, "timestamp": base_time.isoformat(), "source": "pool_api"},
            {"miner_id": "miner_002", "hashrate": 195.0, "timestamp": (base_time.replace(hour=12)).isoformat(), "source": "pool_api"},
            {"miner_id": "miner_003", "hashrate": 50.0, "timestamp": base_time.isoformat(), "source": "pool_api"},
            {"miner_id": "miner_003", "hashrate": 55.0, "timestamp": (base_time.replace(hour=12)).isoformat(), "source": "pool_api"}
        ],
        "online_records": [
            {"miner_id": "miner_001", "start_time": base_time.isoformat(), "end_time": None, "is_online": True},
            {"miner_id": "miner_002", "start_time": base_time.isoformat(), "end_time": None, "is_online": True},
            {"miner_id": "miner_003", "start_time": base_time.isoformat(), "end_time": None, "is_online": True}
        ],
        "block_rewards": [
            {"block_number": 19000000, "reward_amount": 2.0, "fee_amount": 0.05, "timestamp": base_time.isoformat(), "coin_type": "ETH"},
            {"block_number": 19000012, "reward_amount": 2.0, "fee_amount": 0.08, "timestamp": (base_time.replace(hour=8)).isoformat(), "coin_type": "ETH"},
            {"block_number": 19000025, "reward_amount": 2.0, "fee_amount": 0.03, "timestamp": (base_time.replace(hour=16)).isoformat(), "coin_type": "ETH"}
        ],
        "period_start": base_time.isoformat(),
        "period_end": (base_time.replace(day=16)).isoformat(),
        "pool_fee_ratio": 0.02
    }


def get_boundary_scenario(base_time):
    return {
        "miners": [
            {
                "miner_id": "miner_001",
                "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f5bB12",
                "wallet_type": "ETH",
                "miner_name": "矿工小王（全在线）"
            },
            {
                "miner_id": "miner_002",
                "wallet_address": "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
                "wallet_type": "ETH",
                "miner_name": "矿工小李（低在线率）"
            },
            {
                "miner_id": "miner_003",
                "wallet_address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
                "wallet_type": "BTC",
                "miner_name": "矿工老张（重复算力）"
            }
        ],
        "hashrate_records": [
            {"miner_id": "miner_001", "hashrate": 100.0, "timestamp": base_time.isoformat(), "source": "pool_api"},
            {"miner_id": "miner_001", "hashrate": 100.0, "timestamp": (base_time.replace(hour=12)).isoformat(), "source": "pool_api"},
            {"miner_id": "miner_002", "hashrate": 200.0, "timestamp": base_time.isoformat(), "source": "pool_api"},
            {"miner_id": "miner_003", "hashrate": 50.0, "timestamp": base_time.isoformat(), "source": "pool_api"},
            {"miner_id": "miner_003", "hashrate": 50.0, "timestamp": base_time.isoformat(), "source": "backup_api"},
            {"miner_id": "miner_003", "hashrate": 50.0, "timestamp": (base_time.replace(hour=12)).isoformat(), "source": "pool_api"}
        ],
        "online_records": [
            {"miner_id": "miner_001", "start_time": base_time.isoformat(), "end_time": None, "is_online": True},
            {"miner_id": "miner_002", "start_time": base_time.isoformat(), "end_time": (base_time.replace(hour=12)).isoformat(), "is_online": False},
            {"miner_id": "miner_003", "start_time": base_time.isoformat(), "end_time": None, "is_online": True}
        ],
        "block_rewards": [
            {"block_number": 19000000, "reward_amount": 2.0, "fee_amount": 0.05, "timestamp": base_time.isoformat(), "coin_type": "ETH"}
        ],
        "period_start": base_time.isoformat(),
        "period_end": (base_time.replace(day=16)).isoformat(),
        "pool_fee_ratio": 0.02
    }


def get_exception_scenario(base_time):
    return {
        "miners": [
            {
                "miner_id": "miner_001",
                "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f5bB12",
                "wallet_type": "ETH",
                "miner_name": "正常矿工"
            },
            {
                "miner_id": "miner_002",
                "wallet_address": "INVALID_ADDRESS_123",
                "wallet_type": "ETH",
                "miner_name": "无效钱包矿工"
            },
            {
                "miner_id": "miner_003",
                "wallet_address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
                "wallet_type": "BTC",
                "miner_name": "无在线记录矿工"
            }
        ],
        "hashrate_records": [
            {"miner_id": "miner_001", "hashrate": 100.0, "timestamp": base_time.isoformat(), "source": "pool_api"},
            {"miner_id": "miner_002", "hashrate": 200.0, "timestamp": base_time.isoformat(), "source": "pool_api"},
            {"miner_id": "miner_003", "hashrate": 50.0, "timestamp": base_time.isoformat(), "source": "pool_api"},
            {"miner_id": "miner_999", "hashrate": 999.0, "timestamp": base_time.isoformat(), "source": "unknown"}
        ],
        "online_records": [
            {"miner_id": "miner_001", "start_time": base_time.isoformat(), "end_time": None, "is_online": True},
            {"miner_id": "miner_002", "start_time": base_time.isoformat(), "end_time": None, "is_online": True}
        ],
        "block_rewards": [
            {"block_number": 19000000, "reward_amount": 2.0, "fee_amount": -0.05, "timestamp": base_time.isoformat(), "coin_type": "ETH"}
        ],
        "period_start": base_time.isoformat(),
        "period_end": (base_time.replace(day=16)).isoformat(),
        "pool_fee_ratio": 0.02
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
