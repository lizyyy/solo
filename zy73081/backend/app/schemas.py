from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class Coordinate3D(BaseModel):
    x: float
    y: float
    z: float


class ViewScreenshot(BaseModel):
    id: str
    url: str
    label: str
    cameraPosition: Coordinate3D
    targetPosition: Coordinate3D


class ClueNode(BaseModel):
    id: str
    step: str
    title: str
    description: str
    evidenceUrls: Optional[List[str]] = None
    operator: str
    timestamp: str


class HistoryRecord(BaseModel):
    id: str
    collisionId: str
    previousStatus: str
    newStatus: str
    reason: str
    operator: str
    timestamp: str
    evidenceUrls: Optional[List[str]] = None


class CollisionRecordOut(BaseModel):
    id: str
    projectName: str
    floor: str
    nodeCode: str
    collisionType: str
    elementA: str
    elementB: str
    status: str
    initialConclusion: str
    screenshots: List[ViewScreenshot]
    clueChain: List[ClueNode]
    history: List[HistoryRecord]
    isCoordinateOffset: bool
    coordinateOffsetNote: Optional[str] = None
    rejudgeCount: int
    responsiblePerson: str
    isSample: bool
    createdAt: str
    updatedAt: str

    class Config:
        from_attributes = True


class SummaryData(BaseModel):
    total: int
    passed: int
    pendingEvidence: int
    manualRejudged: int
    coordinateOffset: int


class RejudgePayload(BaseModel):
    newStatus: str
    reason: str = Field(..., min_length=2)
    operator: str = Field(..., min_length=2)
    evidenceUrls: Optional[List[str]] = None


class ListFilterParams(BaseModel):
    status: Optional[str] = None
    coordinateOffsetOnly: Optional[bool] = None
    keyword: Optional[str] = None
    project: Optional[str] = None
    floor: Optional[str] = None
