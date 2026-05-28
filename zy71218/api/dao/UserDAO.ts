import db from '../db/index';
import type { User, PaginatedResponse } from '../../shared/types';
import { toCamelCase, buildWhereClause, buildSelectAllSql, buildCountSql } from './utils';

const TABLE_NAME = 'user';

const getByIdStmt = db.prepare(`
  SELECT id, username, name, role, status, created_at FROM ${TABLE_NAME} WHERE id = @id
`);

const getByUsernameStmt = db.prepare(`
  SELECT * FROM ${TABLE_NAME} WHERE username = @username
`);

const createStmt = db.prepare(`
  INSERT INTO ${TABLE_NAME} (
    id, username, name, role, status,
    password_hash, created_at
  ) VALUES (
    @id, @username, @name, @role, @status,
    @passwordHash, @createdAt
  )
`);

const updateStmt = db.prepare(`
  UPDATE ${TABLE_NAME} SET
    username = COALESCE(@username, username),
    name = COALESCE(@name, name),
    role = COALESCE(@role, role),
    status = COALESCE(@status, status),
    password_hash = COALESCE(@passwordHash, password_hash)
  WHERE id = @id
`);

const deleteStmt = db.prepare(`
  DELETE FROM ${TABLE_NAME} WHERE id = @id
`);

export const UserDAO = {
  async getById(id: string): Promise<User | null> {
    const row = getByIdStmt.get({ id });
    return row ? toCamelCase<User>(row as Record<string, any>) : null;
  },

  async getByUsername(username: string): Promise<User & { passwordHash?: string } | null> {
    const row = getByUsernameStmt.get({ username });
    return row ? toCamelCase<User & { passwordHash?: string }>(row as Record<string, any>) : null;
  },

  async list(
    filters?: Record<string, any>,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<User>> {
    const { clause, params } = buildWhereClause(filters);
    
    const currentPage = page || 1;
    const currentPageSize = pageSize || 10;
    const offset = (currentPage - 1) * currentPageSize;

    const countSql = buildCountSql(TABLE_NAME, clause);
    const listSql = buildSelectAllSql(TABLE_NAME, clause);

    const countRow = db.prepare(countSql).get(params) as { count: number };
    const rows = db.prepare(listSql).all({
      ...params,
      limit: currentPageSize,
      offset,
    }) as Record<string, any>[];

    return {
      list: rows.map(row => {
        const { passwordHash, ...userWithoutPassword } = toCamelCase<User & { passwordHash?: string }>(row);
        return userWithoutPassword as User;
      }),
      total: countRow.count,
      page: currentPage,
      pageSize: currentPageSize,
    };
  },

  async create(data: Partial<User> & { id: string; passwordHash: string }): Promise<User> {
    const now = new Date().toISOString();
    const params = {
      id: data.id,
      username: data.username,
      name: data.name,
      role: data.role,
      status: data.status || 'active',
      passwordHash: data.passwordHash,
      createdAt: data.createdAt || now,
    };

    createStmt.run(params);

    const result = await UserDAO.getById(data.id);
    return result!;
  },

  async update(id: string, data: Partial<User> & { passwordHash?: string }): Promise<User | null> {
    const params = {
      id,
      username: data.username,
      name: data.name,
      role: data.role,
      status: data.status,
      passwordHash: data.passwordHash,
    };

    const result = updateStmt.run(params);

    if (result.changes === 0) {
      return null;
    }

    return UserDAO.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    const result = deleteStmt.run({ id });
    return result.changes > 0;
  },
};

export default UserDAO;
