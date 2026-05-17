import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_data(db):
    from app.models.models import Department, Employee, MealType

    dept = Department(name="测试部门", code="TEST", contact="测试人", phone="13800000000")
    db.add(dept)
    db.commit()
    db.refresh(dept)

    emp = Employee(department_id=dept.id, name="测试员工", employee_no="EMP001", default_diet_restriction="不吃辣")
    db.add(emp)
    db.commit()
    db.refresh(emp)

    mt = MealType(name="午餐", code="LUNCH", start_time="11:30", end_time="13:30", sort_order=2)
    db.add(mt)
    db.commit()
    db.refresh(mt)

    return {
        "department": dept,
        "employee": emp,
        "meal_type": mt
    }
