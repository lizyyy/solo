import { Student } from '../types';
import { StudentRepository } from '../repositories';
import { BusinessError, ErrorCodes } from '../errors';

export class StudentService {
  private readonly repository: StudentRepository;

  constructor() {
    this.repository = new StudentRepository();
  }

  async createStudent(data: {
    name: string;
    phone?: string;
    guardian_name?: string;
    guardian_phone?: string;
    gender?: 'male' | 'female';
    birth_date?: string;
    notes?: string;
  }): Promise<Student> {
    return this.repository.create({
      name: data.name,
      phone: data.phone,
      guardian_name: data.guardian_name,
      guardian_phone: data.guardian_phone,
      gender: data.gender,
      birth_date: data.birth_date,
      status: 'active',
      notes: data.notes,
    });
  }

  async updateStudent(id: string, data: Partial<Student>): Promise<Student> {
    const student = this.repository.findById(id);
    if (!student) {
      throw new BusinessError(ErrorCodes.STUDENT_NOT_FOUND, '学生不存在');
    }
    const updated = this.repository.update(id, data);
    if (!updated) {
      throw new BusinessError(ErrorCodes.STUDENT_NOT_FOUND, '学生不存在');
    }
    return updated;
  }

  async getStudent(id: string): Promise<Student> {
    const student = this.repository.findById(id);
    if (!student) {
      throw new BusinessError(ErrorCodes.STUDENT_NOT_FOUND, '学生不存在');
    }
    return student;
  }

  async getAllStudents(): Promise<Student[]> {
    return this.repository.findAll();
  }

  async getActiveStudents(): Promise<Student[]> {
    return this.repository.findActive();
  }

  async searchStudents(query: string): Promise<Student[]> {
    return this.repository.searchByNameOrPhone(query);
  }

  async deactivateStudent(id: string): Promise<Student> {
    return this.updateStudent(id, { status: 'inactive' });
  }

  async activateStudent(id: string): Promise<Student> {
    return this.updateStudent(id, { status: 'active' });
  }
}
