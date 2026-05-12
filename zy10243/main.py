from fastapi import FastAPI, HTTPException
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
import uuid
from collections import defaultdict

app = FastAPI(title="赛事志愿者岗位调剂API")

# 数据存储（内存数据库）
class Database:
    def __init__(self):
        self.volunteers: Dict[str, Dict] = {}
        self.positions: Dict[str, Dict] = {}
        self.assignments: Dict[str, Dict] = {}
        self.leave_requests: Dict[str, Dict] = {}
        self.history: List[Dict] = []
        self.check_ins: Dict[str, Dict] = {}
    
    def add_history(self, action: str, entity_type: str, entity_id: str, 
                    details: Dict, operator: str = "system"):
        self.history.append({
            "history_id": str(uuid.uuid4()),
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "details": details,
            "operator": operator,
            "timestamp": datetime.now().isoformat()
        })

db = Database()

# 模型定义
class VolunteerCreate(BaseModel):
    name: str
    phone: str
    skills: List[str] = Field(default_factory=list)
    is_trained: bool = False

class PositionCreate(BaseModel):
    name: str
    description: str
    is_critical: bool = False
    max_capacity: int
    required_skills: List[str] = Field(default_factory=list)

class AssignmentCreate(BaseModel):
    volunteer_id: str
    position_id: str

class LeaveRequestCreate(BaseModel):
    volunteer_id: str
    position_id: str
    reason: str

class CheckInRequest(BaseModel):
    volunteer_id: str
    position_id: str

# 辅助函数
def get_volunteer_or_404(volunteer_id: str) -> Dict:
    if volunteer_id not in db.volunteers:
        raise HTTPException(status_code=404, detail=f"志愿者 {volunteer_id} 不存在")
    return db.volunteers[volunteer_id]

def get_position_or_404(position_id: str) -> Dict:
    if position_id not in db.positions:
        raise HTTPException(status_code=404, detail=f"岗位 {position_id} 不存在")
    return db.positions[position_id]

def get_assignment_or_404(assignment_id: str) -> Dict:
    if assignment_id not in db.assignments:
        raise HTTPException(status_code=404, detail=f"分配记录 {assignment_id} 不存在")
    return db.assignments[assignment_id]

def get_volunteer_assignments(volunteer_id: str) -> List[Dict]:
    return [a for a in db.assignments.values() 
            if a["volunteer_id"] == volunteer_id and a["status"] == "active"]

def get_position_volunteers(position_id: str) -> List[Dict]:
    return [a for a in db.assignments.values() 
            if a["position_id"] == position_id and a["status"] == "active"]

def can_assign_to_position(volunteer_id: str, position_id: str) -> tuple[bool, str]:
    volunteer = get_volunteer_or_404(volunteer_id)
    position = get_position_or_404(position_id)
    
    if position["is_critical"] and not volunteer["is_trained"]:
        return False, "未培训人员不能分配到关键岗位"
    
    current_assignments = get_volunteer_assignments(volunteer_id)
    if current_assignments:
        return False, f"志愿者已分配到岗位: {current_assignments[0]['position_id']}"
    
    position_volunteers = get_position_volunteers(position_id)
    if len(position_volunteers) >= position["max_capacity"]:
        return False, f"岗位已满员 (当前: {len(position_volunteers)}/上限: {position['max_capacity']})"
    
    return True, "可以分配"

def find_substitutes(position_id: str, exclude_volunteer_id: str) -> List[Dict]:
    position = get_position_or_404(position_id)
    candidates = []
    
    for vid, volunteer in db.volunteers.items():
        if vid == exclude_volunteer_id:
            continue
        
        can_assign, reason = can_assign_to_position(vid, position_id)
        if can_assign:
            match_skills = len(set(volunteer["skills"]) & set(position["required_skills"]))
            candidates.append({
                "volunteer_id": vid,
                "name": volunteer["name"],
                "is_trained": volunteer["is_trained"],
                "skills": volunteer["skills"],
                "match_skill_count": match_skills
            })
    
    candidates.sort(key=lambda x: (-x["is_trained"], -x["match_skill_count"]))
    return candidates

