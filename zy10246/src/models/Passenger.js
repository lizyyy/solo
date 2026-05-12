import { v4 as uuidv4 } from 'uuid';
import { getDB, saveDB } from '../config/database.js';

export async function createPassenger({ name, idCard, phone = null }) {
  const db = await getDB();
  
  let passenger = db.data.passengers.find(p => p.idCard === idCard);
  
  if (passenger) {
    return passenger;
  }
  
  passenger = {
    id: uuidv4(),
    name,
    idCard,
    phone,
    createdAt: new Date().toISOString()
  };

  db.data.passengers.push(passenger);
  await saveDB();
  
  return passenger;
}

export async function getPassengerById(id) {
  const db = await getDB();
  return db.data.passengers.find(p => p.id === id);
}

export async function getPassengerByIdCard(idCard) {
  const db = await getDB();
  return db.data.passengers.find(p => p.idCard === idCard);
}