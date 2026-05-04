#!/usr/bin/env python3
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))

from app.database.connection import SessionLocal, init_db, engine
from app.database.models import Base
from app.services.call_service import CallService
from app.services.export_service import ExportService
from app.config import RISK_LEVELS, RISK_FLAGS, EXPORTS_DIR, SAMPLES_DIR
from app.ui.main_window import RiskReviewerApp


def setup_database():
    Base.metadata.create_all(bind=engine)


def main():
    setup_database()
    
    root = tk.Tk()
    app = RiskReviewerApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
