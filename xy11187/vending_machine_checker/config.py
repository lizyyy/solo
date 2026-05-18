import os
from dataclasses import dataclass
from typing import List, Set

@dataclass
class Config:
    INPUT_DIR: str = "input"
    OUTPUT_DIR: str = "output"
    LOG_DIR: str = "logs"
    PROCESSED_RECORD: str = ".processed_files.yml"
    
    VALID_FILE_TYPES: Set[str] = None
    COMBINATION_PRODUCT_MARKER: str = "组合商品"
    TEMP_REPLACE_MARKER: str = "临时换品"
    RERUN_MARKER: str = "可复跑"
    
    REQUIRED_COLUMNS: List[str] = None
    
    def __post_init__(self):
        if self.VALID_FILE_TYPES is None:
            self.VALID_FILE_TYPES = {".xlsx", ".xls", ".csv"}
        if self.REQUIRED_COLUMNS is None:
            self.REQUIRED_COLUMNS = [
                "售货机编号", 
                "货道编号", 
                "商品名称", 
                "商品编码", 
                "库存数量",
                "校验状态"
            ]
    
    def ensure_dirs(self):
        for dir_path in [self.INPUT_DIR, self.OUTPUT_DIR, self.LOG_DIR]:
            os.makedirs(dir_path, exist_ok=True)

config = Config()
