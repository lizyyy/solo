import type { Customer, CustomerInstance, Product } from '../types/game';
import { generateId, clamp } from '../utils/helpers';

const CANVAS_WIDTH = 800;
const STALL_X = 400;

export function createCustomerInstance(
  customerTemplate: Customer,
  targetX: number = STALL_X
): CustomerInstance {
  const fromLeft = Math.random() > 0.5;
  const startX = fromLeft ? -50 : CANVAS_WIDTH + 50;

  return {
    id: generateId(),
    customerId: customerTemplate.id,
    x: startX,
    y: 380,
    targetX,
    state: 'walking',
    patience: customerTemplate.patience,
    maxPatience: customerTemplate.patience,
    waitTime: 0,
    budget: customerTemplate.budget,
    emoji: customerTemplate.emoji,
  };
}

export function updateCustomer(
  customer: CustomerInstance,
  deltaTime: number,
  queuePosition: number,
  products: Product[]
): CustomerInstance {
  const updated = { ...customer };
  const speed = 80;

  switch (customer.state) {
    case 'walking': {
      const queueTargetX = STALL_X + (queuePosition - 1) * 60;
      const dx = queueTargetX - customer.x;
      if (Math.abs(dx) < 5) {
        updated.state = queuePosition === 0 ? 'ordering' : 'waiting';
        updated.x = queueTargetX;
      } else {
        const direction = dx > 0 ? 1 : -1;
        updated.x += direction * speed * deltaTime;
      }
      break;
    }
    case 'waiting': {
      updated.waitTime += deltaTime;
      updated.patience -= deltaTime * 5;
      if (queuePosition === 0) {
        updated.state = 'ordering';
      }
      if (updated.patience <= 0) {
        updated.state = 'leaving';
        updated.targetX = updated.x < STALL_X ? -50 : CANVAS_WIDTH + 50;
      }
      break;
    }
    case 'ordering': {
      updated.waitTime += deltaTime;
      const affordableProducts = products.filter(
        (p) => updated.budget >= p.basePrice * 0.8
      );
      if (affordableProducts.length > 0 && !updated.order) {
        const preferred = affordableProducts.filter((_) =>
          Math.random() > 0.3
        );
        const product = preferred[Math.floor(Math.random() * preferred.length)]
          || affordableProducts[0];
        updated.order = product.id;
      }
      updated.patience -= deltaTime * 3;
      if (updated.patience <= 0) {
        updated.state = 'leaving';
        updated.targetX = updated.x < STALL_X ? -50 : CANVAS_WIDTH + 50;
      }
      break;
    }
    case 'happy':
    case 'leaving': {
      const dx = updated.targetX - updated.x;
      if (Math.abs(dx) < 5) {
        updated.x = updated.targetX;
      } else {
        const direction = dx > 0 ? 1 : -1;
        updated.x += direction * speed * 1.5 * deltaTime;
      }
      break;
    }
  }

  updated.patience = clamp(updated.patience, 0, customer.maxPatience);
  return updated;
}

export function shouldSpawnCustomer(
  currentCustomers: number,
  maxCustomers: number,
  timeRemaining: number,
  totalDuration: number
): boolean {
  if (currentCustomers >= maxCustomers) return false;

  const timeProgress = 1 - timeRemaining / totalDuration;
  const baseRate = 0.02;
  const rushMultiplier = timeProgress > 0.7 ? 2 : timeProgress > 0.3 ? 1.5 : 1;
  const spawnRate = baseRate * rushMultiplier;

  return Math.random() < spawnRate;
}

export function selectCustomerTemplate(customers: Customer[]): Customer {
  return customers[Math.floor(Math.random() * customers.length)];
}
