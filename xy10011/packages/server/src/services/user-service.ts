import { v4 as uuidv4 } from 'uuid';
import { User } from '../types';
import { getDatabase, executeTransaction } from '../database';
import { eventStore } from '../event-store';

class UserService {
  async getOrCreateUser(
    userId: string,
    options?: { name?: string; avatar?: string },
    clientId?: string,
    metadata?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<User> {
    return executeTransaction(async () => {
      const existingUser = this.getUserById(userId);
      if (existingUser) {
        return existingUser;
      }

      const now = Date.now();
      const user: User = {
        id: userId,
        name: options?.name || `用户${userId.slice(-6)}`,
        avatar: options?.avatar,
        createdAt: now,
        updatedAt: now,
      };

      await eventStore.appendEvent(
        userId,
        'user',
        'USER_CREATED',
        { user },
        userId,
        clientId || 'system',
        0,
        metadata
      );

      this.persistUser(user);
      return user;
    });
  }

  async createUser(
    userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    clientId: string,
    metadata?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<User> {
    return executeTransaction(async () => {
      const now = Date.now();
      const user: User = {
        ...userData,
        id: userData.id || uuidv4(),
        createdAt: now,
        updatedAt: now,
      };

      await eventStore.appendEvent(
        user.id,
        'user',
        'USER_CREATED',
        { user },
        user.id,
        clientId,
        0,
        metadata
      );

      this.persistUser(user);
      return user;
    });
  }

  async updateUser(
    userId: string,
    updates: Partial<User>,
    clientId: string,
    expectedVersion: number,
    metadata?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<User> {
    return executeTransaction(async () => {
      const existingUser = this.getUserById(userId);
      if (!existingUser) {
        throw new Error(`User ${userId} not found`);
      }

      const updatedUser: User = {
        ...existingUser,
        ...updates,
        updatedAt: Date.now(),
      };

      await eventStore.appendEvent(
        userId,
        'user',
        'USER_UPDATED',
        { updates },
        userId,
        clientId,
        expectedVersion,
        metadata
      );

      this.updatePersistedUser(updatedUser);
      return updatedUser;
    });
  }

  getUserById(userId: string): User | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any | undefined;
    return row ? this.deserializeUser(row) : null;
  }

  getAllUsers(): User[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as any[];
    return rows.map(this.deserializeUser);
  }

  private persistUser(user: User): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO users (id, name, avatar, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      user.id,
      user.name,
      user.avatar || null,
      user.createdAt,
      user.updatedAt
    );
  }

  private updatePersistedUser(user: User): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE users SET
        name = ?,
        avatar = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      user.name,
      user.avatar || null,
      user.updatedAt,
      user.id
    );
  }

  private deserializeUser(row: any): User {
    return {
      id: row.id,
      name: row.name,
      avatar: row.avatar || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const userService = new UserService();
