import db from '../db';
import { v4 as uuidv4 } from 'uuid';

export const createCountry = (name: string, code: string) => {
  const existing = db.prepare('SELECT id FROM countries WHERE name = ? OR code = ?').get(name, code);
  if (existing) throw new Error('该国家已存在');

  const id = uuidv4();
  db.prepare('INSERT INTO countries (id, name, code) VALUES (?, ?, ?)').run(id, name, code);
  return getCountry(id);
};

export const getCountry = (id: string) => {
  return db.prepare('SELECT * FROM countries WHERE id = ?').get(id);
};

export const listCountries = () => {
  return db.prepare('SELECT * FROM countries ORDER BY name').all();
};

export const createMaterialType = (
  countryId: string,
  name: string,
  required: boolean = true,
  validityDays?: number
) => {
  const existing = db.prepare(`
    SELECT id FROM material_types WHERE country_id = ? AND name = ?
  `).get(countryId, name);
  if (existing) throw new Error('该材料类型已存在');

  const id = uuidv4();
  db.prepare(`
    INSERT INTO material_types (id, country_id, name, required, validity_days)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, countryId, name, required ? 1 : 0, validityDays || null);

  return getMaterialType(id);
};

export const getMaterialType = (id: string) => {
  return db.prepare(`
    SELECT mt.*, c.name as country_name, c.code as country_code
    FROM material_types mt
    JOIN countries c ON mt.country_id = c.id
    WHERE mt.id = ?
  `).get(id);
};

export const listMaterialTypes = (countryId?: string) => {
  let sql = `
    SELECT mt.*, c.name as country_name, c.code as country_code
    FROM material_types mt
    JOIN countries c ON mt.country_id = c.id
  `;
  const params: any[] = [];

  if (countryId) {
    sql += ' WHERE mt.country_id = ?';
    params.push(countryId);
  }

  sql += ' ORDER BY mt.required DESC, mt.name';
  return db.prepare(sql).all(...params);
};

export const createTourist = (name: string, passportNumber: string, phone?: string, email?: string) => {
  const existing = db.prepare('SELECT id FROM tourists WHERE passport_number = ?').get(passportNumber);
  if (existing) {
    return db.prepare('SELECT * FROM tourists WHERE passport_number = ?').get(passportNumber);
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO tourists (id, name, passport_number, phone, email)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, passportNumber, phone || null, email || null);

  return getTourist(id);
};

export const getTourist = (id: string) => {
  return db.prepare('SELECT * FROM tourists WHERE id = ?').get(id);
};

export const getTouristByPassport = (passportNumber: string) => {
  return db.prepare('SELECT * FROM tourists WHERE passport_number = ?').get(passportNumber);
};

export const listTourists = () => {
  return db.prepare('SELECT * FROM tourists ORDER BY name').all();
};
