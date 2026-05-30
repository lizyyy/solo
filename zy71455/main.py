from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import json
import uuid
from datetime import datetime
import pandas as pd
import io

from database import (
    get_db, init_db, OptionContract, PricingResult,
    SimulationPath, StatusHistory, PricingException
)
from pricing_engine import (
    MonteCarloPricer, PricingParameters, PricingErrorAnalyzer,
    format_exception_for_storage
)

app = FastAPI(
    title="蒙特卡洛期权定价讲解器",
    description="用于教学演示的期权定价服务，支持路径模拟、贴现分析、置信区间解释",
    version="1.0.0"
)

pricer = MonteCarloPricer()

class OptionImportRequest(BaseModel):
    contract_id: Optional[str] = None
    source_reference: str = Field(..., description="来源参考，用于追踪数据来源")
    option_type: str = Field(..., pattern="^(call|put)$")
    underlying_price: float = Field(..., gt=0)
    strike_price: float = Field(..., gt=0)
    risk_free_rate: float = Field(..., ge=0, le=1)
    volatility: float = Field(..., gt=0, le=5)
    maturity_days: int = Field(..., gt=0)
    dividend_yield: float = Field(default=0.0, ge=0, le=1)
    random_seed: Optional[int] = None
    num_simulations: int = Field(default=10000, ge=100)
    num_steps: int = Field(default=252, ge=1)
    notes: Optional[str] = None
    requires_manual_review: bool = False
    review_reason: Optional[str] = None

class BatchImportResponse(BaseModel):
    success_count: int
    failed_count: int
    imported_contracts: List[Dict[str, Any]]
    errors: List[Dict[str, Any]]

class PricingRequest(BaseModel):
    contract_id: str
    confidence_level: float = Field(default=0.95, ge=0.8, le=0.999)
    store_sample_paths: bool = Field(default=True, description="是否存储样本路径用于教学展示")
    sample_path_count: int = Field(default=100, description="存储的样本路径数量")
    apply_discount: bool = Field(default=True, description="是否应用贴现因子")

class StatusTransitionRequest(BaseModel):
    contract_id: str
    new_status: str
    transition_reason: str

@app.on_event("startup")
def startup_event():
    init_db()

def record_status_transition(db: Session, contract_id: int, from_status: str, to_status: str, reason: str):
    history = StatusHistory(
        contract_id=contract_id,
        from_status=from_status,
        to_status=to_status,
        transition_reason=reason
    )
    db.add(history)

def record_exception(db: Session, contract_id: int, e: Exception):
    exc_info = format_exception_for_storage(e)
    exception = PricingException(
        contract_id=contract_id,
        exception_type=exc_info["exception_type"],
        error_message=exc_info["error_message"],
        stack_trace=exc_info["stack_trace"],
        is_recoverable=exc_info["is_recoverable"]
    )
    db.add(exception)

