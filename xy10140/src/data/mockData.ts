import { TableRow } from '../types';

const FIRST_NAMES = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', '郑一', '冯二'];
const LAST_NAMES = ['开发部', '市场部', '销售部', '人事部', '财务部', '技术部', '运营部', '产品部'];
const STATUS = ['active', 'inactive', 'pending', 'archived'];
const CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京'];

export function generateMockData(count: number = 100): TableRow[] {
  const data: TableRow[] = [];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const status = STATUS[Math.floor(Math.random() * STATUS.length)];
    const city = CITIES[Math.floor(Math.random() * CITIES.length)];
    const age = 22 + Math.floor(Math.random() * 40);
    const salary = 5000 + Math.floor(Math.random() * 50000);
    const joinDate = new Date(now - Math.random() * 365 * 24 * 60 * 60 * 1000);
    
    data.push({
      id: `user_${i + 1}`,
      name: `${firstName}${i + 1}`,
      department: lastName,
      status,
      city,
      age,
      salary,
      joinDate: joinDate.toISOString().split('T')[0],
    });
  }
  
  return data;
}

export const MOCK_DATA: TableRow[] = generateMockData(100);

export const TABLE_COLUMNS = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: '姓名' },
  { key: 'department', label: '部门' },
  { key: 'status', label: '状态' },
  { key: 'city', label: '城市' },
  { key: 'age', label: '年龄' },
  { key: 'salary', label: '薪资' },
  { key: 'joinDate', label: '入职日期' },
];
