import { Class, Teacher } from '../types';
import { ClassRepository, TeacherRepository } from '../repositories';
import { BusinessError, ErrorCodes } from '../errors';

export class ClassService {
  private readonly classRepository: ClassRepository;
  private readonly teacherRepository: TeacherRepository;

  constructor() {
    this.classRepository = new ClassRepository();
    this.teacherRepository = new TeacherRepository();
  }

  async createClass(data: {
    name: string;
    teacher_id: string;
    dance_style?: string;
    capacity?: number;
    description?: string;
  }): Promise<Class> {
    const teacher = this.teacherRepository.findById(data.teacher_id);
    if (!teacher) {
      throw new BusinessError(ErrorCodes.TEACHER_NOT_FOUND, '老师不存在');
    }

    return this.classRepository.create({
      name: data.name,
      teacher_id: data.teacher_id,
      dance_style: data.dance_style,
      capacity: data.capacity ?? 10,
      description: data.description,
      status: 'active',
    });
  }

  async updateClass(id: string, data: Partial<Class>): Promise<Class> {
    const cls = this.classRepository.findById(id);
    if (!cls) {
      throw new BusinessError(ErrorCodes.CLASS_NOT_FOUND, '班级不存在');
    }

    if (data.teacher_id) {
      const teacher = this.teacherRepository.findById(data.teacher_id);
      if (!teacher) {
        throw new BusinessError(ErrorCodes.TEACHER_NOT_FOUND, '老师不存在');
      }
    }

    const updated = this.classRepository.update(id, data);
    if (!updated) {
      throw new BusinessError(ErrorCodes.CLASS_NOT_FOUND, '班级不存在');
    }
    return updated;
  }

  async getClass(id: string): Promise<Class & { teacher?: Teacher }> {
    const cls = this.classRepository.findById(id);
    if (!cls) {
      throw new BusinessError(ErrorCodes.CLASS_NOT_FOUND, '班级不存在');
    }
    const teacher = this.teacherRepository.findById(cls.teacher_id);
    return { ...cls, teacher };
  }

  async getAllClasses(): Promise<Class[]> {
    return this.classRepository.findAll();
  }

  async getActiveClasses(): Promise<Class[]> {
    return this.classRepository.findActive();
  }

  async getClassesByTeacher(teacherId: string): Promise<Class[]> {
    return this.classRepository.findByTeacherId(teacherId);
  }

  async deactivateClass(id: string): Promise<Class> {
    return this.updateClass(id, { status: 'inactive' });
  }

  async activateClass(id: string): Promise<Class> {
    return this.updateClass(id, { status: 'active' });
  }
}
