from dataclasses import dataclass, field
from typing import Optional, List
from datetime import datetime


@dataclass
class Student:
    student_id: str
    name: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    grade: Optional[str] = None
    class_name: Optional[str] = None
    school: Optional[str] = None
    import_timestamp: datetime = field(default_factory=datetime.now)
    source_file: Optional[str] = None
    raw_data: dict = field(default_factory=dict)
    
    def to_dict(self) -> dict:
        return {
            "student_id": self.student_id,
            "name": self.name,
            "gender": self.gender,
            "age": self.age,
            "grade": self.grade,
            "class_name": self.class_name,
            "school": self.school,
            "import_timestamp": self.import_timestamp.isoformat(),
            "source_file": self.source_file
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "Student":
        import_timestamp = datetime.now()
        if data.get("import_timestamp"):
            try:
                import_timestamp = datetime.fromisoformat(data["import_timestamp"])
            except (ValueError, TypeError):
                pass
        
        age = data.get("age")
        if age is not None:
            try:
                age = int(age)
            except (ValueError, TypeError):
                age = None
        
        return cls(
            student_id=data.get("student_id", ""),
            name=data.get("name"),
            gender=data.get("gender"),
            age=age,
            grade=data.get("grade"),
            class_name=data.get("class_name"),
            school=data.get("school"),
            import_timestamp=import_timestamp,
            source_file=data.get("source_file")
        )
