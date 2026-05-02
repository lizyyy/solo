import pytest
import numpy as np
import cv2
from pathlib import Path
from unittest.mock import patch, MagicMock

from lens_inspector.models import (
    ImageFeatures,
    LensInspection,
    DefectDetection,
    DefectType,
    InspectionStatus,
    LensNote,
    SessionState,
)


class TestImageFeatures:
    def test_image_features_creation(self):
        features = ImageFeatures(
            image_id="test_image",
            file_path="/path/to/image.jpg",
            sharpness=200.0,
            sharpness_score=0.1,
        )
        assert features.image_id == "test_image"
        assert features.sharpness == 200.0
        assert features.sharpness_score == 0.1

    def test_image_features_to_dict_and_back(self):
        features = ImageFeatures(
            image_id="test_image",
            file_path="/path/to/image.jpg",
            sharpness=150.0,
            dark_corner_score=0.3,
            color_shift_score=0.2,
            dead_pixel_count=5,
            hot_pixel_count=2,
        )

        data = features.to_dict()
        assert data["image_id"] == "test_image"
        assert data["sharpness"] == 150.0

        restored = ImageFeatures.from_dict(data)
        assert restored.image_id == "test_image"
        assert restored.sharpness == 150.0


class TestDefectDetection:
    def test_defect_detection_creation(self):
        defect = DefectDetection(
            defect_id="def_123456",
            defect_type=DefectType.DARK_CORNER,
            confidence=0.8,
            location=(100, 100),
            severity="高",
        )
        assert defect.defect_type == DefectType.DARK_CORNER
        assert defect.confidence == 0.8

    def test_defect_detection_to_dict_and_back(self):
        defect = DefectDetection(
            defect_id="def_123456",
            defect_type=DefectType.MOLD,
            confidence=0.95,
            location=(200, 150),
            severity="高",
            description="检测到霉斑",
        )

        data = defect.to_dict()
        assert data["defect_type"] == "霉斑"
        assert data["confidence"] == 0.95

        restored = DefectDetection.from_dict(data)
        assert restored.defect_type == DefectType.MOLD
        assert restored.description == "检测到霉斑"


class TestLensInspection:
    def test_lens_inspection_creation(self):
        inspection = LensInspection(
            lens_id="LENS-001",
            images=["/path/to/img1.jpg", "/path/to/img2.jpg"],
            status=InspectionStatus.PENDING,
        )
        assert inspection.lens_id == "LENS-001"
        assert len(inspection.images) == 2
        assert inspection.status == InspectionStatus.PENDING

    def test_lens_inspection_status_enum(self):
        inspection = LensInspection(lens_id="test")
        inspection.status = InspectionStatus.COMPLETED
        assert inspection.status.value == "检测完成"

    def test_lens_inspection_to_dict_and_back(self):
        features = ImageFeatures(
            image_id="img_1",
            file_path="/path/to/img.jpg",
            sharpness=100.0,
        )

        defect = DefectDetection(
            defect_id="def_1",
            defect_type=DefectType.DARK_CORNER,
            confidence=0.7,
        )

        note = LensNote(
            lens_id="LENS-001",
            body_id="BODY-A01",
            notes="测试备注",
            inspector="张工",
        )

        inspection = LensInspection(
            lens_id="LENS-001",
            images=["/path/to/img1.jpg"],
            image_features={"img_1": features},
            defects=[defect],
            anomaly_score=0.5,
            cluster_id=1,
            cluster_label="暗角问题",
            status=InspectionStatus.FLAGGED,
            human_verified=True,
            human_notes="需要复检",
            note=note,
        )

        data = inspection.to_dict()
        assert data["lens_id"] == "LENS-001"
        assert data["anomaly_score"] == 0.5
        assert data["status"] == "需复检"

        restored = LensInspection.from_dict(data)
        assert restored.lens_id == "LENS-001"
        assert restored.anomaly_score == 0.5
        assert restored.status == InspectionStatus.FLAGGED
        assert restored.human_verified == True
        assert restored.note is not None
        assert restored.note.inspector == "张工"


class TestSessionState:
    def test_session_state_creation(self):
        state = SessionState(
            session_id="test_123",
            inspection_dir="/test/images",
            notes_csv="/test/notes.csv",
        )
        assert state.session_id == "test_123"
        assert state.inspections == {}

    def test_session_state_to_dict_and_back(self):
        inspection = LensInspection(
            lens_id="LENS-001",
            images=["/path/to/img.jpg"],
            anomaly_score=0.3,
        )

        state = SessionState(
            session_id="test_session",
            inspection_dir="/test/images",
            inspections={"LENS-001": inspection},
        )

        data = state.to_dict()
        assert data["session_id"] == "test_session"
        assert "LENS-001" in data["inspections"]

        restored = SessionState.from_dict(data)
        assert restored.session_id == "test_session"
        assert "LENS-001" in restored.inspections
        assert restored.inspections["LENS-001"].anomaly_score == 0.3
