"""数据仓库模块"""

import numpy as np
from datetime import datetime
from typing import Optional, List, Dict, Any
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy.orm import Session
from sqlalchemy import desc

from .models import (
    Base, Batch, Sample, ImageFeaturesModel, TextFeaturesModel,
    TemperatureDataModel, DefectGroupModel, AnomalyModel, VerificationHistory,
    init_db
)
from ..config import get_config
from ..features.image_features import ImageFeatures
from ..features.text_features import TextFeatures
from ..analysis.grouping import SampleData, DefectGroup, AnomalyDetection, AnalysisResult


class DataRepository:
    def __init__(self, db_path: Optional[str] = None, config=None):
        self.config = config or get_config()
        self.db_path = db_path or self.config.database.db_path
        self.engine, self.SessionLocal = init_db(
            self.db_path,
            self.config.database.echo
        )

    @contextmanager
    def get_session(self) -> Session:
        session = self.SessionLocal()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def create_batch(
        self,
        batch_id: str,
        name: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> Batch:
        with self.get_session() as session:
            existing = session.query(Batch).filter(Batch.batch_id == batch_id).first()
            if existing:
                return existing

            batch = Batch(
                batch_id=batch_id,
                name=name or batch_id,
                metadata=metadata or {}
            )
            session.add(batch)
            session.flush()
            session.refresh(batch)
            return batch

    def get_batch(self, batch_id: str) -> Optional[Batch]:
        with self.get_session() as session:
            return session.query(Batch).filter(Batch.batch_id == batch_id).first()

    def list_batches(self, limit: int = 100) -> List[Batch]:
        with self.get_session() as session:
            return session.query(Batch).order_by(desc(Batch.created_at)).limit(limit).all()

    def _convert_image_features(
        self,
        sample_id: str,
        features: ImageFeatures
    ) -> ImageFeaturesModel:
        return ImageFeaturesModel(
            sample_id=sample_id,
            width=features.width,
            height=features.height,
            avg_bgr_b=features.color.avg_bgr[0],
            avg_bgr_g=features.color.avg_bgr[1],
            avg_bgr_r=features.color.avg_bgr[2],
            avg_hsv_h=features.color.avg_hsv[0],
            avg_hsv_s=features.color.avg_hsv[1],
            avg_hsv_v=features.color.avg_hsv[2],
            avg_lab_l=features.color.avg_lab[0],
            avg_lab_a=features.color.avg_lab[1],
            avg_lab_b=features.color.avg_lab[2],
            color_contrast=features.color.color_contrast,
            brightness=features.color.brightness,
            total_contours=features.contour.total_contours,
            avg_contour_area=features.contour.avg_area,
            avg_contour_perimeter=features.contour.avg_perimeter,
            max_contour_area=features.contour.max_area,
            contour_density=features.contour.contour_density,
            edge_intensity=features.contour.edge_intensity,
            bubble_count=features.bubble.bubble_count,
            total_bubble_area=features.bubble.total_bubble_area,
            avg_bubble_area=features.bubble.avg_bubble_area,
            max_bubble_area=features.bubble.max_bubble_area,
            bubble_area_ratio=features.bubble.bubble_area_ratio,
            dominant_colors=features.color.dominant_colors,
            feature_vector=features.feature_vector.tolist()
        )

    def _convert_text_features(
        self,
        sample_id: str,
        features: Optional[TextFeatures]
    ) -> Optional[TextFeaturesModel]:
        if not features:
            return None

        return TextFeaturesModel(
            sample_id=sample_id,
            cleaned_text=features.cleaned_text,
            words=features.words,
            keywords=[(k, float(w)) for k, w in features.keywords],
            defect_categories={k: float(v) for k, v in features.defect_categories.items()},
            defect_keywords=features.defect_keywords,
            has_defect=features.has_defect,
            sentiment_score=features.sentiment_score,
            feature_vector=[float(f) for f in features.feature_vector]
        )

    def save_sample(
        self,
        batch: Batch,
        sample_data: SampleData
    ) -> Sample:
        with self.get_session() as session:
            existing = session.query(Sample).filter(
                Sample.sample_id == sample_data.sample_id
            ).first()

            if existing:
                return existing

            sample = Sample(
                sample_id=sample_data.sample_id,
                batch_id=batch.id,
                image_path=sample_data.image_path,
                formula=sample_data.formula,
                notes=sample_data.notes,
                extra_data=sample_data.metadata
            )
            session.add(sample)
            session.flush()

            if sample_data.image_features:
                img_features = self._convert_image_features(
                    sample_data.sample_id,
                    sample_data.image_features
                )
                session.add(img_features)
                session.flush()
                sample.image_features_id = img_features.id

            if sample_data.text_features:
                text_features = self._convert_text_features(
                    sample_data.sample_id,
                    sample_data.text_features
                )
                if text_features:
                    session.add(text_features)
                    session.flush()
                    sample.text_features_id = text_features.id

            if sample_data.kiln_temperature_data:
                temp_data = TemperatureDataModel(
                    sample_id=sample_data.sample_id,
                    temperatures=sample_data.kiln_temperature_data.get("temperatures", []),
                    timestamps=sample_data.kiln_temperature_data.get("timestamps", []),
                    avg_temp=sample_data.kiln_temperature_data.get("avg_temp"),
                    min_temp=sample_data.kiln_temperature_data.get("min_temp"),
                    max_temp=sample_data.kiln_temperature_data.get("max_temp"),
                    std_temp=sample_data.kiln_temperature_data.get("std_temp"),
                    source_file=sample_data.kiln_temperature_data.get("source_file")
                )
                session.add(temp_data)
                session.flush()
                sample.temperature_data_id = temp_data.id

            session.flush()
            session.refresh(sample)
            return sample

    def get_sample(self, sample_id: str) -> Optional[Sample]:
        with self.get_session() as session:
            return session.query(Sample).filter(Sample.sample_id == sample_id).first()

    def get_samples_by_batch(self, batch_id: str) -> List[Sample]:
        with self.get_session() as session:
            batch = session.query(Batch).filter(Batch.batch_id == batch_id).first()
            if not batch:
                return []
            return session.query(Sample).filter(Sample.batch_id == batch.id).all()

    def save_defect_group(
        self,
        batch: Batch,
        defect_group: DefectGroup
    ) -> DefectGroupModel:
        with self.get_session() as session:
            existing = session.query(DefectGroupModel).filter(
                DefectGroupModel.group_id == defect_group.group_id
            ).first()

            if existing:
                return existing

            group = DefectGroupModel(
                group_id=defect_group.group_id,
                batch_id=batch.id,
                name=defect_group.name,
                description=defect_group.description,
                dominant_defect_type=defect_group.dominant_defect_type,
                similarity_score=defect_group.similarity_score,
                is_manual=defect_group.is_manual,
                features_summary=defect_group.features_summary
            )
            session.add(group)
            session.flush()

            for sample_id in defect_group.sample_ids:
                sample = session.query(Sample).filter(
                    Sample.sample_id == sample_id
                ).first()
                if sample:
                    sample.group_id = group.id

            session.flush()
            session.refresh(group)
            return group

    def get_defect_group(self, group_id: str) -> Optional[DefectGroupModel]:
        with self.get_session() as session:
            return session.query(DefectGroupModel).filter(
                DefectGroupModel.group_id == group_id
            ).first()

    def get_groups_by_batch(self, batch_id: str) -> List[DefectGroupModel]:
        with self.get_session() as session:
            batch = session.query(Batch).filter(Batch.batch_id == batch_id).first()
            if not batch:
                return []
            return session.query(DefectGroupModel).filter(
                DefectGroupModel.batch_id == batch.id
            ).all()

    def save_anomaly(
        self,
        batch: Batch,
        anomaly: AnomalyDetection,
        anomaly_idx: int = 0
    ) -> AnomalyModel:
        with self.get_session() as session:
            anomaly_id = f"A_{batch.batch_id}_{anomaly_idx + 1:03d}"

            model = AnomalyModel(
                anomaly_id=anomaly_id,
                batch_id=batch.id,
                sample_id=anomaly.sample_id,
                anomaly_type=anomaly.anomaly_type,
                severity=anomaly.severity,
                description=anomaly.description,
                comparison_samples=anomaly.comparison_samples,
                details=anomaly.details
            )
            session.add(model)
            session.flush()
            session.refresh(model)
            return model

    def get_anomalies_by_batch(self, batch_id: str) -> List[AnomalyModel]:
        with self.get_session() as session:
            batch = session.query(Batch).filter(Batch.batch_id == batch_id).first()
            if not batch:
                return []
            return session.query(AnomalyModel).filter(
                AnomalyModel.batch_id == batch.id
            ).all()

    def update_sample_group(
        self,
        sample_id: str,
        new_group_id: str,
        notes: str = "",
        performed_by: str = "system"
    ) -> bool:
        with self.get_session() as session:
            sample = session.query(Sample).filter(
                Sample.sample_id == sample_id
            ).first()
            if not sample:
                return False

            old_group = session.query(DefectGroupModel).filter(
                DefectGroupModel.id == sample.group_id
            ).first() if sample.group_id else None

            new_group = session.query(DefectGroupModel).filter(
                DefectGroupModel.group_id == new_group_id
            ).first()
            if not new_group:
                return False

            history = VerificationHistory(
                sample_id=sample_id,
                action="reassign_group",
                old_group_id=old_group.group_id if old_group else None,
                new_group_id=new_group_id,
                notes=notes,
                performed_by=performed_by
            )
            session.add(history)

            sample.group_id = new_group.id
            sample.manual_group_id = new_group.id
            sample.is_verified = True
            sample.verified_at = datetime.utcnow()
            sample.verified_by = performed_by
            sample.verification_notes = notes

            return True

    def create_manual_group(
        self,
        batch_id: str,
        name: str,
        description: str = "",
        created_by: str = "user"
    ) -> Optional[DefectGroupModel]:
        with self.get_session() as session:
            batch = session.query(Batch).filter(Batch.batch_id == batch_id).first()
            if not batch:
                return None

            existing_groups = session.query(DefectGroupModel).filter(
                DefectGroupModel.batch_id == batch.id
            ).all()
            group_idx = len(existing_groups) + 1

            group = DefectGroupModel(
                group_id=f"G_{group_idx:03d}_M",
                batch_id=batch.id,
                name=name,
                description=description,
                dominant_defect_type="手动分组",
                is_manual=True,
                created_by=created_by
            )
            session.add(group)
            session.flush()
            session.refresh(group)
            return group

    def verify_sample(
        self,
        sample_id: str,
        verified: bool = True,
        notes: str = "",
        verified_by: str = "user"
    ) -> bool:
        with self.get_session() as session:
            sample = session.query(Sample).filter(
                Sample.sample_id == sample_id
            ).first()
            if not sample:
                return False

            sample.is_verified = verified
            sample.verified_at = datetime.utcnow()
            sample.verified_by = verified_by
            sample.verification_notes = notes

            history = VerificationHistory(
                sample_id=sample_id,
                action="verify" if verified else "unverify",
                notes=notes,
                performed_by=verified_by
            )
            session.add(history)

            return True

    def review_anomaly(
        self,
        anomaly_id: str,
        notes: str = "",
        reviewed_by: str = "user"
    ) -> bool:
        with self.get_session() as session:
            anomaly = session.query(AnomalyModel).filter(
                AnomalyModel.anomaly_id == anomaly_id
            ).first()
            if not anomaly:
                return False

            anomaly.is_reviewed = True
            anomaly.reviewed_at = datetime.utcnow()
            anomaly.reviewed_by = reviewed_by
            anomaly.review_notes = notes

            return True

    def get_verification_history(self, sample_id: str) -> List[VerificationHistory]:
        with self.get_session() as session:
            return session.query(VerificationHistory).filter(
                VerificationHistory.sample_id == sample_id
            ).order_by(desc(VerificationHistory.performed_at)).all()

    def save_analysis_result(self, result: AnalysisResult) -> bool:
        batch = self.create_batch(result.batch_id)

        sample_map = {}
        for sample_data in result.samples:
            sample = self.save_sample(batch, sample_data)
            sample_map[sample_data.sample_id] = sample

        for group in result.groups:
            self.save_defect_group(batch, group)

        for idx, anomaly in enumerate(result.anomalies):
            self.save_anomaly(batch, anomaly, idx)

        return True

    def to_sample_data(self, sample: Sample) -> SampleData:
        from ..features.image_features import (
            ColorFeatures, ContourFeatures, BubbleFeatures, ImageFeatures
        )
        from ..features.text_features import TextFeatures

        image_features = None
        if sample.image_features:
            img = sample.image_features
            color = ColorFeatures(
                avg_bgr=(img.avg_bgr_b, img.avg_bgr_g, img.avg_bgr_r),
                avg_hsv=(img.avg_hsv_h, img.avg_hsv_s, img.avg_hsv_v),
                avg_lab=(img.avg_lab_l, img.avg_lab_a, img.avg_lab_b),
                hist_bgr=np.array([]),
                hist_hsv=np.array([]),
                dominant_colors=img.dominant_colors or [],
                color_contrast=img.color_contrast or 0.0,
                brightness=img.brightness or 0.0,
            )
            contour = ContourFeatures(
                total_contours=img.total_contours or 0,
                contour_areas=[],
                contour_perimeters=[],
                avg_area=img.avg_contour_area or 0.0,
                avg_perimeter=img.avg_contour_perimeter or 0.0,
                max_area=img.max_contour_area or 0.0,
                max_perimeter=0.0,
                contour_density=img.contour_density or 0.0,
                edge_intensity=img.edge_intensity or 0.0,
            )
            bubble = BubbleFeatures(
                bubble_count=img.bubble_count or 0,
                total_bubble_area=img.total_bubble_area or 0.0,
                avg_bubble_area=img.avg_bubble_area or 0.0,
                max_bubble_area=img.max_bubble_area or 0.0,
                bubble_area_ratio=img.bubble_area_ratio or 0.0,
                bubble_locations=[],
            )
            image_features = ImageFeatures(
                image_path=sample.image_path,
                width=img.width or 0,
                height=img.height or 0,
                color=color,
                contour=contour,
                bubble=bubble,
                feature_vector=np.array(img.feature_vector or []),
            )

        text_features = None
        if sample.text_features:
            txt = sample.text_features
            text_features = TextFeatures(
                original_text=sample.notes,
                cleaned_text=txt.cleaned_text or "",
                words=txt.words or [],
                keywords=txt.keywords or [],
                defect_categories=txt.defect_categories or {},
                defect_keywords=txt.defect_keywords or [],
                has_defect=txt.has_defect or False,
                sentiment_score=txt.sentiment_score or 0.5,
                feature_vector=txt.feature_vector or [],
            )

        kiln_data = None
        if sample.temperature_data:
            temp = sample.temperature_data
            kiln_data = {
                "temperatures": temp.temperatures or [],
                "timestamps": temp.timestamps or [],
                "avg_temp": temp.avg_temp,
                "min_temp": temp.min_temp,
                "max_temp": temp.max_temp,
                "std_temp": temp.std_temp,
                "source_file": temp.source_file,
            }

        return SampleData(
            sample_id=sample.sample_id,
            image_path=sample.image_path,
            batch_id=sample.batch.batch_id if sample.batch else "",
            formula=sample.formula or "",
            image_features=image_features,
            text_features=text_features,
            kiln_temperature_data=kiln_data,
            notes=sample.notes or "",
            metadata=sample.extra_data or {},
        )
