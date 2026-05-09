import json
import io
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
import pandas as pd
from backend.database import Sample, Annotation, Project
from backend.schemas import SampleCreate, AnnotationCreate


class DataImporter:
    def __init__(self, db: Session):
        self.db = db
    
    def _parse_json_format(self, data: List[Dict[str, Any]]) -> List[SampleCreate]:
        samples = []
        
        for item in data:
            annotations_data = []
            if "annotations" in item:
                for ann in item["annotations"]:
                    annotations_data.append(AnnotationCreate(
                        annotator=str(ann.get("annotator", "unknown")),
                        label=str(ann.get("label", "")),
                        confidence=float(ann.get("confidence", 1.0)),
                        reasoning=ann.get("reasoning")
                    ))
            elif "label" in item and "annotator" in item:
                annotations_data.append(AnnotationCreate(
                    annotator=str(item["annotator"]),
                    label=str(item["label"]),
                    confidence=float(item.get("confidence", 1.0)),
                    reasoning=item.get("reasoning")
                ))
            
            sample = SampleCreate(
                content=str(item.get("content", item.get("text", ""))),
                external_id=item.get("id") or item.get("external_id"),
                metadata=json.dumps(item.get("metadata", {})) if item.get("metadata") else None,
                annotations=annotations_data
            )
            samples.append(sample)
        
        return samples
    
    def _parse_csv_format(self, df: pd.DataFrame) -> List[SampleCreate]:
        samples_dict = {}
        
        required_cols = ["content"]
        if not any(col in df.columns for col in required_cols):
            text_cols = [col for col in df.columns if "text" in col.lower() or "content" in col.lower()]
            if text_cols:
                content_col = text_cols[0]
            else:
                raise ValueError("CSV must contain 'content' or 'text' column")
        else:
            content_col = [col for col in required_cols if col in df.columns][0]
        
        for _, row in df.iterrows():
            content = str(row[content_col])
            sample_id = str(row.get("id", row.get("sample_id", content[:50])))
            
            if sample_id not in samples_dict:
                samples_dict[sample_id] = {
                    "content": content,
                    "external_id": sample_id,
                    "annotations": []
                }
            
            annotator = str(row.get("annotator", row.get("rater", "unknown")))
            label = str(row.get("label", row.get("annotation", "")))
            
            if label:
                confidence = float(row.get("confidence", 1.0))
                reasoning = str(row.get("reasoning", "")) if pd.notna(row.get("reasoning")) else None
                
                samples_dict[sample_id]["annotations"].append(AnnotationCreate(
                    annotator=annotator,
                    label=label,
                    confidence=confidence,
                    reasoning=reasoning
                ))
        
        samples = []
        for sample_data in samples_dict.values():
            samples.append(SampleCreate(
                content=sample_data["content"],
                external_id=sample_data["external_id"],
                annotations=sample_data["annotations"]
            ))
        
        return samples
    
    def import_from_json(self, project_id: int, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        samples = self._parse_json_format(data)
        return self._save_samples(project_id, samples)
    
    def import_from_jsonl(self, project_id: int, content: str) -> Dict[str, Any]:
        lines = [line.strip() for line in content.split('\n') if line.strip()]
        data = [json.loads(line) for line in lines]
        return self.import_from_json(project_id, data)
    
    def import_from_csv(self, project_id: int, file_content: bytes) -> Dict[str, Any]:
        df = pd.read_csv(io.BytesIO(file_content))
        samples = self._parse_csv_format(df)
        return self._save_samples(project_id, samples)
    
    def import_from_excel(self, project_id: int, file_content: bytes) -> Dict[str, Any]:
        df = pd.read_excel(io.BytesIO(file_content))
        samples = self._parse_csv_format(df)
        return self._save_samples(project_id, samples)
    
    def _save_samples(self, project_id: int, samples: List[SampleCreate]) -> Dict[str, Any]:
        project = self.db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError(f"Project with id {project_id} not found")
        
        total_samples = 0
        total_annotations = 0
        
        for sample_data in samples:
            if not sample_data.content.strip():
                continue
            
            existing_sample = None
            if sample_data.external_id:
                existing_sample = (
                    self.db.query(Sample)
                    .filter(
                        Sample.project_id == project_id,
                        Sample.external_id == sample_data.external_id
                    )
                    .first()
                )
            
            if existing_sample:
                sample = existing_sample
            else:
                sample = Sample(
                    project_id=project_id,
                    content=sample_data.content,
                    external_id=sample_data.external_id,
                    metadata=sample_data.metadata
                )
                self.db.add(sample)
                self.db.flush()
                total_samples += 1
            
            for ann_data in sample_data.annotations:
                existing_ann = (
                    self.db.query(Annotation)
                    .filter(
                        Annotation.sample_id == sample.id,
                        Annotation.annotator == ann_data.annotator,
                        Annotation.label == ann_data.label
                    )
                    .first()
                )
                
                if not existing_ann:
                    new_ann = Annotation(
                        sample_id=sample.id,
                        annotator=ann_data.annotator,
                        label=ann_data.label,
                        confidence=ann_data.confidence,
                        reasoning=ann_data.reasoning
                    )
                    self.db.add(new_ann)
                    total_annotations += 1
        
        self.db.commit()
        
        return {
            "project_id": project_id,
            "samples_created": total_samples,
            "annotations_added": total_annotations,
            "message": f"Successfully imported {total_samples} samples with {total_annotations} annotations"
        }
