import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import FeatureFlag, CodeReference, FlagStatus, RiskLevel, ExperimentStatus, DeletionSuggestion


def seed_data():
    db = SessionLocal()
    
    sample_flags = [
        {
            "name": "checkout_new_payment",
            "description": "Enable new payment gateway in checkout flow",
            "default_value": False,
            "status": FlagStatus.PENDING,
            "risk_level": RiskLevel.LOW,
            "experiment_status": ExperimentStatus.COMPLETED,
            "deletion_suggestion": DeletionSuggestion.SAFE_TO_DELETE,
            "owner": "payment-team@company.com",
            "notes": "Experiment concluded successfully",
            "references": [
                ("src/checkout/payment.py", 42, "python", "main-repo"),
                ("src/checkout/views.py", 89, "python", "main-repo")
            ]
        },
        {
            "name": "user_profile_redesign",
            "description": "Show new user profile design",
            "default_value": True,
            "status": FlagStatus.REVIEWING,
            "risk_level": RiskLevel.MEDIUM,
            "experiment_status": ExperimentStatus.ACTIVE,
            "deletion_suggestion": DeletionSuggestion.NEEDS_REVIEW,
            "owner": "ux-team@company.com",
            "notes": "Still being tested by 50% users",
            "references": [
                ("src/profile/render.js", 15, "javascript", "frontend"),
                ("src/profile/api.py", 33, "python", "main-repo"),
                ("src/profile/styles.css", 7, "css", "frontend")
            ]
        },
        {
            "name": "legacy_auth_backend",
            "description": "Use old authentication system",
            "default_value": True,
            "status": FlagStatus.APPROVED,
            "risk_level": RiskLevel.HIGH,
            "experiment_status": ExperimentStatus.ACTIVE,
            "deletion_suggestion": DeletionSuggestion.DO_NOT_DELETE,
            "owner": "security-team@company.com",
            "notes": "Critical - still used by enterprise clients",
            "references": [
                ("src/auth/login.py", 12, "python", "main-repo"),
                ("src/auth/middleware.py", 45, "python", "main-repo"),
                ("src/auth/tokens.py", 88, "python", "main-repo"),
                ("src/auth/sso.py", 23, "python", "main-repo")
            ]
        },
        {
            "name": "temp_banner_halloween",
            "description": "Show Halloween promotional banner",
            "default_value": False,
            "status": FlagStatus.COMPLETED,
            "risk_level": RiskLevel.SAFE,
            "experiment_status": ExperimentStatus.COMPLETED,
            "deletion_suggestion": DeletionSuggestion.SAFE_TO_DELETE,
            "owner": "marketing@company.com",
            "notes": "Holiday event ended",
            "references": [
                ("src/home/banner.jsx", 18, "jsx", "frontend")
            ]
        },
        {
            "name": "new_search_algorithm",
            "description": "Use elasticsearch instead of postgres for search",
            "default_value": True,
            "status": FlagStatus.ANALYZING,
            "risk_level": RiskLevel.HIGH,
            "experiment_status": ExperimentStatus.ACTIVE,
            "deletion_suggestion": DeletionSuggestion.DO_NOT_DELETE,
            "owner": "search-team@company.com",
            "notes": "Performance critical feature",
            "references": [
                ("src/search/engine.py", 12, "python", "main-repo"),
                ("src/search/queries.py", 45, "python", "main-repo"),
                ("src/search/index.py", 89, "python", "main-repo"),
                ("src/search/cache.py", 34, "python", "main-repo"),
                ("src/api/search_endpoint.py", 67, "python", "main-repo")
            ]
        }
    ]
    
    for flag_data in sample_flags:
        references = flag_data.pop("references", [])
        
        flag = FeatureFlag(**flag_data)
        db.add(flag)
        db.flush()
        
        for file_path, line_num, lang, repo in references:
            ref = CodeReference(
                feature_flag_id=flag.id,
                file_path=file_path,
                line_number=line_num,
                language=lang,
                repository=repo
            )
            db.add(ref)
    
    db.commit()
    print(f"Created {len(sample_flags)} feature flags with code references")
    db.close()


if __name__ == "__main__":
    seed_data()
