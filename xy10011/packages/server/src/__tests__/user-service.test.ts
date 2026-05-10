import { v4 as uuidv4 } from 'uuid';
import { userService } from '../services/user-service';
import { initDatabase } from '../database';

let testUserId: string;
let testClientId: string;

beforeAll(() => {
  process.env.DB_PATH = ':memory:';
  initDatabase();
  testUserId = uuidv4();
  testClientId = uuidv4();
});

describe('User Service', () => {
  test('should get or create user successfully', async () => {
    const userId = uuidv4();
    
    const user = await userService.getOrCreateUser(
      userId,
      { name: '测试用户' },
      testClientId
    );

    expect(user).toBeDefined();
    expect(user.id).toBe(userId);
    expect(user.name).toBe('测试用户');
    expect(user.createdAt).toBeGreaterThan(0);
  });

  test('should return existing user on getOrCreate', async () => {
    const userId = uuidv4();
    
    const user1 = await userService.getOrCreateUser(
      userId,
      { name: '第一次创建' },
      testClientId
    );

    const user2 = await userService.getOrCreateUser(
      userId,
      { name: '第二次创建' },
      testClientId
    );

    expect(user2.id).toBe(user1.id);
    expect(user2.name).toBe('第一次创建');
    expect(user2.createdAt).toBe(user1.createdAt);
  });

  test('should create user with explicit id', async () => {
    const userId = uuidv4();
    
    const user = await userService.createUser(
      {
        id: userId,
        name: '显式用户',
        avatar: 'http://example.com/avatar.png',
      },
      testClientId
    );

    expect(user.id).toBe(userId);
    expect(user.name).toBe('显式用户');
    expect(user.avatar).toBe('http://example.com/avatar.png');
  });

  test('should create user with generated id', async () => {
    const user = await userService.createUser(
      {
        name: '自动生成ID用户',
      },
      testClientId
    );

    expect(user.id).toBeTruthy();
    expect(user.name).toBe('自动生成ID用户');
  });

  test('should update user', async () => {
    const userId = uuidv4();
    
    const user = await userService.createUser(
      {
        id: userId,
        name: '原始名称',
      },
      testClientId
    );

    const updatedUser = await userService.updateUser(
      userId,
      { name: '更新后的名称' },
      testClientId,
      1
    );

    expect(updatedUser.name).toBe('更新后的名称');
    expect(updatedUser.updatedAt).toBeGreaterThan(user.updatedAt);
  });

  test('should get user by id', async () => {
    const userId = uuidv4();
    
    await userService.createUser(
      {
        id: userId,
        name: '查询测试用户',
      },
      testClientId
    );

    const foundUser = userService.getUserById(userId);
    
    expect(foundUser).toBeDefined();
    expect(foundUser?.id).toBe(userId);
    expect(foundUser?.name).toBe('查询测试用户');
  });

  test('should get all users', async () => {
    const initialUsers = userService.getAllUsers();
    const initialCount = initialUsers.length;

    await userService.createUser(
      { name: '用户1' },
      testClientId
    );
    
    await userService.createUser(
      { name: '用户2' },
      testClientId
    );

    const allUsers = userService.getAllUsers();
    expect(allUsers.length).toBeGreaterThanOrEqual(initialCount + 2);
  });

  test('should generate default name if not provided', async () => {
    const userId = uuidv4();
    
    const user = await userService.getOrCreateUser(
      userId,
      undefined,
      testClientId
    );

    expect(user.name).toBeTruthy();
    expect(user.name).toContain(userId.slice(-6));
  });
});