# API 接口
@app.post("/volunteers", summary="创建志愿者")
def create_volunteer(volunteer: VolunteerCreate):
    volunteer_id = str(uuid.uuid4())
    volunteer_data = volunteer.model_dump()
    volunteer_data["volunteer_id"] = volunteer_id
    volunteer_data["created_at"] = datetime.now().isoformat()
    db.volunteers[volunteer_id] = volunteer_data
    db.add_history("create", "volunteer", volunteer_id, volunteer_data)
    return {"success": True, "data": volunteer_data}

@app.get("/volunteers", summary="获取所有志愿者")
def list_volunteers():
    return {"success": True, "data": list(db.volunteers.values())}

@app.post("/positions", summary="创建岗位")
def create_position(position: PositionCreate):
    position_id = str(uuid.uuid4())
    position_data = position.model_dump()
    position_data["position_id"] = position_id
    position_data["created_at"] = datetime.now().isoformat()
    db.positions[position_id] = position_data
    db.add_history("create", "position", position_id, position_data)
    return {"success": True, "data": position_data}

@app.get("/positions", summary="获取所有岗位")
def list_positions():
    positions = []
    for pid, pos in db.positions.items():
        pos_with_count = pos.copy()
        pos_with_count["current_count"] = len(get_position_volunteers(pid))
        positions.append(pos_with_count)
    return {"success": True, "data": positions}

@app.post("/assignments", summary="分配志愿者到岗位")
def create_assignment(assignment: AssignmentCreate):
    for existing in db.assignments.values():
        if (existing["volunteer_id"] == assignment.volunteer_id and 
            existing["position_id"] == assignment.position_id and 
            existing["status"] == "active"):
            return {"success": False, "error": "重复分配", "detail": "该志愿者已在此岗位"}
    
    can_assign, reason = can_assign_to_position(assignment.volunteer_id, assignment.position_id)
    if not can_assign:
        return {"success": False, "error": "分配失败", "detail": reason}
    
    assignment_id = str(uuid.uuid4())
    assignment_data = {
        "assignment_id": assignment_id,
        "volunteer_id": assignment.volunteer_id,
        "position_id": assignment.position_id,
        "status": "active",
        "created_at": datetime.now().isoformat()
    }
    db.assignments[assignment_id] = assignment_data
    db.add_history("assign", "assignment", assignment_id, assignment_data)
    return {"success": True, "data": assignment_data}

@app.post("/assignments/{assignment_id}/confirm-training", summary="确认培训")
def confirm_training(assignment_id: str):
    assignment = get_assignment_or_404(assignment_id)
    volunteer = get_volunteer_or_404(assignment["volunteer_id"])
    
    if volunteer["is_trained"]:
        return {"success": False, "error": "重复操作", "detail": "该志愿者已完成培训"}
    
    volunteer["is_trained"] = True
    db.add_history("confirm_training", "volunteer", assignment["volunteer_id"], 
                   {"assignment_id": assignment_id})
    return {"success": True, "data": {"volunteer_id": assignment["volunteer_id"], "is_trained": True}}

@app.post("/leave-requests", summary="提交请假申请")
def create_leave_request(leave: LeaveRequestCreate):
    active_assignment = None
    for assignment in db.assignments.values():
        if (assignment["volunteer_id"] == leave.volunteer_id and 
            assignment["position_id"] == leave.position_id and 
            assignment["status"] == "active"):
            active_assignment = assignment
            break
    
    if not active_assignment:
        return {"success": False, "error": "请假失败", "detail": "该志愿者不在此岗位工作"}
    
    for existing in db.leave_requests.values():
        if (existing["volunteer_id"] == leave.volunteer_id and 
            existing["position_id"] == leave.position_id and 
            existing["status"] == "pending"):
            return {"success": False, "error": "重复提交", "detail": "已有待处理的请假申请"}
    
    leave_id = str(uuid.uuid4())
    leave_data = {
        "leave_id": leave_id,
        "volunteer_id": leave.volunteer_id,
        "position_id": leave.position_id,
        "reason": leave.reason,
        "status": "pending",
        "assignment_id": active_assignment["assignment_id"],
        "created_at": datetime.now().isoformat()
    }
    db.leave_requests[leave_id] = leave_data
    db.add_history("leave_request", "leave", leave_id, leave_data)
    
    substitutes = find_substitutes(leave.position_id, leave.volunteer_id)
    
    return {
        "success": True, 
        "data": leave_data,
        "substitutes": substitutes,
        "substitute_count": len(substitutes)
    }

