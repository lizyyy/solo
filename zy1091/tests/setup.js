const { sequelize } = require('../src/models');
const seedData = require('../src/database/seed');

// 在所有测试前同步数据库
beforeAll(async () => {
  // 使用内存数据库进行测试
  await sequelize.sync({ force: true });
});

// 在每个测试前重置数据库
beforeEach(async () => {
  await sequelize.sync({ force: true });
});

// 在所有测试后关闭数据库连接
afterAll(async () => {
  await sequelize.close();
});

// 辅助函数：创建测试室友
async function createTestFlatmates() {
  const { Flatmate } = require('../src/models');
  
  return await Flatmate.bulkCreate([
    {
      name: '测试用户1',
      email: 'test1@example.com',
      is_admin: true,
      points: 100,
      status: 'active',
    },
    {
      name: '测试用户2',
      email: 'test2@example.com',
      is_admin: false,
      points: 50,
      status: 'active',
    },
    {
      name: '测试用户3',
      email: 'test3@example.com',
      is_admin: false,
      points: 0,
      status: 'active',
    },
  ]);
}

// 辅助函数：使用种子数据
async function useSeedData() {
  return await seedData();
}

module.exports = {
  createTestFlatmates,
  useSeedData,
};
