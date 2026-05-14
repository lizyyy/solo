from fastapi import APIRouter
from models import MaskingConfig
from masking_engine import masking_engine

router = APIRouter()

@router.post("/preview")
async def preview_masking(value: str, config: MaskingConfig):
    masked_value = masking_engine.apply_mask(value, config)
    return {
        "original": value,
        "masked": masked_value,
        "strategy": config.strategy
    }

@router.get("/strategies")
async def get_strategies():
    return [
        {"id": "mask", "name": "掩码替换", "description": "用指定字符掩盖部分内容"},
        {"id": "replace", "name": "完全替换", "description": "用固定字符串替换全部内容"},
        {"id": "hash", "name": "哈希处理", "description": "对内容进行不可逆哈希"},
        {"id": "truncate", "name": "截断处理", "description": "截断过长的内容"},
        {"id": "encrypt", "name": "加密处理", "description": "对内容进行可逆加密"},
        {"id": "none", "name": "不处理", "description": "保留原始内容"}
    ]
