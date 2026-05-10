const { v4: uuidv4 } = require('uuid');

const banquetHalls = new Map();
const menuVersions = new Map();
const waiters = new Map();
const bookings = new Map();
const resourceLocks = new Map();
const idempotentOperations = new Map();

const initSampleData = () => {
  banquetHalls.set('hall-a', {
    id: 'hall-a',
    name: '宴会厅 A',
    capacity: 200,
    pricePerHour: 5000,
    availableTimeSlots: generateTimeSlots('2026-05-15', '2026-06-30')
  });

  banquetHalls.set('hall-b', {
    id: 'hall-b',
    name: '宴会厅 B',
    capacity: 150,
    pricePerHour: 3000,
    availableTimeSlots: generateTimeSlots('2026-05-15', '2026-06-30')
  });

  menuVersions.set('menu-v1', {
    id: 'menu-v1',
    name: '婚礼套餐 1',
    version: 1,
    price: 1999,
    description: '8 道菜式，包含海鲜和甜点'
  });

  menuVersions.set('menu-v2', {
    id: 'menu-v2',
    name: '婚礼套餐 2',
    version: 2,
    price: 2999,
    description: '10 道菜式，包含龙虾和燕窝'
  });

  menuVersions.set('menu-v3', {
    id: 'menu-v3',
    name: '商务套餐',
    version: 1,
    price: 1599,
    description: '6 道菜式，适合商务宴请'
  });

  for (let i = 1; i <= 10; i++) {
    const waiterId = `waiter-${i}`;
    waiters.set(waiterId, {
      id: waiterId,
      name: `服务员 ${i}`,
      skills: ['宴会服务', '客户接待'],
      available: true,
      schedule: generateWaiterSchedule('2026-05-15', '2026-06-30')
    });
  }
};

const generateTimeSlots = (startDate, endDate) => {
  const slots = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    for (let hour = 10; hour < 22; hour += 2) {
      const slotDate = new Date(d);
      slotDate.setHours(hour, 0, 0, 0);
      slots.push({
        id: `slot-${slotDate.getTime()}`,
        startTime: slotDate.toISOString(),
        endTime: new Date(slotDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        available: true
      });
    }
  }
  
  return slots;
};

const generateWaiterSchedule = (startDate, endDate) => {
  const schedule = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    for (let hour = 9; hour < 22; hour += 4) {
      const slotDate = new Date(d);
      slotDate.setHours(hour, 0, 0, 0);
      schedule.push({
        id: `schedule-${slotDate.getTime()}`,
        startTime: slotDate.toISOString(),
        endTime: new Date(slotDate.getTime() + 4 * 60 * 60 * 1000).toISOString(),
        available: true
      });
    }
  }
  
  return schedule;
};

module.exports = {
  banquetHalls,
  menuVersions,
  waiters,
  bookings,
  resourceLocks,
  idempotentOperations,
  initSampleData,
  generateId: () => uuidv4()
};
