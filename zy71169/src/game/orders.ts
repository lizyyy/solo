import type { Order, Meal, Student, Grade, PickupWindow } from './types';
import { generateStudent } from './students';
import { getMealsByGrade } from './meals';

let orderIdCounter = 0;

function generateId(): string {
  orderIdCounter++;
  return `order_${Date.now()}_${orderIdCounter}`;
}

export function generateOrders(
  count: number,
  allergenRatio: number,
  durationSeconds: number,
  windows: PickupWindow[]
): Order[] {
  const orders: Order[] = [];
  const grades: Grade[] = [1, 2, 3];

  for (let i = 0; i < count; i++) {
    const grade = grades[Math.floor(Math.random() * grades.length)];
    const gradeMeals = getMealsByGrade(grade);
    const meal = gradeMeals[Math.floor(Math.random() * gradeMeals.length)];
    const student = generateStudent(grade, allergenRatio);

    const windowIndex = Math.floor(Math.random() * windows.length);
    const window = windows[windowIndex];

    const orderInterval = (durationSeconds * 0.9) / count;
    const baseTime = i * orderInterval + Math.random() * orderInterval * 0.5;
    const pickupTime = Math.floor(baseTime);

    const expiresAt = pickupTime + 30 + Math.floor(Math.random() * 20);

    orders.push({
      id: generateId(),
      student: {
        id: `student_${i}`,
        name: student.name,
        grade: student.grade,
        allergens: student.allergens,
      },
      meal,
      pickupWindowId: window.id,
      pickupTime,
      status: 'pending',
      createdAt: pickupTime - 5,
      expiresAt,
    });
  }

  return orders.sort((a, b) => a.pickupTime - b.pickupTime);
}

export function checkAllergenMismatch(meal: Meal, student: Student): boolean {
  return meal.containsAllergens.some(a => student.allergens.includes(a));
}

export function getActiveOrders(orders: Order[], currentTime: number): Order[] {
  return orders.filter(o => o.status === 'pending' || o.status === 'preparing' || o.status === 'ready' || o.status === 'picking');
}

export function getOrdersForPrep(orders: Order[], currentTime: number): Order[] {
  return orders.filter(o => o.status === 'pending' && o.createdAt <= currentTime && o.pickupTime <= currentTime + 15);
}

export function getOrdersForPickup(orders: Order[], currentTime: number): Order[] {
  return orders.filter(o => (o.status === 'preparing' || o.status === 'ready' || o.status === 'picking') && o.pickupTime <= currentTime + 5);
}

export function getExpiredOrders(orders: Order[], currentTime: number): Order[] {
  return orders.filter(o => o.status === 'pending' && o.expiresAt < currentTime);
}