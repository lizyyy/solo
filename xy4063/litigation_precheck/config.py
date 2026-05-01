from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class MaterialType(BaseModel):
    name: str
    code: str
    required: bool = False
    description: str = ""
    naming_pattern: Optional[str] = None
    min_pages: int = 1
    max_pages: Optional[int] = None
    requires_signature: bool = False
    signature_pages: Optional[List[int]] = None


class NamingRule(BaseModel):
    pattern: str
    description: str
    examples: List[str]
    material_types: List[str]


class ProjectConfig(BaseModel):
    project_name: str
    case_number: Optional[str] = None
    court: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    
    material_types: List[MaterialType] = Field(default_factory=lambda: [
        MaterialType(
            name="起诉状",
            code="COMPLAINT",
            required=True,
            description="民事起诉状",
            naming_pattern=r"起诉状.*\.(pdf|PDF)$",
            requires_signature=True,
            signature_pages=[-1]
        ),
        MaterialType(
            name="授权委托书",
            code="POA",
            required=True,
            description="授权委托书",
            naming_pattern=r"授权委托书.*\.(pdf|PDF)$",
            requires_signature=True,
            signature_pages=[-1]
        ),
        MaterialType(
            name="证据目录",
            code="EVIDENCE_LIST",
            required=True,
            description="证据目录清单",
            naming_pattern=r"证据目录.*\.(csv|CSV|xlsx|XLSX|xls|XLS)$"
        ),
        MaterialType(
            name="证据材料",
            code="EVIDENCE",
            required=True,
            description="证据扫描件",
            naming_pattern=r"证据\d+.*\.(pdf|PDF|jpg|JPG|jpeg|JPEG|png|PNG)$",
            min_pages=1
        ),
        MaterialType(
            name="送达地址确认书",
            code="ADDRESS_CONFIRM",
            required=True,
            description="送达地址确认书",
            naming_pattern=r"送达地址确认书.*\.(pdf|PDF)$",
            requires_signature=True,
            signature_pages=[-1]
        ),
        MaterialType(
            name="身份证明",
            code="IDENTITY",
            required=False,
            description="当事人身份证明材料",
            naming_pattern=r"(身份证|营业执照|身份证明).*\.(pdf|PDF|jpg|JPG|jpeg|JPEG|png|PNG)$"
        ),
    ])
    
    naming_rules: List[NamingRule] = Field(default_factory=lambda: [
        NamingRule(
            pattern=r"^证据(\d+)[-_]?.*\.(pdf|PDF|jpg|JPG|jpeg|JPEG|png|PNG)$",
            description="证据文件命名规则：证据+编号+描述.扩展名",
            examples=["证据01-借款合同.pdf", "证据2_转账凭证.jpg"],
            material_types=["EVIDENCE"]
        ),
        NamingRule(
            pattern=r"^起诉状.*\.(pdf|PDF)$",
            description="起诉状命名规则：起诉状*.pdf",
            examples=["起诉状.pdf", "起诉状_原告张三.pdf"],
            material_types=["COMPLAINT"]
        ),
        NamingRule(
            pattern=r"^授权委托书.*\.(pdf|PDF)$",
            description="授权委托书命名规则：授权委托书*.pdf",
            examples=["授权委托书.pdf", "授权委托书_张三.pdf"],
            material_types=["POA"]
        ),
    ])
    
    evidence_csv_columns: Dict[str, str] = Field(default_factory=lambda: {
        "evidence_number": "证据编号",
        "evidence_name": "证据名称",
        "evidence_type": "证据类型",
        "page_count": "页数",
        "source": "证据来源",
        "proof_content": "证明内容",
        "file_name": "文件名"
    })
    
    scan_config: Dict[str, Any] = Field(default_factory=lambda: {
        "allowed_extensions": [".pdf", ".PDF", ".jpg", ".JPG", ".jpeg", ".JPEG", ".png", ".PNG", ".csv", ".CSV", ".xlsx", ".XLSX", ".xls", ".XLS"],
        "ignore_patterns": [".DS_Store", "Thumbs.db", "~$*", "*.tmp"],
        "recursive": True
    })
    
    check_rules: Dict[str, Any] = Field(default_factory=lambda: {
        "check_duplicate_hash": True,
        "check_page_range": True,
        "check_evidence_sequence": True,
        "check_naming_convention": True,
        "check_signature_pages": True,
        "check_required_materials": True,
        "check_csv_file_match": True,
        "max_pages_per_file": 100,
        "min_evidence_files": 1
    })
    
    output_config: Dict[str, Any] = Field(default_factory=lambda: {
        "manifest_filename": "manifest.json",
        "quarantine_filename": "quarantine.json",
        "report_md_filename": "预检报告.md",
        "report_csv_filename": "预检报告.csv",
        "packed_list_filename": "提交清单.csv",
        "packed_dir_name": "递交包"
    })


class ConfigManager:
    DEFAULT_CONFIG_FILENAME = "litcheck_config.json"
    
    @classmethod
    def create_default_config(cls, project_name: str, case_number: Optional[str] = None, 
                                court: Optional[str] = None) -> ProjectConfig:
        return ProjectConfig(
            project_name=project_name,
            case_number=case_number,
            court=court
        )
    
    @classmethod
    def load_config(cls, config_path: Path) -> ProjectConfig:
        import json
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return ProjectConfig(**data)
    
    @classmethod
    def save_config(cls, config: ProjectConfig, config_path: Path) -> None:
        import json
        config.updated_at = datetime.now().isoformat()
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config.model_dump(), f, ensure_ascii=False, indent=2)
    
    @classmethod
    def find_config(cls, start_path: Path) -> Optional[Path]:
        current = start_path
        while current.parent != current:
            config_path = current / cls.DEFAULT_CONFIG_FILENAME
            if config_path.exists():
                return config_path
            current = current.parent
        return None
