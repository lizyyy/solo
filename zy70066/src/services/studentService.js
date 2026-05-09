const storage = require('../storage');

function createStudent(params) {
  const student = {
    studentNo: params.studentNo,
    name: params.name,
    gender: params.gender,
    grade: params.grade,
    major: params.major,
    class: params.class,
    status: params.status || 'active'
  };
  return storage.insert('students', student);
}

function getStudent(id) {
  return storage.findById('students', id);
}

function getStudentByNo(studentNo) {
  return storage.findOne('students', s => s.studentNo === studentNo);
}

function getAllStudents() {
  return storage.findAll('students');
}

function updateStudent(id, updates) {
  return storage.update('students', id, updates);
}

module.exports = {
  createStudent,
  getStudent,
  getStudentByNo,
  getAllStudents,
  updateStudent
};
