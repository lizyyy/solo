from datetime import datetime
from pydantic import BaseModel, Field
from typing import List, Dict
from .photo import WorkingConditionPhoto


class ImportBatch(BaseModel):
    batch_id: str
    imported_at: datetime = Field(default_factory=datetime.now)
    source_file: str
    total_count: int = 0
    photos: Dict[str, WorkingConditionPhoto] = Field(default_factory=dict)

    def add_photo(self, photo: WorkingConditionPhoto) -> None:
        self.photos[photo.photo_id] = photo
        self.total_count = len(self.photos)

    def get_photo_by_row(self, row_number: int) -> List[WorkingConditionPhoto]:
        return [p for p in self.photos.values() if p.original_row_number == row_number]
