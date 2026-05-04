from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json
import aiofiles
from pathlib import Path
from app.config import settings

router = APIRouter()


class CorpusItem(BaseModel):
    id: str
    text: str
    source: str
    category: str = "general"


class FineTuneSample(BaseModel):
    id: str
    prompt: str
    completion: str
    category: str = "general"


class InferenceRequestSample(BaseModel):
    id: str
    prompt: str
    expected_output: Optional[str] = None
    parameters: Dict[str, Any] = {}


SEED_DATA = {
    "corpus": [
        {
            "id": "seed-corpus-1",
            "text": "人工智能（Artificial Intelligence, AI）是计算机科学的一个分支，致力于创造能够执行通常需要人类智能的任务的系统。这些任务包括视觉感知、语音识别、决策制定和语言翻译等。",
            "source": "seed",
            "category": "ai-introduction"
        },
        {
            "id": "seed-corpus-2",
            "text": "Transformer 是一种基于自注意力机制的神经网络架构，由 Vaswani 等人于 2017 年在论文《Attention Is All You Need》中提出。它彻底改变了自然语言处理领域，并成为 GPT、BERT 等大型语言模型的基础。",
            "source": "seed",
            "category": "transformer"
        },
        {
            "id": "seed-corpus-3",
            "text": "GPT（Generative Pre-trained Transformer）是一系列基于 Transformer 架构的生成式预训练语言模型。GPT 使用自回归方式进行文本生成，每次预测下一个最可能的 token。",
            "source": "seed",
            "category": "gpt"
        },
        {
            "id": "seed-corpus-4",
            "text": "注意力机制（Attention Mechanism）允许模型在处理序列时动态地关注相关的部分。在自注意力（Self-Attention）中，模型计算序列中每个位置对其他所有位置的注意力权重，从而捕获长距离依赖关系。",
            "source": "seed",
            "category": "attention"
        },
        {
            "id": "seed-corpus-5",
            "text": "KV Cache（键值缓存）是一种优化技术，用于加速自回归模型的推理过程。通过缓存之前计算的 Key 和 Value 状态，避免在每次生成新 token 时重新计算整个序列的注意力，显著减少了计算量和延迟。",
            "source": "seed",
            "category": "optimization"
        }
    ],
    "finetune": [
        {
            "id": "seed-ft-1",
            "prompt": "请解释什么是 Transformer？",
            "completion": "Transformer 是一种基于自注意力机制的神经网络架构，由 Vaswani 等人于 2017 年提出。它主要用于序列到序列的任务，如机器翻译、文本摘要等。与传统的 RNN 和 LSTM 不同，Transformer 完全依赖注意力机制来捕获序列中的依赖关系，可以并行处理整个序列，大大提高了训练效率。",
            "category": "qa"
        },
        {
            "id": "seed-ft-2",
            "prompt": "GPT 模型的工作原理是什么？",
            "completion": "GPT（Generative Pre-trained Transformer）是一种基于 Transformer 解码器架构的生成式语言模型。其工作原理包括：1）预训练阶段：在大规模文本语料上进行自监督学习，预测下一个 token；2）微调阶段：在特定任务上进行监督学习；3）推理阶段：使用自回归方式，每次生成一个 token 并将其添加到输入中，继续生成下一个 token。",
            "category": "qa"
        },
        {
            "id": "seed-ft-3",
            "prompt": "写一首关于人工智能的短诗",
            "completion": "硅基之心跳动着代码的韵律，\n神经网络编织着智慧的纹理，\n从数据的海洋中汲取知识，\n在数字的空间里创造奇迹。\n\n不是人类，却能理解人类，\n不是生命，却能延续生命的智慧，\n这是人类智慧的延伸，\n是科技与想象力的交汇。",
            "category": "creative"
        }
    ],
    "inference": [
        {
            "id": "seed-inf-1",
            "prompt": "人工智能的未来发展趋势是什么？",
            "expected_output": "人工智能的未来发展趋势可能包括：更强大的通用人工智能、多模态融合、边缘 AI、AI 安全与伦理、自主系统等。",
            "parameters": {"max_new_tokens": 100, "temperature": 0.7}
        },
        {
            "id": "seed-inf-2",
            "prompt": "请简单说明注意力机制的作用",
            "expected_output": "注意力机制允许模型在处理序列时动态地关注最相关的部分，类似于人类在阅读时会重点关注某些关键词。它帮助模型捕获长距离依赖关系，提高了序列建模的能力。",
            "parameters": {"max_new_tokens": 50, "temperature": 0.3}
        }
    ],
    "edge_cases": [
        {
            "id": "edge-empty",
            "text": "",
            "description": "空文本输入"
        },
        {
            "id": "edge-whitespace",
            "text": "   \n\t\n   ",
            "description": "仅包含空白字符"
        },
        {
            "id": "edge-special",
            "text": "!@#$%^&*()_+{}[]|\\:;\"'<>?,./`~",
            "description": "仅包含特殊字符"
        },
        {
            "id": "edge-long",
            "text": "这是一段非常长的文本。" * 100,
            "description": "超长文本（用于测试上下文窗口截断）"
        },
        {
            "id": "edge-unicode",
            "text": "🌍🌎🌏 你好 こんにちは 안녕하세요 Hello Bonjour Hola",
            "description": "包含多种语言和 emoji 的混合文本"
        },
        {
            "id": "edge-numeric",
            "text": "1234567890 0987654321 3.1415926535 1e10 -42",
            "description": "数字和数值表达式"
        }
    ]
}


