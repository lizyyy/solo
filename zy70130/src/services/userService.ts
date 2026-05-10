import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database';
import { User } from '../types';

export class UserService {
  createUser(name: string, isVerified: boolean = false): User {
    const db = getDatabase();
    const now = Date.now();
    const user: User = {
      id: uuidv4(),
      name,
      isVerified,
      isFrozen: false,
      createdAt: now,
      updatedAt: now,
    };

    db.users.set(user.id, user);
    return user;
  }

  getUser(id: string): User | null {
    const db = getDatabase();
    return db.users.get(id) || null;
  }

  updateVerification(userId: string, isVerified: boolean): User {
    const db = getDatabase();
    const user = db.users.get(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    const updated: User = {
      ...user,
      isVerified,
      updatedAt: Date.now(),
    };
    db.users.set(userId, updated);
    return updated;
  }

  freezeUser(userId: string): User {
    const db = getDatabase();
    const user = db.users.get(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    const updated: User = {
      ...user,
      isFrozen: true,
      updatedAt: Date.now(),
    };
    db.users.set(userId, updated);
    return updated;
  }

  unfreezeUser(userId: string): User {
    const db = getDatabase();
    const user = db.users.get(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    const updated: User = {
      ...user,
      isFrozen: false,
      updatedAt: Date.now(),
    };
    db.users.set(userId, updated);
    return updated;
  }
}

export const userService = new UserService();
