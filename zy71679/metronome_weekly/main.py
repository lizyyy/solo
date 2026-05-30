from fastapi import FastAPI
from database import engine, Base, get_db
from models import Student, PracticeRecord, TeacherComment, WeeklyReport, ConfirmationRecord, AuditLog
from routers import students, practice, comments, reports, confirmations, audit

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="节拍器练习周报后端",
    description="架子鼓老师用——学生每天练节拍器的偏差→周报→家长看进步",
    version="1.0.0",
)

app.include_router(students.router)
app.include_router(practice.router)
app.include_router(comments.router)
app.include_router(reports.router)
app.include_router(confirmations.router)
app.include_router(audit.router)


@app.get("/")
def root():
    return {
        "service": "metronome-weekly",
        "docs": "/docs",
    }
