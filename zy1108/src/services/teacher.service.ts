import { Teacher } from '../types';
import { TeacherRepository } from '../repositories';
import { BusinessError, ErrorCodes } from '../errors';

export class TeacherService {
  private readonly repository: TeacherRepository;

  constructor() {
    this.repository = new TeacherRepository();
  }

  async createTeacher(data: {
    name: string;
    phone?: string;
    email?: string;
    hourly_rate?: number;
  }): Promise<Teacher> {
    return this.repository.create({
      name: data.name,
      phone: data.phone,
      email: data.email,
      hourly_rate: data.hourly_rate ?? 0,
      status: 'active',
    });
  }

  async updateTeacher(id: string, data: Partial<Teacher>): Promise<Teacher> {
    const teacher = this.repository.findById(id);
    if (!teacher) {
      throw new BusinessError(ErrorCodes.TEACHER_NOT_FOUND, '老师不存在');
    }
    const updated = this.repository.update(id, data);
    if (!updated) {
      throw new BusinessError(ErrorCodes.TEACHER_NOT_FOUND, '老师不存在');
    }
    return updated;
  }

  async getTeacher(id: string): Promise<Teacher> {
    const teacher = this.repository.findById(id);
    if (!teacher) {
      throw new BusinessError(ErrorCodes.TEACHER_NOT_FOUND, '老师不存在');
    }
    return teacher;
  }

  async getAllTeachers(): Promise<Teacher[]> {
    return this.repository.findAll();
  }

  async getActiveTeachers(): Promise<Teacher[]> {
    return this.repository.findActive();
  }

  async deactivateTeacher(id: string): Promise<Teacher> {
    return this.updateTeacher(id, { status: 'inactive' });
  }

  async activateTeacher(id: string): Promise<Teacher> {
    return this.updateTeacher(id, { status: 'active' });
  }
}
