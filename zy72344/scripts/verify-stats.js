const mockStudentAnswers = [
  { id: 'ans-001', studentId: 'stu-001', studentName: '张三', version: 1, content: '解法一...', status: 'exception', remark: '初始答案', createdAt: '2026-06-02 10:00:00' },
  { id: 'ans-002', studentId: 'stu-001', studentName: '张三', version: 2, content: '解法二...', status: 'reviewing', remark: '第二版答案', createdAt: '2026-06-02 15:30:00', manualExample: '手算验证：...' },
  { id: 'ans-003', studentId: 'stu-002', studentName: '李四', version: 1, content: '标准解法...', status: 'normal', remark: '答案正确', createdAt: '2026-06-02 11:20:00' },
  { id: 'ans-004', studentId: 'stu-003', studentName: '王五', version: 1, content: '计算过程...', status: 'pending', remark: '待审核', createdAt: '2026-06-03 09:15:00' },
];

console.log('\n' + '='.repeat(80));
console.log('  拉格朗日乘子配餐 - 统计逻辑快速验证');
console.log('='.repeat(80) + '\n');

const totalStudents = new Set(mockStudentAnswers.map(a => a.studentId)).size;
console.log(`学生总人数（去重）: ${totalStudents}`);

const multiVersionStudentIds = new Set(
  mockStudentAnswers
    .filter(a => mockStudentAnswers.filter(x => x.studentId === a.studentId).length > 1)
    .map(a => a.studentId)
);
const multiVersionStudentCount = multiVersionStudentIds.size;
const multiVersionStudents = Array.from(multiVersionStudentIds).map(id => ({
  id,
  name: mockStudentAnswers.find(a => a.studentId === id)?.studentName,
  versions: mockStudentAnswers.filter(a => a.studentId === id).length
}));

console.log(`多版答案学生数: ${multiVersionStudentCount} 人`);
console.log(`多版答案学生明细:`);
multiVersionStudents.forEach(s => {
  console.log(`  - ${s.name} (${s.id}): ${s.versions}版`);
});

console.log('');

if (multiVersionStudentCount === 1 && multiVersionStudents[0].name === '张三') {
  console.log('✅✅✅ 验证通过！');
  console.log('   多版答案学生只有张三1人，不是全部学生3人！');
} else {
  console.log('❌❌❌ 验证失败！');
  console.log(`   期望: 1人（张三）`);
  console.log(`   实际: ${multiVersionStudentCount}人`);
}

console.log('');
console.log('='.repeat(80) + '\n');
