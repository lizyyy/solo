from typing import List


class Settings:
    DATABASE_URL: str = "sqlite:///./rescue_profile.db"
    CAD_LAYER_KEEP_REMARKS: bool = True
    REVIEW_REQUIRED_FOR_LENGTH_MISMATCH: bool = True
    WORKFLOW_STEPS: List[str] = [
        "photo_import",
        "cad_layer_review",
        "export_screenshot"
    ]


settings = Settings()
