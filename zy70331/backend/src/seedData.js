import db from './database.js';
import { randomUUID } from 'crypto';
import { addDays, subDays, addHours, subHours } from 'date-fns';
import { recordUsage, createSubscription, addTemporaryBoost } from './services/rateService.js';

const PLANS = [
  {
    id: 'trial-free',
    name: '免费试用',
    rate_limit: 10,
    rate_window: 'minute',
    priority: 1,
    description: '7天免费试用，10次/分钟',
    is_trial: 1,
    trial_days: 7,
    monthly_price: 0
  },
  {
    id: 'starter',
    name: '入门版',
    rate_limit: 100,
    rate_window: 'minute',
    priority: 1,
    description: '适合小型项目，100次/分钟',
    is_trial: 0,
    trial_days: 0,
    monthly_price: 99
  },
  {
    id: 'professional',
    name: '专业版',
    rate_limit: 1000,
    rate_window: 'minute',
    priority: 2,
    description: '适合成长型企业，1000次/分钟',
    is_trial: 0,
    trial_days: 0,
    monthly_price: 499
  },
  {
    id: 'enterprise',
    name: '企业版',
    rate_limit: 10000,
    rate_window: 'minute',
    priority: 3,
    description: '适合大型企业，10000次/分钟',
    is_trial: 0,
    trial_days: 0,
    monthly_price: 2999
  }
];

const CUSTOMERS = [
  { id: 'cust-001', name: '创新科技有限公司', email: 'contact@innovatech.com' },
  { id: 'cust-002', name: '云端数据服务', email: 'support@clouddata.io' },
  { id: 'cust-003', name: '智能物联网', email: 'info@smart-iot.cn' }
];

function seedPlans() {
  const existing = db.prepare('plans').all();
  if (existing.length > 0) return false;

  PLANS.forEach(plan => {
    db.insert('plans', {
      ...plan,
      status: 'active'
    });
  });

  console.log('Plans seeded');
  return true;
}

function seedCustomers() {
  const existing = db.prepare('customers').all();
  if (existing.length > 0) return false;

  CUSTOMERS.forEach(customer => {
    db.insert('customers', {
      ...customer,
      status: 'active'
    });
  });

  console.log('Customers seeded');
  return true;
}

function seedSubscriptionsAndUsage() {
  const existing = db.prepare('subscriptions').all();
  if (existing.length > 0) return false;

  const now = new Date();
  const customer1 = CUSTOMERS[0];
  const customer2 = CUSTOMERS[1];
  const customer3 = CUSTOMERS[2];

  const sub1Start = subDays(now, 10);
  createSubscription(customer1.id, 'trial-free', 'trial', {
    startDate: sub1Start,
    operator: 'seed'
  });
  console.log('Created trial subscription for', customer1.name);

  const baseTime = subHours(now, 2).getTime();
  for (let i = 0; i < 5; i++) {
    const ts = baseTime + (i * 60000);
    recordUsage(customer1.id, {
      apiEndpoint: '/api/v1/data',
      priority: 1,
      timestamp: ts,
      operator: 'seed'
    });
  }

  const sub2Start = subDays(now, 15);
  const proSub = createSubscription(customer2.id, 'professional', 'paid', {
    startDate: sub2Start,
    operator: 'seed'
  });
  console.log('Created professional subscription for', customer2.name);

  const proTime = subHours(now, 1).getTime();
  for (let i = 0; i < 15; i++) {
    const ts = proTime + (i * 5000);
    recordUsage(customer2.id, {
      apiEndpoint: i % 2 === 0 ? '/api/v1/payments' : '/api/v1/status',
      priority: i % 3 === 0 ? 2 : 1,
      timestamp: ts,
      operator: 'seed'
    });
  }

  try {
    addTemporaryBoost(customer2.id, 500, 2, 'seed');
    console.log('Added temporary boost for', customer2.name);
  } catch (e) {
    console.log('Boost already exists or error:', e.message);
  }

  const sub3Start = subDays(now, 30);
  createSubscription(customer3.id, 'enterprise', 'paid', {
    startDate: sub3Start,
    operator: 'seed'
  });
  console.log('Created enterprise subscription for', customer3.name);

  const entTime = subDays(now, 3).getTime();
  for (let i = 0; i < 200; i++) {
    const ts = entTime + (i * 30000);
    if (ts > now.getTime()) break;
    recordUsage(customer3.id, {
      apiEndpoint: '/api/v1/analytics',
      priority: 1,
      timestamp: ts,
      operator: 'seed'
    });
  }

  console.log('Subscriptions and usage seeded');
  return true;
}

export function seedData() {
  const plansSeeded = seedPlans();
  const customersSeeded = seedCustomers();
  const subsSeeded = seedSubscriptionsAndUsage();

  return {
    plans: plansSeeded,
    customers: customersSeeded,
    subscriptions: subsSeeded
  };
}