@router.get("/seed/corpus")
def get_seed_corpus():
    return {
        "success": True,
        "data": SEED_DATA["corpus"]
    }


@router.get("/seed/finetune")
def get_seed_finetune():
    return {
        "success": True,
        "data": SEED_DATA["finetune"]
    }


@router.get("/seed/inference")
def get_seed_inference():
    return {
        "success": True,
        "data": SEED_DATA["inference"]
    }


@router.get("/seed/edge-cases")
def get_edge_cases():
    return {
        "success": True,
        "data": SEED_DATA["edge_cases"]
    }


@router.get("/seed/all")
def get_all_seed_data():
    return {
        "success": True,
        "data": SEED_DATA
    }


@router.post("/corpus/import")
async def import_corpus(file: UploadFile = File(...)):
    try:
        content = await file.read()
        data = json.loads(content)
        
        if not isinstance(data, list):
            raise HTTPException(status_code=400, detail="JSON must be a list of corpus items")
        
        saved_count = 0
        for item in data:
            if "text" in item:
                item_id = item.get("id", f"imported-{saved_count}")
                file_path = settings.CORPUS_DIR / f"{item_id}.json"
                async with aiofiles.open(file_path, "w", encoding="utf-8") as f:
                    await f.write(json.dumps(item, ensure_ascii=False, indent=2))
                saved_count += 1
        
        return {
            "success": True,
            "data": {
                "imported_count": saved_count,
                "message": f"Successfully imported {saved_count} corpus items"
            }
        }
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.get("/corpus")
async def list_corpus():
    corpus_files = list(settings.CORPUS_DIR.glob("*.json"))
    corpus_list = []
    
    for file_path in corpus_files:
        async with aiofiles.open(file_path, "r", encoding="utf-8") as f:
            content = await f.read()
            try:
                item = json.loads(content)
                corpus_list.append(item)
            except json.JSONDecodeError:
                continue
    
    return {
        "success": True,
        "data": {
            "count": len(corpus_list),
            "items": corpus_list
        }
    }


@router.post("/finetune/import")
async def import_finetune(file: UploadFile = File(...)):
    try:
        content = await file.read()
        data = json.loads(content)
        
        if not isinstance(data, list):
            raise HTTPException(status_code=400, detail="JSON must be a list of finetune samples")
        
        saved_count = 0
        for item in data:
            if "prompt" in item and "completion" in item:
                item_id = item.get("id", f"finetune-{saved_count}")
                file_path = settings.FINE_TUNE_DIR / f"{item_id}.json"
                async with aiofiles.open(file_path, "w", encoding="utf-8") as f:
                    await f.write(json.dumps(item, ensure_ascii=False, indent=2))
                saved_count += 1
        
        return {
            "success": True,
            "data": {
                "imported_count": saved_count,
                "message": f"Successfully imported {saved_count} finetune samples"
            }
        }
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.get("/finetune")
async def list_finetune():
    finetune_files = list(settings.FINE_TUNE_DIR.glob("*.json"))
    finetune_list = []
    
    for file_path in finetune_files:
        async with aiofiles.open(file_path, "r", encoding="utf-8") as f:
            content = await f.read()
            try:
                item = json.loads(content)
                finetune_list.append(item)
            except json.JSONDecodeError:
                continue
    
    return {
        "success": True,
        "data": {
            "count": len(finetune_list),
            "items": finetune_list
        }
    }
