import { EvacuationPlan, Student, Conflict, Statistics, Position } from '@/types';

const STUDENT_SPEED = 1.5;
const STAIR_SPEED_FACTOR = 0.6;

function generatePath(
  classroomPos: Position,
  stairPos: Position,
  assemblyPos: Position,
  floor: number,
  floorHeight: number
): Position[] {
  const path: Position[] = [];
  
  path.push({ ...classroomPos });
  
  const stairEntrance = {
    x: stairPos.x,
    y: classroomPos.y,
    z: stairPos.z
  };
  path.push(stairEntrance);
  
  for (let f = floor; f > 1; f--) {
    path.push({
      x: stairPos.x,
      y: (f - 1.5) * floorHeight,
      z: stairPos.z
    });
  }
  
  path.push({
    x: stairPos.x,
    y: 0,
    z: stairPos.z - 3
  });
  
  path.push({ ...assemblyPos });
  
  return path;
}

function initializeStudents(plan: EvacuationPlan): Student[] {
  const students: Student[] = [];
  let studentId = 0;
  
  plan.classrooms.forEach(classroom => {
    const stair = plan.stairs.find(s => s.id === classroom.assignedStairId);
    if (!stair) return;
    
    const assemblyPoint = plan.assemblyPoints[
      Math.floor(Math.random() * plan.assemblyPoints.length)
    ];
    
    const path = generatePath(
      classroom.position,
      stair.position,
      assemblyPoint.position,
      classroom.floor,
      plan.building.floorHeight
    );
    
    for (let i = 0; i < classroom.studentCount; i++) {
      const offset = {
        x: (Math.random() - 0.5) * 4,
        y: 0,
        z: (Math.random() - 0.5) * 4
      };
      
      students.push({
        id: `student-${studentId++}`,
        classroomId: classroom.id,
        status: 'waiting',
        position: {
          x: classroom.position.x + offset.x,
          y: classroom.position.y,
          z: classroom.position.z + offset.z
        },
        targetPosition: { ...path[0] },
        path: path.map(p => ({ ...p })),
        currentPathIndex: 0,
        speed: STUDENT_SPEED * (0.8 + Math.random() * 0.4),
        startTime: classroom.exitDelay + i * 0.1,
        arrivalTime: null
      });
    }
  });
  
  return students;
}

