from __future__ import annotations
from typing import List, Optional, Literal
from pydantic import BaseModel, Field


RoundingRule = Literal["round", "floor", "ceil"]
AnomalyType = Literal[
    "answer_version_conflict",
    "duplicate_submission",
    "duplicate_sample",
    "missing_note",
]


class DraftIn(BaseModel):
    questionNo: str
    answerContent: str
    answerVersion: Optional[str] = None
    supplementaryNote: Optional[str] = None
    rawSource: Optional[str] = None


class BatchSubmitRequest(BaseModel):
    drafts: List[DraftIn]
    paramVersionId: Optional[str] = None
    paramVersion: Optional["ParamVersionIn"] = None
    editorNote: Optional[str] = None
    batchId: Optional[str] = None


class DraftOut(BaseModel):
    id: str
    questionNo: str
    answerContent: str
    answerVersion: Optional[str] = None
    supplementaryNote: Optional[str] = None
    rawSource: str
    submittedAt: int
    submissionFingerprint: str

    class Config:
        from_attributes = True


class ParamVersionIn(BaseModel):
    name: str
    tolerance: float = 0.05
    roundingRule: RoundingRule = "round"
    sigFigs: int = 3
    isActive: bool = True


class ParamVersionOut(BaseModel):
    id: str
    name: str
    createdAt: int
    tolerance: float
    roundingRule: RoundingRule
    sigFigs: int
    isActive: bool

    class Config:
        from_attributes = True


class AnomalyOut(BaseModel):
    id: str
    type: AnomalyType
    relatedDraftIds: List[str]
    sourceDescription: str
    impactScope: str
    explanation: str
    resolved: bool
    resolverNote: Optional[str] = None

    class Config:
        from_attributes = True


class CalculationRunOut(BaseModel):
    id: str
    paramVersionId: str
    paramVersion: Optional[ParamVersionOut] = None
    startedAt: int
    finishedAt: int
    validDraftIds: List[str]
    allDraftIds: List[str]
    anomalies: List[AnomalyOut]
    summary: str
    editorNote: Optional[str] = None
    batchId: Optional[str] = None

    class Config:
        from_attributes = True


class FullRunResponse(BaseModel):
    run: CalculationRunOut
    drafts: List[DraftOut]
    paramVersions: List[ParamVersionOut]
    globalSummary: str


class AnomalyResolveRequest(BaseModel):
    resolved: bool
    resolverNote: Optional[str] = None


class EditorNoteRequest(BaseModel):
    editorNote: str


class NoteUpdateRequest(BaseModel):
    note: str


class ExportMarkdownResponse(BaseModel):
    markdown: str
