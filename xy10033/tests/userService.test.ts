import { v4 as uuidv4 } from 'uuid';
import { getDatabase, closeDatabase } from '../src/electron/database';
import * as userService from '../src/electron/services/userService';
import { User, UserRole } from '../src/shared/types';

process.env.NODE_ENV = 'test';

const createTestUser = (role: UserRole = UserRole.CUSTOMER_SERVICE): Omit<User, 'id' | 'createdAt' | 'updatedAt'> => ({
  username: `test_${uuidv4().slice(0, 8)}`,
  password: 'test123',
  name: '测试用户',
  role
});

describe('User Service', () => {
  let operator: Omit<User, 'password'>;
  let operatorWithPassword: User;

  beforeEach(() => {
    closeDatabase();
    const db = getDatabase();
    const now = new Date().toISOString();
    const operatorId = uuidv4();
    
    db.prepare(`
      INSERT INTO users (id, username, password, name, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(operatorId, 'operator', 'operator123', '操作人', UserRole.ADMIN, now, now);
    
    operatorWithPassword = {
      id: operatorId,
      username: 'operator',
      password: 'operator123',
      name: '操作人',
      role: UserRole.ADMIN,
      createdAt: now,
      updatedAt: now
    };
    
    operator = {
      id: operatorId,
      username: 'operator',
      name: '操作人',
      role: UserRole.ADMIN,
      createdAt: now,
      updatedAt: now
    };
  });

  afterAll(() => {
    closeDatabase();
  });

  describe('createUser', () => {
    it('should create a new user successfully', () => {
      const userData = createTestUser();
      const user = userService.createUser(userData, operatorWithPassword);
      
      expect(user).toBeDefined();
      expect(user.username).toBe(userData.username);
      expect(user.name).toBe(userData.name);
      expect(user.role).toBe(userData.role);
      expect(user.id).toBeDefined();
    });

    it('should throw error when username already exists', () => {
      const userData = createTestUser();
      userService.createUser(userData, operatorWithPassword);
      
      expect(() => {
        userService.createUser(userData, operatorWithPassword);
      }).toThrow('用户名已存在');
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', () => {
      const userData = createTestUser();
      const user = userService.createUser(userData, operatorWithPassword);
      
      const updatedUser = userService.updateUser(user.id, { name: '更新后的名字' }, operatorWithPassword);
      
      expect(updatedUser.name).toBe('更新后的名字');
    });

    it('should throw error when user not exists', () => {
      expect(() => {
        userService.updateUser('non-existent-id', { name: 'test' }, operatorWithPassword);
      }).toThrow('用户不存在');
    });
  });

  describe('getUserById', () => {
    it('should return user when exists', () => {
      const userData = createTestUser();
      const createdUser = userService.createUser(userData, operatorWithPassword);
      
      const foundUser = userService.getUserById(createdUser.id);
      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(createdUser.id);
    });

    it('should return undefined when user not exists', () => {
      const user = userService.getUserById('non-existent-id');
      expect(user).toBeUndefined();
    });
  });

  describe('listUsers', () => {
    it('should return all users', () => {
      userService.createUser(createTestUser(), operatorWithPassword);
      userService.createUser(createTestUser(), operatorWithPassword);
      
      const users = userService.listUsers();
      expect(users.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', () => {
      const userData = createTestUser();
      const user = userService.createUser(userData, operatorWithPassword);
      
      userService.deleteUser(user.id, operatorWithPassword);
      
      const deletedUser = userService.getUserById(user.id);
      expect(deletedUser).toBeUndefined();
    });

    it('should throw error when user not exists', () => {
      expect(() => {
        userService.deleteUser('non-existent-id', operatorWithPassword);
      }).toThrow('用户不存在');
    });
  });

  describe('authenticate', () => {
    it('should return user when credentials are correct', () => {
      const userData = createTestUser();
      userService.createUser(userData, operatorWithPassword);
      
      const user = userService.authenticate(userData.username, userData.password);
      
      expect(user).toBeDefined();
      expect(user!.username).toBe(userData.username);
    });

    it('should return null when password is wrong', () => {
      const userData = createTestUser();
      userService.createUser(userData, operatorWithPassword);
      
      const user = userService.authenticate(userData.username, 'wrong-password');
      expect(user).toBeNull();
    });

    it('should return null when user not exists', () => {
      const user = userService.authenticate('non-existent', 'password');
      expect(user).toBeNull();
    });
  });
});