function distance(a: Position, b: Position): number {
  return Math.sqrt(
    Math.pow(a.x - b.x, 2) +
    Math.pow(a.y - b.y, 2) +
    Math.pow(a.z - b.z, 2)
  );
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class EvacuationSimulator {
  private plan: EvacuationPlan;
  private students: Student[] = [];
  private conflicts: Conflict[] = [];
  private currentTime: number = 0;
  private isRunning: boolean = false;
  private stairUsage: Map<string, number> = new Map();
  private onUpdate: ((state: { students: Student[]; conflicts: Conflict[]; statistics: Statistics }) => void) | null = null;
  
  constructor(plan: EvacuationPlan) {
    this.plan = plan;
    this.reset();
  }
  
  reset(): void {
    this.students = initializeStudents(this.plan);
    this.conflicts = [];
    this.currentTime = 0;
    this.stairUsage = new Map();
    this.plan.stairs.forEach(s => {
      this.stairUsage.set(s.id, 0);
    });
  }
  
  setUpdateCallback(callback: (state: { students: Student[]; conflicts: Conflict[]; statistics: Statistics }) => void): void {
    this.onUpdate = callback;
  }
  
  start(): void {
    this.isRunning = true;
  }
  
  pause(): void {
    this.isRunning = false;
  }
  
  getCurrentTime(): number {
    return this.currentTime;
  }
  
  getStudents(): Student[] {
    return this.students;
  }
  
  getConflicts(): Conflict[] {
    return this.conflicts;
  }
  
  getStairUsage(): Map<string, number> {
    return this.stairUsage;
  }
  
  update(deltaTime: number, speedMultiplier: number = 1): void {
    if (!this.isRunning) return;
    
    const dt = deltaTime * speedMultiplier;
    this.currentTime += dt;
    
    this.students.forEach(student => {
      if (this.currentTime < student.startTime) {
        return;
      }
      
      if (student.status === 'waiting') {
        student.status = 'moving';
      }
      
      if (student.status === 'arrived') {
        return;
      }
      
      const target = student.path[student.currentPathIndex];
      if (!target) {
        student.status = 'arrived';
        student.arrivalTime = this.currentTime;
        return;
      }
      
      const dist = distance(student.position, target);
      const moveSpeed = student.speed * dt;
      
      if (dist <= moveSpeed) {
        student.position = { ...target };
        student.currentPathIndex++;
        
        if (student.currentPathIndex >= student.path.length) {
          student.status = 'arrived';
          student.arrivalTime = this.currentTime;
        }
      } else {
        const t = moveSpeed / dist;
        student.position = {
          x: lerp(student.position.x, target.x, t),
          y: lerp(student.position.y, target.y, t),
          z: lerp(student.position.z, target.z, t)
        };
      }
      
      this.updateStudentStatus(student);
    });
    
    this.updateStairUsage();
    this.detectConflicts();
    
    if (this.onUpdate) {
      this.onUpdate({
        students: this.students,
        conflicts: this.conflicts,
        statistics: this.getStatistics()
      });
    }
  }
  
  private updateStudentStatus(student: Student): void {
    const stair = this.plan.stairs.find(s => {
      const dist = distance(student.position, {
        x: s.position.x,
        y: student.position.y,
        z: s.position.z
      });
      return dist < 4;
    });
    
    if (stair && student.position.y > 0.5) {
      student.status = 'inStair';
    } else if (student.status !== 'arrived') {
      student.status = 'moving';
    }
  }
  
  private updateStairUsage(): void {
    this.plan.stairs.forEach(stair => {
      let count = 0;
      this.students.forEach(student => {
        if (student.status === 'inStair') {
          const dist = distance(student.position, {
            x: stair.position.x,
            y: student.position.y,
            z: stair.position.z
          });
          if (dist < 5) count++;
        }
      });
      this.stairUsage.set(stair.id, count);
    });
  }
  
  private detectConflicts(): void {
    this.plan.stairs.forEach(stair => {
      const usage = this.stairUsage.get(stair.id) || 0;
      const capacityRatio = usage / stair.capacity;
      
      if (capacityRatio >= 0.9) {
        const existingConflict = this.conflicts.find(
          c => c.type === 'stairCapacity' && c.location === stair.name && !c.resolved
        );
        
        if (!existingConflict) {
          this.conflicts.push({
            id: `conflict-${Date.now()}-${stair.id}`,
            type: 'stairCapacity',
            time: this.currentTime,
            location: stair.name,
            description: `${stair.name}容量超过90%，当前${usage}人，容量${stair.capacity}人`,
            severity: capacityRatio >= 1.0 ? 'critical' : 'warning',
            resolved: false
          });
        }
      }
    });
    
    const waitingStudents = this.students.filter(s => s.status === 'waiting').length;
    if (waitingStudents > 200 && this.currentTime < 10) {
      const existingConflict = this.conflicts.find(
        c => c.type === 'order' && !c.resolved
      );
      
      if (!existingConflict) {
        this.conflicts.push({
          id: `conflict-order-${Date.now()}`,
          type: 'order',
          time: this.currentTime,
          location: '全校',
          description: `大量班级同时开始疏散，可能造成拥堵，当前等待${waitingStudents}人`,
          severity: 'warning',
          resolved: false
        });
      }
    }
    
    const arrivedStudents = this.students.filter(s => s.status === 'arrived').length;
    const totalCapacity = this.plan.assemblyPoints.reduce((sum, ap) => sum + ap.capacity, 0);
    
    if (arrivedStudents / totalCapacity >= 0.95) {
      const existingConflict = this.conflicts.find(
        c => c.type === 'assemblyCapacity' && !c.resolved
      );
      
      if (!existingConflict) {
        this.conflicts.push({
          id: `conflict-assembly-${Date.now()}`,
          type: 'assemblyCapacity',
          time: this.currentTime,
          location: '集合点',
          description: `集合点容量接近饱和，已到达${arrivedStudents}人，总容量${totalCapacity}人`,
          severity: 'critical',
          resolved: false
        });
      }
    }
  }
  
  getStatistics(): Statistics {
    const arrivedStudents = this.students.filter(s => s.status === 'arrived');
    const evacuationTimes = arrivedStudents
      .map(s => (s.arrivalTime || 0) - s.startTime)
      .filter(t => t > 0);
    
    const stairUtilization: Record<string, number> = {};
    this.stairUsage.forEach((value, key) => {
      const stair = this.plan.stairs.find(s => s.id === key);
      stairUtilization[key] = stair ? value / stair.capacity : 0;
    });
    
    const classroomCompletion: Record<string, number> = {};
    this.plan.classrooms.forEach(classroom => {
      const classroomStudents = this.students.filter(s => s.classroomId === classroom.id);
      const arrived = classroomStudents.filter(s => s.status === 'arrived').length;
      classroomCompletion[classroom.id] = classroomStudents.length > 0
        ? arrived / classroomStudents.length
        : 0;
    });
    
    return {
      totalStudents: this.students.length,
      evacuatedStudents: arrivedStudents.length,
      avgEvacuationTime: evacuationTimes.length > 0
        ? evacuationTimes.reduce((a, b) => a + b, 0) / evacuationTimes.length
        : 0,
      maxEvacuationTime: evacuationTimes.length > 0
        ? Math.max(...evacuationTimes)
        : 0,
      minEvacuationTime: evacuationTimes.length > 0
        ? Math.min(...evacuationTimes)
        : 0,
      maxStairUsage: Math.max(...Array.from(this.stairUsage.values()), 0),
      conflictCount: this.conflicts.filter(c => !c.resolved).length,
      stairUtilization,
      classroomCompletion
    };
  }
  
  isComplete(): boolean {
    return this.students.every(s => s.status === 'arrived');
  }
}