@app.post("/leave-requests/{leave_id}/approve", summary="批准请假并调剂")
def approve_leave_and_reassign(leave_id: str, substitute_id: Optional[str] = None):
    leave = db.leave_requests.get(leave_id)
    if not leave:
        raise HTTPException(status_code=404, detail=f"请假申请 {leave_id} 不存在")
    
    if leave["status"] != "pending":
        return {"success": False, "error": "操作失败", "detail": "请假申请已处理"}
    
    assignment = db.assignments[leave["assignment_id"]]
    assignment["status"] = "left"
    
    leave["status"] = "approved"
    leave["approved_at"] = datetime.now().isoformat()
    
    db.add_history("approve_leave", "leave", leave_id, leave)
    
    reassign_result = None
    if substitute_id:
        can_assign, reason = can_assign_to_position(substitute_id, leave["position_id"])
        if can_assign:
            new_assignment_id = str(uuid.uuid4())
            new_assignment = {
                "assignment_id": new_assignment_id,
                "volunteer_id": substitute_id,
                "position_id": leave["position_id"],
                "status": "active",
                "created_at": datetime.now().isoformat(),
                "reassigned_from": leave["volunteer_id"]
            }
            db.assignments[new_assignment_id] = new_assignment
            db.add_history("reassign", "assignment", new_assignment_id, new_assignment)
            reassign_result = {"success": True, "assignment": new_assignment}
        else:
            reassign_result = {"success": False, "error": "调剂失败", "detail": reason}
    
    return {
        "success": True,
        "leave": leave,
        "original_assignment_closed": assignment,
        "reassignment": reassign_result
    }

@app.post("/check-in", summary="签到")
def check_in(checkin: CheckInRequest):
    has_active = False
    for assignment in db.assignments.values():
        if (assignment["volunteer_id"] == checkin.volunteer_id and 
            assignment["position_id"] == checkin.position_id and 
            assignment["status"] == "active"):
            has_active = True
            break
    
    if not has_active:
        return {"success": False, "error": "签到失败", "detail": "该志愿者未在此岗位分配或已离开"}
    
    checkin_id = str(uuid.uuid4())
    checkin_data = {
        "checkin_id": checkin_id,
        "volunteer_id": checkin.volunteer_id,
        "position_id": checkin.position_id,
        "timestamp": datetime.now().isoformat()
    }
    db.check_ins[checkin_id] = checkin_data
    db.add_history("checkin", "checkin", checkin_id, checkin_data)
    return {"success": True, "data": checkin_data}

@app.get("/positions/{position_id}/roster", summary="获取岗位签到名单")
def get_position_roster(position_id: str):
    position = get_position_or_404(position_id)
    assignments = get_position_volunteers(position_id)
    
    roster = []
    for assignment in assignments:
        volunteer = db.volunteers[assignment["volunteer_id"]]
        has_checked_in = any(
            c["volunteer_id"] == assignment["volunteer_id"] and 
            c["position_id"] == position_id 
            for c in db.check_ins.values()
        )
        roster.append({
            "volunteer_id": assignment["volunteer_id"],
            "name": volunteer["name"],
            "is_trained": volunteer["is_trained"],
            "assignment_id": assignment["assignment_id"],
            "has_checked_in": has_checked_in
        })
    
    return {
        "success": True,
        "position": position,
        "roster": roster,
        "total_count": len(roster),
        "checked_in_count": sum(1 for r in roster if r["has_checked_in"])
    }

@app.get("/history", summary="获取操作历史")
def get_history(entity_type: Optional[str] = None):
    history = db.history
    if entity_type:
        history = [h for h in history if h["entity_type"] == entity_type]
    return {"success": True, "data": history}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)