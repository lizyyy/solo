const storage = require('../src/storage');
const { Room, Device, Student, Booking } = require('../src/models');

function generateSeedData() {
  storage.reset();

  const rooms = [
    new Room(null, '研讨间A101', 6, '图书馆一楼A区', ['投影仪', '白板', '电源插座']),
    new Room(null, '研讨间A102', 8, '图书馆一楼A区', ['投影仪', '白板', '电视', '电源插座']),
    new Room(null, '研讨间B201', 4, '图书馆二楼B区', ['白板', '电源插座']),
    new Room(null, '研讨间B202', 10, '图书馆二楼B区', ['投影仪', '白板', '电视', '视频会议系统', '电源插座']),
    new Room(null, '研讨间C301', 6, '图书馆三楼C区', ['投影仪', '白板', '电源插座'])
  ];

  rooms.forEach(room => storage.addRoom(room));

  const devices = [
    new Device(null, '投影仪A101-01', 'projector', rooms[0].id, 'available'),
    new Device(null, '白板笔套装A101', 'whiteboard_marker', rooms[0].id, 'available'),
    new Device(null, '投影仪A102-01', 'projector', rooms[1].id, 'available'),
    new Device(null, '电视A102-01', 'tv', rooms[1].id, 'available'),
    new Device(null, '白板笔套装A102', 'whiteboard_marker', rooms[1].id, 'available'),
    new Device(null, '白板笔套装B201', 'whiteboard_marker', rooms[2].id, 'available'),
    new Device(null, '投影仪B202-01', 'projector', rooms[3].id, 'available'),
    new Device(null, '电视B202-01', 'tv', rooms[3].id, 'available'),
    new Device(null, '视频会议设备B202', 'video_conference', rooms[3].id, 'available'),
    new Device(null, '白板笔套装B202', 'whiteboard_marker', rooms[3].id, 'available'),
    new Device(null, '投影仪C301-01', 'projector', rooms[4].id, 'available'),
    new Device(null, '白板笔套装C301', 'whiteboard_marker', rooms[4].id, 'available')
  ];

  devices.forEach(device => storage.addDevice(device));

  const students = [
    new Student(null, '2024001', '张三', 'zhangsan@university.edu'),
    new Student(null, '2024002', '李四', 'lisi@university.edu'),
    new Student(null, '2024003', '王五', 'wangwu@university.edu'),
    new Student(null, '2024004', '赵六', 'zhaoliu@university.edu'),
    new Student(null, '2024005', '孙七', 'sunqi@university.edu'),
    new Student(null, '2024006', '周八', 'zhouba@university.edu'),
    new Student(null, '2024007', '吴九', 'wujiu@university.edu'),
    new Student(null, '2024008', '郑十', 'zhengshi@university.edu')
  ];

  students.forEach(student => storage.addStudent(student));

  console.log('种子数据生成完成！');
  console.log(`- 房间: ${rooms.length} 个`);
  console.log(`- 设备: ${devices.length} 个`);
  console.log(`- 学生: ${students.length} 个`);
  console.log('\n学生列表:');
  students.forEach(s => {
    console.log(`  ${s.studentId} - ${s.name} (ID: ${s.id})`);
  });
  console.log('\n房间列表:');
  rooms.forEach(r => {
    console.log(`  ${r.name} - ${r.location} (容量: ${r.capacity}人, ID: ${r.id})`);
  });
}

generateSeedData();