from sqlalchemy.orm import Session
from models import Translation, LanguageKey, LanguagePack, VersionRelease
from typing import Optional, Dict, Any
import json
import io
import csv


class ExportService:
    @staticmethod
    def export_language_pack(db: Session, language_pack_id: int,
                            version_release_id: Optional[int] = None,
                            format: str = "json") -> Dict[str, Any]:
        language_pack = db.query(LanguagePack).filter(
            LanguagePack.id == language_pack_id
        ).first()
        
        if not language_pack:
            raise ValueError("Language pack not found")

        query = db.query(Translation).filter(
            Translation.language_pack_id == language_pack_id,
            Translation.translated_text.isnot(None)
        ).join(LanguageKey)

        translations = query.all()

        result = {}
        for t in translations:
            result[t.language_key.key] = t.translated_text

        metadata = {
            "language_code": language_pack.language_code,
            "language_name": language_pack.language_name,
            "export_time": str(db.query(func.now()).scalar()),
            "total_keys": len(result)
        }

        if version_release_id:
            version = db.query(VersionRelease).filter(
                VersionRelease.id == version_release_id
            ).first()
            if version:
                metadata["version"] = version.version
                metadata["published_at"] = str(version.published_at) if version.published_at else None

        if format == "json":
            return {
                "content_type": "application/json",
                "filename": f"{language_pack.language_code}_{metadata.get('version', 'latest')}.json",
                "content": json.dumps({"metadata": metadata, "translations": result}, 
                                    ensure_ascii=False, indent=2)
            }
        elif format == "csv":
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["Key", "Translation"])
            for key, value in result.items():
                writer.writerow([key, value])
            
            return {
                "content_type": "text/csv",
                "filename": f"{language_pack.language_code}_{metadata.get('version', 'latest')}.csv",
                "content": output.getvalue()
            }
        else:
            raise ValueError(f"Unsupported format: {format}")


from sqlalchemy import func
