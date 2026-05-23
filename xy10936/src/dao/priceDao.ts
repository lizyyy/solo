import { run, get, all } from '../database/db';
import { PriceVersion, DeductionRatio } from '../types';

export const createPriceVersion = async (price: PriceVersion): Promise<number> => {
  const maxVersion = await getLatestVersion(price.category_id);
  const newVersion = (maxVersion || 0) + 1;
  const sql = `INSERT INTO price_versions (category_id, price, effective_date, version, created_by) VALUES (?, ?, ?, ?, ?)`;
  return run(sql, [price.category_id, price.price, price.effective_date, newVersion, price.created_by || null]);
};

export const getLatestVersion = async (categoryId: number): Promise<number | undefined> => {
  const sql = `SELECT MAX(version) as max_version FROM price_versions WHERE category_id = ?`;
  const result = await get<{ max_version: number }>(sql, [categoryId]);
  return result?.max_version;
};

export const getCurrentPrice = async (categoryId: number, date: string): Promise<PriceVersion | undefined> => {
  const sql = `SELECT * FROM price_versions WHERE category_id = ? AND effective_date <= ? ORDER BY version DESC LIMIT 1`;
  return get<PriceVersion>(sql, [categoryId, date]);
};

export const getPriceVersionsByCategory = async (categoryId: number): Promise<PriceVersion[]> => {
  const sql = `SELECT * FROM price_versions WHERE category_id = ? ORDER BY version DESC`;
  return all<PriceVersion>(sql, [categoryId]);
};

export const createDeductionRatio = async (ratio: DeductionRatio): Promise<number> => {
  const sql = `INSERT INTO deduction_ratios (category_id, ratio, effective_date, description) VALUES (?, ?, ?, ?)`;
  return run(sql, [ratio.category_id, ratio.ratio, ratio.effective_date || new Date().toISOString(), ratio.description || null]);
};

export const getCurrentDeductionRatio = async (categoryId: number): Promise<DeductionRatio | undefined> => {
  const sql = `SELECT * FROM deduction_ratios WHERE category_id = ? ORDER BY effective_date DESC LIMIT 1`;
  return get<DeductionRatio>(sql, [categoryId]);
};

export const getAllDeductionRatios = async (): Promise<DeductionRatio[]> => {
  const sql = `SELECT * FROM deduction_ratios ORDER BY effective_date DESC`;
  return all<DeductionRatio>(sql);
};
