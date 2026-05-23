from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict, Any

class ProcessResponse(BaseModel):
    normal: List[Dict[str, Any]]
    pending: List[Dict[str, Any]]
    failed: List[Dict[str, Any]]
    total_processed: int
    message: str
