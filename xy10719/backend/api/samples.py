from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List, Optional
from models import SampleData, SampleStatus, MaskingConfig, MaskingStrategy
from store import store
from masking_engine import masking_engine
import uuid
from datetime import datetime
import pandas as pd
import io

router = APIRouter()

@router.get("/", response_model=List[SampleData])
async def get_samples(status: Optional[SampleStatus] = None, search: Optional[str] = None):
    samples = list(store.samples.values())
    if status:
        samples = [s for s in samples if s.status == status]
    if search:
        search_lower = search.lower()
        samples = [s for s in samples if search_lower in s.field_name.lower() or search_lower in s.original_value.lower()]
    return sorted(samples, key=lambda x: x.created_at, reverse=True)

@router.get("/{sample_id}", response_model=SampleData)
async def get_sample(sample_id: str):
    if sample_id not in store.samples:
        raise HTTPException(status_code=404, detail="样例数据不存在")
    return store.samples[sample_id]

@router.post("/", response_model=SampleData)
async def create_sample(sample: SampleData):
    sample.id = str(uuid.uuid4())
    sample.created_at = datetime.now()
    sample.status = SampleStatus.PENDING
    store.samples[sample.id] = sample
    return sample

@router.post("/upload")
async def upload_samples(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        if file.filename.endswith('.xlsx'):
            df = pd.read_excel(io.BytesIO(contents))
        elif file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail="不支持的文件格式")
        
        created_count = 0
        for _, row in df.iterrows():
            sample = SampleData(
                id=str(uuid.uuid4()),
                field_name=str(row.get('字段名', row.get('field_name', '未命名字段'))),
                field_type=str(row.get('字段类型', row.get('field_type', 'general'))),
                original_value=str(row.get('原始值', row.get('original_value', '')))
            )
            store.samples[sample.id] = sample
            created_count += 1
        
        return {"message": f"成功上传 {created_count} 条样例数据", "count": created_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件处理失败: {str(e)}")

@router.post("/{sample_id}/process", response_model=SampleData)
async def process_sample(sample_id: str, config: MaskingConfig):
    if sample_id not in store.samples:
        raise HTTPException(status_code=404, detail="样例数据不存在")
    
    sample = store.samples[sample_id]
    sample.status = SampleStatus.PROCESSING
    
    is_valid, error_msg = masking_engine.validate_field(sample.original_value, sample.field_type)
    
    if not is_valid:
        sample.status = SampleStatus.FAILED
        sample.error_message = error_msg
        sample.is_dirty = True
    elif sample.field_type in ['id_card', 'bank_card'] and len(sample.original_value) > 10:
        sample.status = SampleStatus.NEEDS_APPROVAL
        sample.masked_value = masking_engine.apply_mask(sample.original_value, config)
    else:
        sample.status = SampleStatus.SUCCESS
        sample.masked_value = masking_engine.apply_mask(sample.original_value, config)
        sample.error_message = None
    
    sample.processed_at = datetime.now()
    sample.processed_by = "system"
    sample.strategy = config.strategy
    
    return sample

@router.post("/{sample_id}/retry", response_model=SampleData)
async def retry_sample(sample_id: str):
    if sample_id not in store.samples:
        raise HTTPException(status_code=404, detail="样例数据不存在")
    
    sample = store.samples[sample_id]
    config = MaskingConfig(strategy=sample.strategy)
    
    return await process_sample(sample_id, config)

@router.delete("/{sample_id}")
async def delete_sample(sample_id: str):
    if sample_id not in store.samples:
        raise HTTPException(status_code=404, detail="样例数据不存在")
    del store.samples[sample_id]
    return {"message": "删除成功"}
