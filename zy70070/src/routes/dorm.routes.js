const express = require('express');
const router = express.Router();
const DormRepository = require('../repositories/dorm.repository');
const StudentRepository = require('../repositories/student.repository');
const { db } = require('../db/database');

router.get('/buildings', (req, res) => {
  const buildings = DormRepository.getBuildings();
  res.json({ success: true, data: buildings });
});

router.post('/buildings', (req, res) => {
  try {
    const { building_code, building_name, floors } = req.body;
    if (!building_code || !building_name) {
      return res.status(400).json({
        success: false,
        message: '缺少楼栋代码或名称'
      });
    }
    
    const id = DormRepository.createBuilding(building_code, building_name, floors);
    res.json({ success: true, data: { id, building_code, building_name } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/buildings/:buildingId/rooms', (req, res) => {
  const rooms = DormRepository.getRoomsByBuilding(parseInt(req.params.buildingId));
  res.json({ success: true, data: rooms });
});

router.post('/rooms', (req, res) => {
  try {
    const { building_id, floor_number, room_number, bed_count, fee_per_semester } = req.body;
    if (!building_id || !floor_number || !room_number) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }
    
    const roomId = DormRepository.createRoom(
      building_id,
      floor_number,
      room_number,
      bed_count || 4,
      fee_per_semester || 1200
    );
    
    DormRepository.createBedsForRoom(roomId, bed_count || 4);
    
    res.json({ success: true, data: { id: roomId, message: '房间及床位创建成功' } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/beds/available', (req, res) => {
  const beds = DormRepository.getAvailableBeds();
  res.json({ success: true, data: beds });
});

router.get('/beds/:bedId', (req, res) => {
  const bed = DormRepository.getBedById(parseInt(req.params.bedId));
  if (!bed) {
    return res.status(404).json({ success: false, message: '床位不存在' });
  }
  res.json({ success: true, data: bed });
});

router.get('/beds/code/:bedCode', (req, res) => {
  const bed = DormRepository.getBedByCode(req.params.bedCode);
  if (!bed) {
    return res.status(404).json({ success: false, message: '床位不存在' });
  }
  res.json({ success: true, data: bed });
});

router.post('/students', (req, res) => {
  try {
    const id = StudentRepository.createStudent(req.body);
    const student = StudentRepository.getStudentById(id);
    res.json({ success: true, data: student });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/students', (req, res) => {
  const students = StudentRepository.getStudents();
  res.json({ success: true, data: students });
});

router.get('/students/:studentId', (req, res) => {
  const student = StudentRepository.getStudentById(parseInt(req.params.studentId));
  if (!student) {
    return res.status(404).json({ success: false, message: '学生不存在' });
  }
  res.json({ success: true, data: student });
});

router.get('/students/no/:studentNo', (req, res) => {
  const student = StudentRepository.getStudentByNo(req.params.studentNo);
  if (!student) {
    return res.status(404).json({ success: false, message: '学生不存在' });
  }
  res.json({ success: true, data: student });
});

router.post('/students/:studentId/assign-bed', (req, res) => {
  try {
    const { bed_id } = req.body;
    const studentId = parseInt(req.params.studentId);
    const bed = DormRepository.getBedById(bed_id);
    
    if (!bed || bed.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: '床位不可用'
      });
    }
    
    const transaction = db.transaction(() => {
      DormRepository.updateBedStatus(bed_id, 'occupied', studentId);
      StudentRepository.updateStudentBed(studentId, bed_id);
    });
    
    transaction();
    
    res.json({ success: true, data: { message: '床位分配成功' } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;