@app.post("/api/import/single", response_model=Dict[str, Any])
def import_single_contract(request: OptionImportRequest, db: Session = Depends(get_db)):
    try:
        contract_id = request.contract_id or f"OPT-{uuid.uuid4().hex[:8].upper()}"
        
        existing = db.query(OptionContract).filter(OptionContract.contract_id == contract_id).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"合约 {contract_id} 已存在")
        
        contract = OptionContract(
            contract_id=contract_id,
            source_reference=request.source_reference,
            option_type=request.option_type,
            underlying_price=request.underlying_price,
            strike_price=request.strike_price,
            risk_free_rate=request.risk_free_rate,
            volatility=request.volatility,
            maturity_days=request.maturity_days,
            dividend_yield=request.dividend_yield,
            random_seed=request.random_seed,
            num_simulations=request.num_simulations,
            num_steps=request.num_steps,
            status="imported",
            notes=request.notes,
            requires_manual_review=request.requires_manual_review,
            review_reason=request.review_reason
        )
        db.add(contract)
        db.flush()
        
        record_status_transition(db, contract.id, "none", "imported", "数据导入")
        db.commit()
        db.refresh(contract)
        
        return {
            "success": True,
            "contract_id": contract.contract_id,
            "id": contract.id,
            "status": contract.status,
            "source_reference": contract.source_reference
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")

@app.post("/api/import/batch", response_model=BatchImportResponse)
def import_batch_contracts(requests: List[OptionImportRequest], db: Session = Depends(get_db)):
    success_count = 0
    failed_count = 0
    imported = []
    errors = []
    
    for idx, request in enumerate(requests):
        try:
            contract_id = request.contract_id or f"OPT-{uuid.uuid4().hex[:8].upper()}"
            
            existing = db.query(OptionContract).filter(OptionContract.contract_id == contract_id).first()
            if existing:
                raise ValueError(f"合约 {contract_id} 已存在")
            
            contract = OptionContract(
                contract_id=contract_id,
                source_reference=request.source_reference,
                option_type=request.option_type,
                underlying_price=request.underlying_price,
                strike_price=request.strike_price,
                risk_free_rate=request.risk_free_rate,
                volatility=request.volatility,
                maturity_days=request.maturity_days,
                dividend_yield=request.dividend_yield,
                random_seed=request.random_seed,
                num_simulations=request.num_simulations,
                num_steps=request.num_steps,
                status="imported",
                notes=request.notes,
                requires_manual_review=request.requires_manual_review,
                review_reason=request.review_reason
            )
            db.add(contract)
            db.flush()
            
            record_status_transition(db, contract.id, "none", "imported", f"批量导入 - 第{idx+1}条")
            db.commit()
            db.refresh(contract)
            
            success_count += 1
            imported.append({
                "contract_id": contract.contract_id,
                "id": contract.id,
                "source_reference": contract.source_reference
            })
        except Exception as e:
            db.rollback()
            failed_count += 1
            errors.append({
                "index": idx,
                "contract_id": request.contract_id,
                "error": str(e)
            })
    
    return BatchImportResponse(
        success_count=success_count,
        failed_count=failed_count,
        imported_contracts=imported,
        errors=errors
    )

@app.post("/api/import/csv")
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
        
        requests = []
        for _, row in df.iterrows():
            request = OptionImportRequest(
                contract_id=row.get("contract_id"),
                source_reference=row.get("source_reference", f"csv-{file.filename}"),
                option_type=row["option_type"].lower(),
                underlying_price=float(row["underlying_price"]),
                strike_price=float(row["strike_price"]),
                risk_free_rate=float(row["risk_free_rate"]),
                volatility=float(row["volatility"]),
                maturity_days=int(row["maturity_days"]),
                dividend_yield=float(row.get("dividend_yield", 0)),
                random_seed=int(row["random_seed"]) if pd.notna(row.get("random_seed")) else None,
                num_simulations=int(row.get("num_simulations", 10000)),
                num_steps=int(row.get("num_steps", 252)),
                notes=row.get("notes"),
                requires_manual_review=bool(row.get("requires_manual_review", False)),
                review_reason=row.get("review_reason")
            )
            requests.append(request)
        
        return import_batch_contracts(requests, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV解析失败: {str(e)}")

@app.post("/api/price/run", response_model=Dict[str, Any])
def run_pricing(request: PricingRequest, db: Session = Depends(get_db)):
    contract = db.query(OptionContract).filter(OptionContract.contract_id == request.contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail=f"合约 {request.contract_id} 不存在")
    
    try:
        old_status = contract.status
        contract.status = "processing"
        record_status_transition(db, contract.id, old_status, "processing", "开始定价计算")
        db.commit()
        
        params = PricingParameters(
            option_type=contract.option_type,
            S0=contract.underlying_price,
            K=contract.strike_price,
            r=contract.risk_free_rate,
            sigma=contract.volatility,
            T=contract.maturity_days / 365.0,
            q=contract.dividend_yield,
            seed=contract.random_seed,
            num_simulations=contract.num_simulations,
            num_steps=contract.num_steps,
            confidence_level=request.confidence_level,
            apply_discount=request.apply_discount
        )
        
        sim_result, stats_result = pricer.price(params, store_paths=request.store_sample_paths)
        
        pricing_result = PricingResult(
            contract_id=contract.id,
            option_price=stats_result.option_price,
            standard_error=stats_result.standard_error,
            confidence_level=stats_result.confidence_level,
            ci_lower=stats_result.ci_lower,
            ci_upper=stats_result.ci_upper,
            discount_factor=stats_result.discount_factor,
            expected_payoff=stats_result.expected_payoff,
            variance=stats_result.variance,
            skewness=stats_result.skewness,
            kurtosis=stats_result.kurtosis,
            calculation_time_ms=sim_result.calculation_time_ms,
            actual_random_seed=sim_result.actual_seed,
            discount_method=stats_result.discount_method
        )
        db.add(pricing_result)
        
        if request.store_sample_paths and sim_result.paths is not None:
            sample_count = min(request.sample_path_count, contract.num_simulations)
            for i in range(sample_count):
                path_data = json.dumps(sim_result.paths[i].tolist())
                sim_path = SimulationPath(
                    contract_id=contract.id,
                    path_index=i,
                    final_price=float(sim_result.final_prices[i]),
                    payoff=float(sim_result.payoffs[i]),
                    discounted_payoff=float(sim_result.discounted_payoffs[i]),
                    path_data=path_data
                )
                db.add(sim_path)
        
        error_analysis = PricingErrorAnalyzer.analyze_error_sources(params, stats_result)
        discount_check = PricingErrorAnalyzer.check_missing_discount(params)
        ci_interpretation = PricingErrorAnalyzer.check_confidence_interval_interpretation(
            stats_result.ci_lower, stats_result.ci_upper, stats_result.confidence_level
        )
        
        contract.status = "completed"
        record_status_transition(db, contract.id, "processing", "completed", "定价计算完成")
        db.commit()
        
        return {
            "success": True,
            "contract_id": contract.contract_id,
            "pricing_result": {
                "option_price": stats_result.option_price,
                "standard_error": stats_result.standard_error,
                "confidence_interval": [stats_result.ci_lower, stats_result.ci_upper],
                "confidence_level": stats_result.confidence_level,
                "discount_factor": stats_result.discount_factor,
                "actual_seed": sim_result.actual_seed,
                "calculation_time_ms": sim_result.calculation_time_ms
            },
            "error_analysis": error_analysis,
            "discount_check": discount_check,
            "confidence_interval_interpretation": ci_interpretation
        }
        
    except Exception as e:
        db.rollback()
        contract.status = "failed"
        record_exception(db, contract.id, e)
        record_status_transition(db, contract.id, "processing", "failed", f"定价失败: {str(e)}")
        db.commit()
        raise HTTPException(status_code=500, detail=f"定价失败: {str(e)}")

@app.get("/api/contracts", response_model=List[Dict[str, Any]])
def list_contracts(
    status: Optional[str] = None,
    source_reference: Optional[str] = None,
    requires_review: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(OptionContract)
    
    if status:
        query = query.filter(OptionContract.status == status)
    if source_reference:
        query = query.filter(OptionContract.source_reference.contains(source_reference))
    if requires_review is not None:
        query = query.filter(OptionContract.requires_manual_review == requires_review)
    
    contracts = query.offset(skip).limit(limit).all()
    
    return [
        {
            "id": c.id,
            "contract_id": c.contract_id,
            "source_reference": c.source_reference,
            "option_type": c.option_type,
            "underlying_price": c.underlying_price,
            "strike_price": c.strike_price,
            "maturity_days": c.maturity_days,
            "status": c.status,
            "requires_manual_review": c.requires_manual_review,
            "review_reason": c.review_reason,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat()
        }
        for c in contracts
    ]

@app.get("/api/contracts/{contract_id}", response_model=Dict[str, Any])
def get_contract_detail(contract_id: str, db: Session = Depends(get_db)):
    contract = db.query(OptionContract).filter(OptionContract.contract_id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail=f"合约 {contract_id} 不存在")
    
    latest_result = db.query(PricingResult).filter(
        PricingResult.contract_id == contract.id
    ).order_by(PricingResult.created_at.desc()).first()
    
    status_history = db.query(StatusHistory).filter(
        StatusHistory.contract_id == contract.id
    ).order_by(StatusHistory.created_at).all()
    
    exceptions = db.query(PricingException).filter(
        PricingException.contract_id == contract.id
    ).order_by(PricingException.created_at.desc()).all()
    
    return {
        "contract": {
            "id": contract.id,
            "contract_id": contract.contract_id,
            "source_reference": contract.source_reference,
            "option_type": contract.option_type,
            "underlying_price": contract.underlying_price,
            "strike_price": contract.strike_price,
            "risk_free_rate": contract.risk_free_rate,
            "volatility": contract.volatility,
            "maturity_days": contract.maturity_days,
            "dividend_yield": contract.dividend_yield,
            "random_seed": contract.random_seed,
            "num_simulations": contract.num_simulations,
            "num_steps": contract.num_steps,
            "status": contract.status,
            "notes": contract.notes,
            "requires_manual_review": contract.requires_manual_review,
            "review_reason": contract.review_reason,
            "created_at": contract.created_at.isoformat()
        },
        "latest_pricing_result": {
            "option_price": latest_result.option_price,
            "standard_error": latest_result.standard_error,
            "confidence_interval": [latest_result.ci_lower, latest_result.ci_upper],
            "confidence_level": latest_result.confidence_level,
            "discount_factor": latest_result.discount_factor,
            "actual_seed": latest_result.actual_random_seed,
            "calculation_time_ms": latest_result.calculation_time_ms,
            "created_at": latest_result.created_at.isoformat()
        } if latest_result else None,
        "status_history": [
            {
                "from_status": h.from_status,
                "to_status": h.to_status,
                "reason": h.transition_reason,
                "timestamp": h.created_at.isoformat()
            }
            for h in status_history
        ],
        "exceptions": [
            {
                "type": e.exception_type,
                "message": e.error_message,
                "is_recoverable": e.is_recoverable,
                "timestamp": e.created_at.isoformat()
            }
            for e in exceptions
        ]
    }

@app.get("/api/contracts/{contract_id}/paths", response_model=Dict[str, Any])
def get_simulation_paths(
    contract_id: str,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    contract = db.query(OptionContract).filter(OptionContract.contract_id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail=f"合约 {contract_id} 不存在")
    
    paths = db.query(SimulationPath).filter(
        SimulationPath.contract_id == contract.id
    ).order_by(SimulationPath.path_index).limit(limit).all()
    
    return {
        "contract_id": contract.contract_id,
        "option_type": contract.option_type,
        "strike_price": contract.strike_price,
        "num_paths_stored": len(paths),
        "paths": [
            {
                "path_index": p.path_index,
                "final_price": p.final_price,
                "payoff": p.payoff,
                "discounted_payoff": p.discounted_payoff,
                "path": json.loads(p.path_data)
            }
            for p in paths
        ],
        "payoff_analysis": {
            "mean_payoff": sum(p.payoff for p in paths) / len(paths) if paths else 0,
            "positive_payoff_count": sum(1 for p in paths if p.payoff > 0),
            "positive_payoff_ratio": sum(1 for p in paths if p.payoff > 0) / len(paths) if paths else 0
        }
    }

@app.get("/api/contracts/{contract_id}/error-analysis", response_model=Dict[str, Any])
def get_error_analysis(contract_id: str, db: Session = Depends(get_db)):
    contract = db.query(OptionContract).filter(OptionContract.contract_id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail=f"合约 {contract_id} 不存在")
    
    latest_result = db.query(PricingResult).filter(
        PricingResult.contract_id == contract.id
    ).order_by(PricingResult.created_at.desc()).first()
    
    if not latest_result:
        raise HTTPException(status_code=400, detail="该合约尚未进行定价计算")
    
    params = PricingParameters(
        option_type=contract.option_type,
        S0=contract.underlying_price,
        K=contract.strike_price,
        r=contract.risk_free_rate,
        sigma=contract.volatility,
        T=contract.maturity_days / 365.0,
        q=contract.dividend_yield,
        seed=contract.random_seed,
        num_simulations=contract.num_simulations,
        num_steps=contract.num_steps
    )
    
    class StatsProxy:
        def __init__(self, r):
            self.option_price = r.option_price
            self.standard_error = r.standard_error
            self.ci_lower = r.ci_lower
            self.ci_upper = r.ci_upper
    
    stats_proxy = StatsProxy(latest_result)
    
    error_analysis = PricingErrorAnalyzer.analyze_error_sources(params, stats_proxy)
    ci_interpretation = PricingErrorAnalyzer.check_confidence_interval_interpretation(
        latest_result.ci_lower, latest_result.ci_upper, latest_result.confidence_level
    )
    
    return {
        "contract_id": contract.contract_id,
        "error_analysis": error_analysis,
        "confidence_interval_interpretation": ci_interpretation,
        "result_statistics": {
            "option_price": latest_result.option_price,
            "variance": latest_result.variance,
            "skewness": latest_result.skewness,
            "kurtosis": latest_result.kurtosis
        },
        "teaching_notes": {
            "random_seed_effect": f"本次使用种子: {latest_result.actual_random_seed}。改变种子会得到不同但相近的价格，这是蒙特卡洛方法的本质。",
            "discount_effect": f"贴现因子: {latest_result.discount_factor:.6f}。将到期收益转换为现值。",
            "ci_meaning": "置信区间描述的是方法的可靠性，不是单次结果的概率。"
        }
    }

@app.post("/api/contracts/{contract_id}/status", response_model=Dict[str, Any])
def update_contract_status(request: StatusTransitionRequest, db: Session = Depends(get_db)):
    contract = db.query(OptionContract).filter(OptionContract.contract_id == request.contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail=f"合约 {request.contract_id} 不存在")
    
    old_status = contract.status
    contract.status = request.new_status
    record_status_transition(db, contract.id, old_status, request.new_status, request.transition_reason)
    db.commit()
    
    return {
        "success": True,
        "contract_id": contract.contract_id,
        "old_status": old_status,
        "new_status": request.new_status
    }

@app.get("/api/export/{contract_id}")
def export_contract_result(contract_id: str, format: str = "json", db: Session = Depends(get_db)):
    contract = db.query(OptionContract).filter(OptionContract.contract_id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail=f"合约 {contract_id} 不存在")
    
    latest_result = db.query(PricingResult).filter(
        PricingResult.contract_id == contract.id
    ).order_by(PricingResult.created_at.desc()).first()
    
    paths = db.query(SimulationPath).filter(
        SimulationPath.contract_id == contract.id
    ).order_by(SimulationPath.path_index).all()
    
    status_history = db.query(StatusHistory).filter(
        StatusHistory.contract_id == contract.id
    ).order_by(StatusHistory.created_at).all()
    
    export_data = {
        "export_metadata": {
            "export_time": datetime.utcnow().isoformat(),
            "contract_id": contract.contract_id,
            "source_reference": contract.source_reference
        },
        "contract_parameters": {
            "option_type": contract.option_type,
            "underlying_price": contract.underlying_price,
            "strike_price": contract.strike_price,
            "risk_free_rate": contract.risk_free_rate,
            "volatility": contract.volatility,
            "maturity_days": contract.maturity_days,
            "dividend_yield": contract.dividend_yield,
            "random_seed": contract.random_seed,
            "num_simulations": contract.num_simulations,
            "num_steps": contract.num_steps
        },
        "pricing_result": {
            "option_price": latest_result.option_price if latest_result else None,
            "standard_error": latest_result.standard_error if latest_result else None,
            "confidence_level": latest_result.confidence_level if latest_result else None,
            "confidence_interval": [latest_result.ci_lower, latest_result.ci_upper] if latest_result else None,
            "discount_factor": latest_result.discount_factor if latest_result else None,
            "actual_random_seed": latest_result.actual_random_seed if latest_result else None,
            "discount_method": latest_result.discount_method if latest_result else None
        } if latest_result else None,
        "simulation_summary": {
            "num_paths_stored": len(paths),
            "mean_final_price": sum(p.final_price for p in paths) / len(paths) if paths else None,
            "mean_payoff": sum(p.payoff for p in paths) / len(paths) if paths else None
        },
        "status_trail": [
            {
                "from": h.from_status,
                "to": h.to_status,
                "reason": h.transition_reason,
                "time": h.created_at.isoformat()
            }
            for h in status_history
        ],
        "calculation_methodology": {
            "price_formula": "E[max(S_T - K, 0)] * exp(-rT) for call",
            "simulation_method": "Geometric Brownian Motion",
            "ci_method": "Normal approximation interval",
            "discount_method": "Continuous compounding"
        }
    }
    
    if format == "json":
        return JSONResponse(content=export_data)
    elif format == "csv":
        df = pd.DataFrame([{
            "contract_id": contract.contract_id,
            "source_reference": contract.source_reference,
            "option_type": contract.option_type,
            "underlying_price": contract.underlying_price,
            "strike_price": contract.strike_price,
            "risk_free_rate": contract.risk_free_rate,
            "volatility": contract.volatility,
            "maturity_days": contract.maturity_days,
            "option_price": latest_result.option_price if latest_result else None,
            "standard_error": latest_result.standard_error if latest_result else None,
            "ci_lower": latest_result.ci_lower if latest_result else None,
            "ci_upper": latest_result.ci_upper if latest_result else None,
            "actual_seed": latest_result.actual_random_seed if latest_result else None,
            "status": contract.status
        }])
        return df.to_csv(index=False)
    else:
        raise HTTPException(status_code=400, detail="不支持的导出格式")

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "蒙特卡洛期权定价讲解器"}
