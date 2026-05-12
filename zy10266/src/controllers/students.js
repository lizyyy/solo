const storage = require('../storage');

function getStudents(req, res) {
  const students = storage.getStudents();
  res.json({ success: true, data: students });
}

function getStudentById(req, res) {
  const student = storage.getStudentById(req.params.id);
  if (!student) {
    return res.status(404).json({ success: false, error: '学生不存在' });
  }
  res.json({ success: true, data: student });
}

function getStudentCreditScore(req, res) {
  const student = storage.getStudentById(req.params.id);
  if (!student) {
    return res.status(404).json({ success: false, error: '学生不存在' });
  }
  res.json({
    success: true,
    data: {
      studentId: student.id,
      name: student.name,
      creditScore: student.creditScore,
      noShowCount: student.noShowCount,
      isBlacklisted: student.isBlacklisted,
      blacklistedUntil: student.blacklistedUntil,
      isAllowedToBook: student.isAllowedToBook ? student.isAllowedToBook() : true
    }
  });
}

module.exports = {
  getStudents,
  getStudentById,
  getStudentCreditScore
};