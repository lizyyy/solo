import { EvacuationPlan, Student, Conflict, Statistics, Position } from '@/types';

const STUDENT_SPEED = 3.5;
const STAIR_SPEED_FACTOR = 0.5;
const PERSONAL_SPACE = 0.5;
const STAIR_ENTRY_RADIUS = 6;

interface StairQueue {
  stairId: string;
  queue: Student[];
}

interface BlockageEvent {
  id: string;
  time: number;
  stairId: string;
  blockingClassroom: string;
  blockedClassrooms: string[];
  duration: number;
  resolved: boolean;
}

function generatePath(
  classroomPos: Position,
  stairPos: Position,
  assemblyPos: Position
): Position[] {
  const path: Position[] = [];
  
  path.push({ ...classroomPos });
  
  path.push({
    x: stairPos.x,
    y: classroomPos.y,
    z: stairPos.z
  });
  
  path.push({
    x: stairPos.x,
    y: 0,
    z: stairPos.z
  });
  
  path.push({ ...assemblyPos });
  
  return path;
}

function initializeStudents(plan: EvacuationPlan): Student[] {
  const students: Student[] = [];
  let studentId = 0;
  
  plan.classrooms.forEach(classroom => {
    const stair = plan.stairs.find(s => s.id === classroom.assignedStairId);
    if (!stair || stair.isClosed) {
      const altStair = plan.stairs.find(s => !s.isClosed && s.floors.includes(classroom.floor));
      if (!altStair) return;
    }
    
    const activeStair = stair && !stair.isClosed ? stair : plan.stairs.find(s => !s.isClosed && s.floors.includes(classroom.floor));
    if (!activeStair) return;
    
    const assemblyPoint = plan.assemblyPoints[
      Math.floor(Math.random() * plan.assemblyPoints.length)
    ];
    
    const path = generatePath(
      classroom.position,
      activeStair.position,
      assemblyPoint.position
    );
    
    for (let i = 0; i < classroom.studentCount; i++) {
      const offset = {
        x: (Math.random() - 0.5) * 2,
        y: 0,
        z: (Math.random() - 0.5) * 2
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
        speed: STUDENT_SPEED * (0.9 + Math.random() * 0.2),
        startTime: classroom.exitDelay + i * 0.05,
        arrivalTime: null,
        queueTime: 0,
        rerouted: false
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
  private blockageEvents: BlockageEvent[] = [];
  private currentTime: number = 0;
  private isRunning: boolean = false;
  private stairQueues: Map<string, StairQueue> = new Map();
  private stairUsage: Map<string, number> = new Map();
  private maxQueueLength: number = 0;
  private onUpdate: ((state: { students: Student[]; conflicts: Conflict[]; statistics: Statistics }) => void) | null = null;
  
  constructor(plan: EvacuationPlan) {
    this.plan = plan;
    this.initializeStairQueues();
    this.reset();
  }
  
  private initializeStairQueues(): void {
    this.stairQueues.clear();
    this.plan.stairs.forEach(stair => {
      this.stairQueues.set(stair.id, {
        stairId: stair.id,
        queue: []
      });
    });
  }
  
  reset(): void {
    this.students = initializeStudents(this.plan);
    this.conflicts = [];
    this.blockageEvents = [];
    this.currentTime = 0;
    this.maxQueueLength = 0;
    this.initializeStairQueues();
    this.stairUsage = new Map();
    this.plan.stairs.forEach(s => {
      this.stairUsage.set(s.id, 0);
    });
  }
  
  setPlan(plan: EvacuationPlan): void {
    this.plan = plan;
    this.initializeStairQueues();
    this.reset();
  }
  
  getPlan(): EvacuationPlan {
    return this.plan;
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
  
  getStairQueues(): Map<string, StairQueue> {
    return this.stairQueues;
  }
  
  getBlockageEvents(): BlockageEvent[] {
    return this.blockageEvents;
  }
  
  private getStudentsNearStair(stairId: string): number {
    const stair = this.plan.stairs.find(s => s.id === stairId);
    if (!stair) return 0;
    
    return this.students.filter(student => {
      if (student.status === 'arrived') return false;
      if (student.status === 'waiting') return false;
      if (student.status === 'queued') return false;
      
      const dist = Math.sqrt(
        Math.pow(student.position.x - stair.position.x, 2) +
        Math.pow(student.position.z - stair.position.z, 2)
      );
      return dist < 12;
    }).length;
  }
  
  private getStudentsApproachingStair(stairId: string): number {
    const stair = this.plan.stairs.find(s => s.id === stairId);
    if (!stair) return 0;
    
    return this.students.filter(student => {
      if (student.status === 'arrived') return false;
      if (student.status === 'waiting') return false;
      if (student.status === 'queued') return false;
      
      const dist = Math.sqrt(
        Math.pow(student.position.x - stair.position.x, 2) +
        Math.pow(student.position.z - stair.position.z, 2)
      );
      return dist < 15;
    }).length;
  }
  
  private checkStudentCollision(student: Student, newPos: Position): boolean {
    let checkCount = 0;
    for (const other of this.students) {
      if (other.id === student.id) continue;
      if (other.status === 'arrived') continue;
      if (other.status === 'waiting') continue;
      if (other.status === 'queued') continue;
      
      const dist = distance(newPos, other.position);
      if (dist < PERSONAL_SPACE) {
        return true;
      }
      
      checkCount++;
      if (checkCount > 20) break;
    }
    return false;
  }
  
  private isNearStair(student: Student, stairId: string): boolean {
    const stair = this.plan.stairs.find(s => s.id === stairId);
    if (!stair) return false;
    
    const dist = Math.sqrt(
      Math.pow(student.position.x - stair.position.x, 2) +
      Math.pow(student.position.z - stair.position.z, 2)
    );
    
    return dist < STAIR_ENTRY_RADIUS;
  }
  
  private isInStairwell(student: Student): boolean {
    return this.plan.stairs.some(stair => {
      const dist = Math.sqrt(
        Math.pow(student.position.x - stair.position.x, 2) +
        Math.pow(student.position.z - stair.position.z, 2)
      );
      return dist < 8;
    });
  }
  
  update(deltaTime: number, speedMultiplier: number = 1): void {
    if (!this.isRunning) return;
    
    const dt = deltaTime * speedMultiplier;
    this.currentTime += dt;
    
    this.students.forEach(student => {
      if (this.currentTime < student.startTime) return;
      if (student.status === 'waiting') {
        student.status = 'moving';
      }
      if (student.status === 'arrived' || student.status === 'queued') return;
      
      const inStair = this.isInStairwell(student) && student.position.y > 0.1;
      if (inStair) {
        student.status = 'inStair';
      } else {
        student.status = 'moving';
      }
    });
    
    this.plan.stairs.forEach(stair => {
      if (stair.isClosed) return;
      
      const queue = this.stairQueues.get(stair.id);
      if (!queue) return;
      
      const inStairCount = this.getStudentsInStair(stair.id);
      const availableSlots = Math.max(0, stair.capacity - inStairCount);
      
      const toRelease = Math.min(availableSlots, 15);
      for (let i = 0; i < toRelease && queue.queue.length > 0; i++) {
        const student = queue.queue.shift();
        if (student) {
          student.status = 'moving';
        }
      }
    });
    
    this.students.forEach(student => {
      if (this.currentTime < student.startTime) {
        return;
      }
      
      if (student.status === 'arrived') {
        return;
      }
      
      if (student.status === 'queued') {
        student.queueTime = (student.queueTime || 0) + dt;
        return;
      }
      
      const target = student.path[student.currentPathIndex];
      if (!target) {
        student.status = 'arrived';
        student.arrivalTime = this.currentTime;
        return;
      }
      
      const classroom = this.plan.classrooms.find(c => c.id === student.classroomId);
      const assignedStairId = classroom?.assignedStairId;
      
      if (assignedStairId && this.isNearStair(student, assignedStairId) && student.position.y > 0.1) {
        const stair = this.plan.stairs.find(s => s.id === assignedStairId);
        if (stair && !stair.isClosed) {
          const queue = this.stairQueues.get(assignedStairId);
          const inStairCount = this.getStudentsInStair(assignedStairId);
          
          const isInQueue = queue?.queue.includes(student);
          
          if (!isInQueue && inStairCount >= stair.capacity * 0.95) {
            if (queue) {
              student.status = 'queued';
              queue.queue.push(student);
            }
            return;
          }
        }
      }
      
      const inStair = this.isInStairwell(student) && student.position.y > 0.1;
      const currentSpeed = inStair 
        ? student.speed * STAIR_SPEED_FACTOR 
        : student.speed;
      
      const dist = distance(student.position, target);
      const moveSpeed = currentSpeed * dt;
      
      if (dist <= moveSpeed) {
        student.position = { ...target };
        student.currentPathIndex++;
        
        if (student.currentPathIndex >= student.path.length) {
          student.status = 'arrived';
          student.arrivalTime = this.currentTime;
        }
      } else {
        const t = moveSpeed / dist;
        const newPos = {
          x: lerp(student.position.x, target.x, t),
          y: lerp(student.position.y, target.y, t),
          z: lerp(student.position.z, target.z, t)
        };
        
        if (!this.checkStudentCollision(student, newPos)) {
          student.position = newPos;
        } else {
          const altPos = {
            x: newPos.x + (Math.random() - 0.5) * 0.5,
            y: newPos.y,
            z: newPos.z + (Math.random() - 0.5) * 0.5
          };
          if (!this.checkStudentCollision(student, altPos)) {
            student.position = altPos;
          }
        }
      }
      
      if (inStair) {
        student.status = 'inStair';
      } else if (student.status !== 'arrived') {
        student.status = 'moving';
      }
    });
    
    this.updateStairUsage();
    this.detectConflicts();
    this.detectBlockages();
    
    const currentQueueLength = Array.from(this.stairQueues.values())
      .reduce((sum, q) => sum + q.queue.length, 0);
    if (currentQueueLength > this.maxQueueLength) {
      this.maxQueueLength = currentQueueLength;
    }
    
    if (this.onUpdate) {
      this.onUpdate({
        students: this.students,
        conflicts: this.conflicts,
        statistics: this.getStatistics()
      });
    }
  }
  
  private getStudentsInStair(stairId: string): number {
    const stair = this.plan.stairs.find(s => s.id === stairId);
    if (!stair) return 0;
    
    return this.students.filter(student => {
      if (student.status === 'arrived') return false;
      if (student.status === 'waiting') return false;
      if (student.status === 'queued') return false;
      if (student.position.y < 0.1) return false;
      
      const dist = Math.sqrt(
        Math.pow(student.position.x - stair.position.x, 2) +
        Math.pow(student.position.z - stair.position.z, 2)
      );
      return dist < 10;
    }).length;
  }
  
  private updateStairUsage(): void {
    this.plan.stairs.forEach(stair => {
      const count = this.getStudentsInStair(stair.id);
      this.stairUsage.set(stair.id, count);
    });
  }
  
  private detectBlockages(): void {
    this.plan.stairs.forEach(stair => {
      if (stair.isClosed) return;
      
      const queue = this.stairQueues.get(stair.id);
      if (!queue || queue.queue.length === 0) return;
      
      const queuedByClassroom: Record<string, Student[]> = {};
      queue.queue.forEach(student => {
        if (!queuedByClassroom[student.classroomId]) {
          queuedByClassroom[student.classroomId] = [];
        }
        queuedByClassroom[student.classroomId].push(student);
      });
      
      const classroomIds = Object.keys(queuedByClassroom);
      if (classroomIds.length < 2) return;
      
      const classrooms = classroomIds.map(id => 
        this.plan.classrooms.find(c => c.id === id)
      ).filter(Boolean);
      
      classrooms.sort((a, b) => (a?.exitOrder || 0) - (b?.exitOrder || 0));
      
      const firstClassroom = classrooms[0];
      const laterClassrooms = classrooms.slice(1);
      
      if (firstClassroom && laterClassrooms.length > 0) {
        const earlierGrade = firstClassroom.grade;
        const blockedHigherGrade = laterClassrooms.some(c => c && c.grade < earlierGrade);
        
        if (blockedHigherGrade) {
          const blockedClassroomNames = laterClassrooms
            .filter(c => c && c.grade < earlierGrade)
            .map(c => c?.name)
            .join(', ');
          
          const existingBlockage = this.blockageEvents.find(
            b => b.stairId === stair.id && !b.resolved
          );
          
          if (!existingBlockage) {
            this.blockageEvents.push({
              id: `blockage-${Date.now()}`,
              time: this.currentTime,
              stairId: stair.id,
              blockingClassroom: firstClassroom.name,
              blockedClassrooms: laterClassrooms.filter(c => c && c.grade < earlierGrade).map(c => c?.id || ''),
              duration: 0,
              resolved: false
            });
            
            this.conflicts.push({
              id: `conflict-blockage-${Date.now()}`,
              type: 'order',
              time: this.currentTime,
              location: stair.name,
              description: `低年级班级(${blockedClassroomNames})被${firstClassroom.name}堵住，在${stair.name}形成排队`,
              severity: 'critical',
              resolved: false
            });
          }
        }
      }
    });
  }
  
  private detectConflicts(): void {
    this.plan.stairs.forEach(stair => {
      if (stair.isClosed) return;
      
      const usage = this.stairUsage.get(stair.id) || 0;
      const capacityRatio = usage / stair.capacity;
      const queue = this.stairQueues.get(stair.id);
      const queueLength = queue?.queue.length || 0;
      
      if (capacityRatio >= 0.9 || queueLength > 15) {
        const existingConflict = this.conflicts.find(
          c => c.type === 'stairCapacity' && c.location === stair.name && !c.resolved
        );
        
        if (!existingConflict) {
          this.conflicts.push({
            id: `conflict-${Date.now()}-${stair.id}`,
            type: 'stairCapacity',
            time: this.currentTime,
            location: stair.name,
            description: `${stair.name}容量饱和，当前${usage}人，排队${queueLength}人，容量${stair.capacity}人`,
            severity: capacityRatio >= 1.0 ? 'critical' : 'warning',
            resolved: false
          });
        }
      }
    });
    
    const totalQueueLength = Array.from(this.stairQueues.values())
      .reduce((sum, q) => sum + q.queue.length, 0);
    
    if (totalQueueLength > 80 && this.currentTime < 120) {
      const existingConflict = this.conflicts.find(
        c => c.type === 'order' && c.location === '全校' && !c.resolved
      );
      
      if (!existingConflict) {
        this.conflicts.push({
          id: `conflict-order-${Date.now()}`,
          type: 'order',
          time: this.currentTime,
          location: '全校',
          description: `大面积排队，总排队人数${totalQueueLength}人，疏散顺序可能不合理`,
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
    const classroomQueueTime: Record<string, number> = {};
    
    this.plan.classrooms.forEach(classroom => {
      const classroomStudents = this.students.filter(s => s.classroomId === classroom.id);
      const arrived = classroomStudents.filter(s => s.status === 'arrived').length;
      const totalQueueTime = classroomStudents.reduce((sum, s) => sum + (s.queueTime || 0), 0);
      
      classroomCompletion[classroom.id] = classroomStudents.length > 0
        ? arrived / classroomStudents.length
        : 0;
      classroomQueueTime[classroom.id] = classroomStudents.length > 0
        ? totalQueueTime / classroomStudents.length
        : 0;
    });
    
    const currentQueueLength = Array.from(this.stairQueues.values())
      .reduce((sum, q) => sum + q.queue.length, 0);
    
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
      classroomCompletion,
      classroomQueueTime,
      totalQueueLength: this.maxQueueLength,
      currentQueueLength,
      blockageCount: this.blockageEvents.filter(b => !b.resolved).length
    };
  }
  
  isComplete(): boolean {
    return this.students.every(s => s.status === 'arrived');
  }
}
