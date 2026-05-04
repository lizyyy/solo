from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from app.core.tokenizer_service import tokenizer_service

router = APIRouter()


class TokenizeRequest(BaseModel):
    text: str
    use_hf: bool = True


class TruncateRequest(BaseModel):
    text: str
    max_tokens: int
    truncation_side: str = "right"


@router.post("/tokenize")
def tokenize(request: TokenizeRequest):
    try:
        result = tokenizer_service.tokenize(request.text, request.use_hf)
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tokenization failed: {str(e)}")


@router.post("/truncate")
def truncate(request: TruncateRequest):
    try:
        result = tokenizer_service.truncate(
            request.text,
            request.max_tokens,
            request.truncation_side
        )
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Truncation failed: {str(e)}")


@router.get("/vocab-size")
def get_vocab_size():
    return {
        "success": True,
        "data": {
            "vocab_size": tokenizer_service.get_vocab_size(),
            "tokenizer_available": tokenizer_service.use_hf
        }
    }


@router.post("/encode")
def encode(request: TokenizeRequest):
    try:
        tokenized = tokenizer_service.tokenize(request.text, request.use_hf)
        return {
            "success": True,
            "data": {
                "text": request.text,
                "token_ids": tokenized["token_ids"],
                "token_count": tokenized["token_count"]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Encoding failed: {str(e)}")
