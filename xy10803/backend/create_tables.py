import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import engine, Base
from app.models.data_template import DataTemplate
from app.models.tenant_sandbox import TenantSandbox
from app.models.seed_batch import SeedBatch
from app.models.dependency import Dependency
from app.models.cleanup_task import CleanupTask
from app.models.seed_log import SeedLog

def create_tables():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ All tables created successfully!")

if __name__ == "__main__":
    create_tables()
