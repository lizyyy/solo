const { db, getNextId, now } = require('../db/database');

class StudentRepository {
  static _enrichStudent(student) {
    if (!student) return null;
    const bed = student.current_bed_id ? db.data.beds.find(b => b.id === student.current_bed_id) : null;
    const room = bed ? db.data.dorm_rooms.find(r => r.id === bed.room_id) : null;
    const building = room ? db.data.buildings.find(b => b.id === room.building_id) : null;
    
    return {
      ...student,
      current_bed_code: bed?.bed_code || null,
      current_room_code: room?.room_code || null,
      current_building_name: building?.building_name || null
    };
  }
  
  static getStudents() {
    return db.data.students
      .map(s => this._enrichStudent(s))
      .sort((a, b) => a.student_no.localeCompare(b.student_no));
  }
  
  static getStudentByNo(studentNo) {
    const student = db.data.students.find(s => s.student_no === studentNo);
    return this._enrichStudent(student);
  }
  
  static getStudentById(id) {
    const student = db.data.students.find(s => s.id === id);
    return this._enrichStudent(student);
  }
  
  static createStudent(studentData) {
    const id = getNextId('students');
    const student = {
      id,
      student_no: studentData.student_no,
      name: studentData.name,
      gender: studentData.gender || null,
      class_name: studentData.class_name || null,
      major: studentData.major || null,
      phone: studentData.phone || null,
      current_bed_id: studentData.current_bed_id || null,
      status: 'active',
      created_at: now(),
      updated_at: now()
    };
    db.data.students.push(student);
    return id;
  }
  
  static updateStudentBed(studentId, bedId) {
    const student = db.data.students.find(s => s.id === studentId);
    if (!student) throw new Error('学生不存在');
    student.current_bed_id = bedId;
    student.updated_at = now();
    return true;
  }
}

module.exports = StudentRepository;