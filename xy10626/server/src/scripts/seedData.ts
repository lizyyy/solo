import sequelize from '../database';
import TicketInventory from '../models/TicketInventory';
import WaitlistQueue from '../models/WaitlistQueue';

async function seedData() {
  try {
    await sequelize.sync({ force: true });
    console.log('Database reset');

    const inventories = await TicketInventory.bulkCreate([
      {
        ticketGrade: 'VIP',
        price: 1280,
        totalQuantity: 50,
        usedQuantity: 20,
        lockedQuantity: 10,
        availableQuantity: 20,
        status: 'active',
        createdBy: 'admin'
      },
      {
        ticketGrade: 'A区',
        price: 880,
        totalQuantity: 100,
        usedQuantity: 45,
        lockedQuantity: 15,
        availableQuantity: 40,
        status: 'active',
        createdBy: 'admin'
      },
      {
        ticketGrade: 'B区',
        price: 580,
        totalQuantity: 200,
        usedQuantity: 80,
        lockedQuantity: 20,
        availableQuantity: 100,
        status: 'active',
        createdBy: 'admin'
      },
      {
        ticketGrade: 'C区',
        price: 280,
        totalQuantity: 300,
        usedQuantity: 150,
        lockedQuantity: 30,
        availableQuantity: 120,
        status: 'active',
        createdBy: 'admin'
      }
    ]);
    console.log('Created ticket inventories:', inventories.length);

    const waitlists = await WaitlistQueue.bulkCreate([
      {
        orderNo: 'WL202401001',
        customerName: '张三',
        customerPhone: '13800138001',
        ticketGrade: 'VIP',
        quantity: 2,
        priority: 10,
        status: 'pending',
        isLocked: false
      },
      {
        orderNo: 'WL202401002',
        customerName: '李四',
        customerPhone: '13800138002',
        ticketGrade: 'A区',
        quantity: 3,
        priority: 8,
        status: 'pending',
        isLocked: false
      },
      {
        orderNo: 'WL202401003',
        customerName: '王五',
        customerPhone: '13800138003',
        ticketGrade: 'B区',
        quantity: 1,
        priority: 5,
        status: 'processing',
        isLocked: true,
        lockedBy: 'operator1',
        lockedAt: new Date(Date.now() - 40 * 60 * 1000)
      },
      {
        orderNo: 'WL202401004',
        customerName: '赵六',
        customerPhone: '13800138004',
        ticketGrade: 'VIP',
        quantity: 4,
        priority: 9,
        status: 'confirmed',
        isLocked: true,
        lockedBy: 'operator2',
        lockedAt: new Date(),
        assignedSeats: JSON.stringify(['A01', 'A02', 'A03', 'A04']),
        processedBy: 'operator2'
      },
      {
        orderNo: 'WL202401005',
        customerName: '钱七',
        customerPhone: '13800138005',
        ticketGrade: 'C区',
        quantity: 2,
        priority: 3,
        status: 'paid',
        isLocked: false,
        assignedSeats: JSON.stringify(['C10', 'C11']),
        paidAt: new Date(),
        processedBy: 'operator1'
      },
      {
        orderNo: 'WL202401006',
        customerName: '孙八',
        customerPhone: '13800138006',
        ticketGrade: 'A区',
        quantity: 2,
        priority: 7,
        status: 'cancelled',
        isLocked: false
      },
      {
        orderNo: 'WL202401007',
        customerName: '周九',
        customerPhone: '13800138007',
        ticketGrade: 'B区',
        quantity: 5,
        priority: 6,
        status: 'pending',
        isLocked: false
      },
      {
        orderNo: 'WL202401008',
        customerName: '吴十',
        customerPhone: '13800138008',
        ticketGrade: 'VIP',
        quantity: 1,
        priority: 4,
        status: 'pending',
        isLocked: false
      }
    ]);
    console.log('Created waitlist queues:', waitlists.length);

    console.log('Data seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

seedData();
