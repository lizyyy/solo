import { run, get, all } from '../database/db';
import { Category } from '../types';

export const createCategory = async (category: Category): Promise<number> => {
  const sql = `INSERT INTO categories (name, code, description) VALUES (?, ?, ?)`;
  return run(sql, [category.name, category.code, category.description || null]);
};

export const getCategoryById = async (id: number): Promise<Category | undefined> => {
  const sql = `SELECT * FROM categories WHERE id = ?`;
  return get<Category>(sql, [id]);
};

export const getCategoryByCode = async (code: string): Promise<Category | undefined> => {
  const sql = `SELECT * FROM categories WHERE code = ?`;
  return get<Category>(sql, [code]);
};

export const getAllCategories = async (): Promise<Category[]> => {
  const sql = `SELECT * FROM categories ORDER BY name`;
  return all<Category>(sql);
};
