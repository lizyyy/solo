const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const dayjs = require('dayjs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 初始化数据库
db.initDatabase();

// ========== 主人管理 API ==========

// 获取所有主人
app.get('/api/owners', (req, res) => {
  try {
    const data = db.loadData();
    const owners = data.owners.map(owner => {
      const petCount = data.pets.filter(p => p.owner_id === owner.id).length;
      return { ...owner, pet_count: petCount };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ success: true, data: owners });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取单个主人
app.get('/api/owners/:id', (req, res) => {
  try {
    const data = db.loadData();
    const owner = data.owners.find(o => o.id === req.params.id);
    if (!owner) {
      return res.status(404).json({ success: false, error: '主人不存在' });
    }
    const pets = data.pets.filter(p => p.owner_id === owner.id);
    res.json({ success: true, data: { ...owner, pets } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建主人
app.post('/api/owners', (req, res) => {
  const { name, phone, emergency_name, emergency_phone } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ success: false, error: '姓名和电话为必填项' });
  }
  
  try {
    const data = db.loadData();
    const id = db.generateId();
    const now = new Date().toISOString();
    const newOwner = {
      id,
      name,
      phone,
      emergency_name: emergency_name || '',
      emergency_phone: emergency_phone || '',
      created_at: now,
      updated_at: now
    };
    data.owners.push(newOwner);
    db.saveData(data);
    
    db.logOperation('owner', id, 'create', 'system', { name, phone });
    res.json({ success: true, data: { id, name, phone } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新主人
app.put('/api/owners/:id', (req, res) => {
  const { name, phone, emergency_name, emergency_phone } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ success: false, error: '姓名和电话为必填项' });
  }
  
  try {
    const data = db.loadData();
    const ownerIndex = data.owners.findIndex(o => o.id === req.params.id);
    if (ownerIndex === -1) {
      return res.status(404).json({ success: false, error: '主人不存在' });
    }
    
    const oldValues = { ...data.owners[ownerIndex] };
    data.owners[ownerIndex] = {
      ...data.owners[ownerIndex],
      name,
      phone,
      emergency_name: emergency_name || '',
      emergency_phone: emergency_phone || '',
      updated_at: new Date().toISOString()
    };
    db.saveData(data);
    
    db.logOperation('owner', req.params.id, 'update', 'system', { old: oldValues, new: data.owners[ownerIndex] });
    res.json({ success: true, data: data.owners[ownerIndex] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除主人
app.delete('/api/owners/:id', (req, res) => {
  try {
    const data = db.loadData();
    const ownerIndex = data.owners.findIndex(o => o.id === req.params.id);
    if (ownerIndex === -1) {
      return res.status(404).json({ success: false, error: '主人不存在' });
    }
    
    const petCount = data.pets.filter(p => p.owner_id === req.params.id).length;
    if (petCount > 0) {
      return res.status(400).json({ success: false, error: `该主人下还有 ${petCount} 只宠物，请先移除或转移宠物` });
    }
    
    const deletedOwner = data.owners.splice(ownerIndex, 1)[0];
    db.saveData(data);
    
    db.logOperation('owner', req.params.id, 'delete', 'system', { name: deletedOwner.name });
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== 宠物管理 API ==========

// 获取所有宠物
app.get('/api/pets', (req, res) => {
  try {
    const data = db.loadData();
    const pets = data.pets.map(pet => {
      const owner = data.owners.find(o => o.id === pet.owner_id);
      return {
        ...pet,
        owner_name: owner ? owner.name : '',
        owner_phone: owner ? owner.phone : ''
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ success: true, data: pets });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取单个宠物
app.get('/api/pets/:id', (req, res) => {
  try {
    const data = db.loadData();
    const pet = data.pets.find(p => p.id === req.params.id);
    if (!pet) {
      return res.status(404).json({ success: false, error: '宠物不存在' });
    }
    const owner = data.owners.find(o => o.id === pet.owner_id);
    res.json({ success: true, data: { ...pet, owner } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建宠物
app.post('/api/pets', (req, res) => {
  const { name, type, breed, weight, gender, birthday, owner_id, personality, health_notes } = req.body;
  if (!name || !type || !owner_id) {
    return res.status(400).json({ success: false, error: '宠物名称、种类和主人为必填项' });
  }
  
  try {
    const data = db.loadData();
    const owner = data.owners.find(o => o.id === owner_id);
    if (!owner) {
      return res.status(404).json({ success: false, error: '主人不存在' });
    }
    
    const id = db.generateId();
    const now = new Date().toISOString();
    const newPet = {
      id,
      name,
      type,
      breed: breed || '',
      weight: weight ? parseFloat(weight) : 0,
      gender: gender || 'unknown',
      birthday: birthday || '',
      owner_id,
      personality: personality || '',
      health_notes: health_notes || '',
      created_at: now,
      updated_at: now
    };
    data.pets.push(newPet);
    db.saveData(data);
    
    db.logOperation('pet', id, 'create', 'system', { name, type, owner_id });
    res.json({ success: true, data: { id, name } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新宠物
app.put('/api/pets/:id', (req, res) => {
  const { name, type, breed, weight, gender, birthday, owner_id, personality, health_notes } = req.body;
  if (!name || !type || !owner_id) {
    return res.status(400).json({ success: false, error: '宠物名称、种类和主人为必填项' });
  }
  
  try {
    const data = db.loadData();
    const petIndex = data.pets.findIndex(p => p.id === req.params.id);
    if (petIndex === -1) {
      return res.status(404).json({ success: false, error: '宠物不存在' });
    }
    
    const owner = data.owners.find(o => o.id === owner_id);
    if (!owner) {
      return res.status(404).json({ success: false, error: '主人不存在' });
    }
    
    const oldValues = { ...data.pets[petIndex] };
    data.pets[petIndex] = {
      ...data.pets[petIndex],
      name,
      type,
      breed: breed || '',
      weight: weight ? parseFloat(weight) : 0,
      gender: gender || 'unknown',
      birthday: birthday || '',
      owner_id,
      personality: personality || '',
      health_notes: health_notes || '',
      updated_at: new Date().toISOString()
    };
    db.saveData(data);
    
    db.logOperation('pet', req.params.id, 'update', 'system', { old: oldValues, new: data.pets[petIndex] });
    res.json({ success: true, data: data.pets[petIndex] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除宠物
app.delete('/api/pets/:id', (req, res) => {
  try {
    const data = db.loadData();
    const petIndex = data.pets.findIndex(p => p.id === req.params.id);
    if (petIndex === -1) {
      return res.status(404).json({ success: false, error: '宠物不存在' });
    }
    
    const activeOrders = data.orders.filter(o => 
      o.pet_id === req.params.id && ['pending', 'checked_in'].includes(o.status)
    );
    if (activeOrders.length > 0) {
      return res.status(400).json({ success: false, error: '该宠物有进行中的寄养订单，无法删除' });
    }
    
    const deletedPet = data.pets.splice(petIndex, 1)[0];
    db.saveData(data);
    
    db.logOperation('pet', req.params.id, 'delete', 'system', { name: deletedPet.name });
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== 笼位管理 API ==========

// 获取所有笼位
app.get('/api/cages', (req, res) => {
  try {
    const data = db.loadData();
    res.json({ success: true, data: data.cages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取指定日期可用笼位
app.get('/api/cages/available', (req, res) => {
  const { check_in_date, check_out_date } = req.query;
  
  if (!check_in_date || !check_out_date) {
    return res.status(400).json({ success: false, error: '请提供入住和离店日期' });
  }
  
  try {
    const data = db.loadData();
    const occupiedCageIds = [];
    
    data.orders.forEach(order => {
      if (order.status === 'cancelled' || order.status === 'checked_out') return;
      
      const orderStart = dayjs(order.check_in_date);
      const orderEnd = dayjs(order.check_out_date);
      const reqStart = dayjs(check_in_date);
      const reqEnd = dayjs(check_out_date);
      
      if (reqStart.isBefore(orderEnd) && reqEnd.isAfter(orderStart)) {
        occupiedCageIds.push(order.cage_id);
      }
    });
    
    const cages = data.cages.map(cage => ({
      ...cage,
      is_available: !occupiedCageIds.includes(cage.id),
      is_occupied: occupiedCageIds.includes(cage.id)
    }));
    
    res.json({ success: true, data: cages, occupied_count: occupiedCageIds.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 新增笼位
app.post('/api/cages', (req, res) => {
  const { name, location, description, max_weight } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, error: '笼位名称为必填项' });
  }
  
  try {
    const data = db.loadData();
    const id = db.generateId();
    const newCage = {
      id,
      name,
      location: location || '',
      description: description || '',
      max_weight: max_weight ? parseFloat(max_weight) : 50,
      status: 'available',
      created_at: new Date().toISOString()
    };
    data.cages.push(newCage);
    db.saveData(data);
    
    db.logOperation('cage', id, 'create', 'system', { name, location });
    res.json({ success: true, data: newCage });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== 订单管理 API ==========

function createTodoForOrder(order, type, dueDate) {
  const data = db.loadData();
  const todo = {
    id: db.generateId(),
    order_id: order.id,
    type: type,
    title: type === 'check_in' ? `${order.pet_name} 到店` : `${order.pet_name} 离店`,
    description: type === 'check_in' ? '请确认宠物已到店，检查健康状态' : '请确认宠物离店，交接物品和费用',
    due_date: dueDate,
    status: 'pending',
    created_at: new Date().toISOString(),
    completed_at: null,
    completed_by: null,
    notes: ''
  };
  data.todos.push(todo);
  db.saveData(data);
  return todo;
}

// 获取所有订单
app.get('/api/orders', (req, res) => {
  const { status } = req.query;
  
  try {
    const data = db.loadData();
    let orders = [...data.orders];
    
    if (status) {
      orders = orders.filter(o => o.status === status);
    }
    
    orders = orders.map(order => {
      const pet = data.pets.find(p => p.id === order.pet_id);
      const owner = data.owners.find(o => o.id === order.owner_id);
      const cage = data.cages.find(c => c.id === order.cage_id);
      
      return {
        ...order,
        pet_name: pet ? pet.name : order.pet_name,
        owner_name: owner ? owner.name : '',
        owner_phone: owner ? owner.phone : '',
        cage_name: cage ? cage.name : order.cage_name
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取订单详情
app.get('/api/orders/:id', (req, res) => {
  try {
    const data = db.loadData();
    const order = data.orders.find(o => o.id === req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    
    const pet = data.pets.find(p => p.id === order.pet_id);
    const owner = data.owners.find(o => o.id === order.owner_id);
    const cage = data.cages.find(c => c.id === order.cage_id);
    const todos = data.todos.filter(t => t.order_id === order.id);
    const incidents = data.incidents.filter(i => i.order_id === order.id);
    
    res.json({ 
      success: true, 
      data: { 
        ...order, 
        pet, 
        owner, 
        cage,
        todos,
        incidents
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 检查笼位冲突
function checkCageConflict(data, cage_id, check_in_date, check_out_date, exclude_order_id = null) {
  return data.orders.some(order => {
    if (exclude_order_id && order.id === exclude_order_id) return false;
    if (order.status === 'cancelled' || order.status === 'checked_out') return false;
    if (order.cage_id !== cage_id) return false;
    
    const orderStart = dayjs(order.check_in_date);
    const orderEnd = dayjs(order.check_out_date);
    const reqStart = dayjs(check_in_date);
    const reqEnd = dayjs(check_out_date);
    
    return reqStart.isBefore(orderEnd) && reqEnd.isAfter(orderStart);
  });
}

// 创建订单
app.post('/api/orders', (req, res) => {
  const {
    pet_id, owner_id, cage_id, check_in_date, check_out_date,
    feeding_instructions, medication_plan, transportation, special_requirements
  } = req.body;
  
  if (!pet_id || !owner_id || !cage_id || !check_in_date || !check_out_date) {
    return res.status(400).json({ success: false, error: '请填写必要信息：宠物、主人、笼位、入住/离店日期' });
  }
  
  if (dayjs(check_out_date).isBefore(dayjs(check_in_date))) {
    return res.status(400).json({ success: false, error: '离店日期不能早于入住日期' });
  }
  
  try {
    const data = db.loadData();
    
    const pet = data.pets.find(p => p.id === pet_id);
    const owner = data.owners.find(o => o.id === owner_id);
    const cage = data.cages.find(c => c.id === cage_id);
    
    if (!pet) return res.status(404).json({ success: false, error: '宠物不存在' });
    if (!owner) return res.status(404).json({ success: false, error: '主人不存在' });
    if (!cage) return res.status(404).json({ success: false, error: '笼位不存在' });
    
    if (checkCageConflict(data, cage_id, check_in_date, check_out_date)) {
      return res.status(400).json({ 
        success: false, 
        error: '笼位冲突',
        message: `该笼位在 ${check_in_date} 至 ${check_out_date} 期间已被占用，请选择其他笼位或调整时间` 
      });
    }
    
    const id = db.generateId();
    const now = new Date().toISOString();
    const newOrder = {
      id,
      pet_id,
      pet_name: pet.name,
      owner_id,
      owner_name: owner.name,
      cage_id,
      cage_name: cage.name,
      check_in_date,
      check_out_date,
      feeding_instructions: feeding_instructions || '',
      medication_plan: medication_plan || '',
      transportation: transportation || 'owner',
      special_requirements: special_requirements || '',
      status: 'pending',
      check_in_time: null,
      check_out_time: null,
      check_in_notes: '',
      check_out_notes: '',
      created_at: now,
      updated_at: now
    };
    
    data.orders.push(newOrder);
    db.saveData(data);
    
    createTodoForOrder(newOrder, 'check_in', check_in_date);
    createTodoForOrder(newOrder, 'check_out', check_out_date);
    
    db.logOperation('order', id, 'create', 'system', { 
      pet_name: pet.name, 
      check_in_date, 
      check_out_date 
    });
    
    res.json({ success: true, data: { id, status: 'pending' } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新订单
app.put('/api/orders/:id', (req, res) => {
  const {
    pet_id, owner_id, cage_id, check_in_date, check_out_date,
    feeding_instructions, medication_plan, transportation, special_requirements
  } = req.body;
  
  if (!pet_id || !owner_id || !cage_id || !check_in_date || !check_out_date) {
    return res.status(400).json({ success: false, error: '请填写必要信息' });
  }
  
  if (dayjs(check_out_date).isBefore(dayjs(check_in_date))) {
    return res.status(400).json({ success: false, error: '离店日期不能早于入住日期' });
  }
  
  try {
    const data = db.loadData();
    const orderIndex = data.orders.findIndex(o => o.id === req.params.id);
    if (orderIndex === -1) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    
    const oldOrder = data.orders[orderIndex];
    if (oldOrder.status === 'checked_out' || oldOrder.status === 'cancelled') {
      return res.status(400).json({ success: false, error: '已离店或已取消的订单无法修改' });
    }
    
    const pet = data.pets.find(p => p.id === pet_id);
    const owner = data.owners.find(o => o.id === owner_id);
    const cage = data.cages.find(c => c.id === cage_id);
    
    if (!pet) return res.status(404).json({ success: false, error: '宠物不存在' });
    if (!owner) return res.status(404).json({ success: false, error: '主人不存在' });
    if (!cage) return res.status(404).json({ success: false, error: '笼位不存在' });
    
    if (checkCageConflict(data, cage_id, check_in_date, check_out_date, req.params.id)) {
      return res.status(400).json({ 
        success: false, 
        error: '笼位冲突',
        message: '该笼位在指定时间段内已被占用' 
      });
    }
    
    data.orders[orderIndex] = {
      ...data.orders[orderIndex],
      pet_id,
      pet_name: pet.name,
      owner_id,
      owner_name: owner.name,
      cage_id,
      cage_name: cage.name,
      check_in_date,
      check_out_date,
      feeding_instructions: feeding_instructions || '',
      medication_plan: medication_plan || '',
      transportation: transportation || 'owner',
      special_requirements: special_requirements || '',
      updated_at: new Date().toISOString()
    };
    
    db.saveData(data);
    db.logOperation('order', req.params.id, 'update', 'system', { old: oldOrder, new: data.orders[orderIndex] });
    res.json({ success: true, data: data.orders[orderIndex] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 确认入住
app.post('/api/orders/:id/check-in', (req, res) => {
  const { notes } = req.body;
  
  try {
    const data = db.loadData();
    const orderIndex = data.orders.findIndex(o => o.id === req.params.id);
    if (orderIndex === -1) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    
    const order = data.orders[orderIndex];
    if (order.status !== 'pending') {
      return res.status(400).json({ success: false, error: '只有待入住的订单可以确认入住' });
    }
    
    const now = new Date().toISOString();
    data.orders[orderIndex] = {
      ...order,
      status: 'checked_in',
      check_in_time: now,
      check_in_notes: notes || '',
      updated_at: now
    };
    
    const checkInTodo = data.todos.find(t => t.order_id === order.id && t.type === 'check_in');
    if (checkInTodo) {
      const todoIndex = data.todos.indexOf(checkInTodo);
      data.todos[todoIndex] = {
        ...checkInTodo,
        status: 'completed',
        completed_at: now,
        completed_by: 'system',
        notes: notes || '已确认到店'
      };
    }
    
    db.saveData(data);
    db.logOperation('order', req.params.id, 'check_in', 'system', { notes });
    res.json({ success: true, data: data.orders[orderIndex] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 确认离店
app.post('/api/orders/:id/check-out', (req, res) => {
  const { notes } = req.body;
  
  try {
    const data = db.loadData();
    const orderIndex = data.orders.findIndex(o => o.id === req.params.id);
    if (orderIndex === -1) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    
    const order = data.orders[orderIndex];
    if (order.status !== 'checked_in') {
      return res.status(400).json({ success: false, error: '只有已入住的订单可以确认离店' });
    }
    
    const now = new Date().toISOString();
    data.orders[orderIndex] = {
      ...order,
      status: 'checked_out',
      check_out_time: now,
      check_out_notes: notes || '',
      updated_at: now
    };
    
    const checkOutTodo = data.todos.find(t => t.order_id === order.id && t.type === 'check_out');
    if (checkOutTodo) {
      const todoIndex = data.todos.indexOf(checkOutTodo);
      data.todos[todoIndex] = {
        ...checkOutTodo,
        status: 'completed',
        completed_at: now,
        completed_by: 'system',
        notes: notes || '已确认离店'
      };
    }
    
    db.saveData(data);
    db.logOperation('order', req.params.id, 'check_out', 'system', { notes });
    res.json({ success: true, data: data.orders[orderIndex] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 取消订单
app.post('/api/orders/:id/cancel', (req, res) => {
  const { reason } = req.body;
  
  try {
    const data = db.loadData();
    const orderIndex = data.orders.findIndex(o => o.id === req.params.id);
    if (orderIndex === -1) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    
    const order = data.orders[orderIndex];
    if (order.status === 'checked_out' || order.status === 'cancelled') {
      return res.status(400).json({ success: false, error: '该订单已离店或已取消' });
    }
    
    const now = new Date().toISOString();
    data.orders[orderIndex] = {
      ...order,
      status: 'cancelled',
      updated_at: now
    };
    
    data.todos.filter(t => t.order_id === order.id && t.status === 'pending').forEach(todo => {
      const todoIndex = data.todos.indexOf(todo);
      data.todos[todoIndex] = {
        ...todo,
        status: 'cancelled',
        completed_at: now,
        notes: '订单已取消'
      };
    });
    
    db.saveData(data);
    db.logOperation('order', req.params.id, 'cancel', 'system', { reason });
    res.json({ success: true, data: data.orders[orderIndex] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== 待办事项 API ==========

// 获取今日待办
app.get('/api/todos/today', (req, res) => {
  try {
    const data = db.loadData();
    const today = dayjs().format('YYYY-MM-DD');
    
    const todos = data.todos
      .filter(t => {
        const dueDate = dayjs(t.due_date).format('YYYY-MM-DD');
        return dueDate === today && t.status === 'pending';
      })
      .map(todo => {
        const order = data.orders.find(o => o.id === todo.order_id);
        return {
          ...todo,
          order_status: order ? order.status : null,
          pet_name: order ? order.pet_name : ''
        };
      })
      .sort((a, b) => {
        const typeOrder = { check_in: 1, check_out: 2, feeding: 3, medication: 4, incident: 5 };
        return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
      });
    
    res.json({ success: true, data: todos });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取订单的待办
app.get('/api/todos/order/:orderId', (req, res) => {
  try {
    const data = db.loadData();
    const todos = data.todos
      .filter(t => t.order_id === req.params.orderId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    res.json({ success: true, data: todos });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 完成待办
app.post('/api/todos/:id/complete', (req, res) => {
  const { notes } = req.body;
  
  try {
    const data = db.loadData();
    const todoIndex = data.todos.findIndex(t => t.id === req.params.id);
    if (todoIndex === -1) {
      return res.status(404).json({ success: false, error: '待办事项不存在' });
    }
    
    const todo = data.todos[todoIndex];
    if (todo.status !== 'pending') {
      return res.status(400).json({ success: false, error: '该待办已完成或已取消' });
    }
    
    const now = new Date().toISOString();
    data.todos[todoIndex] = {
      ...todo,
      status: 'completed',
      completed_at: now,
      completed_by: 'system',
      notes: notes || todo.notes
    };
    
    db.saveData(data);
    db.logOperation('todo', req.params.id, 'complete', 'system', { notes });
    res.json({ success: true, data: data.todos[todoIndex] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== 异常事件 API ==========

// 获取所有异常事件
app.get('/api/incidents', (req, res) => {
  const { resolved } = req.query;
  
  try {
    const data = db.loadData();
    let incidents = [...data.incidents];
    
    if (resolved !== undefined) {
      const isResolved = resolved === 'true';
      incidents = incidents.filter(i => i.resolved === isResolved);
    }
    
    incidents = incidents.map(incident => {
      const order = data.orders.find(o => o.id === incident.order_id);
      const pet = data.pets.find(p => p.id === incident.pet_id);
      return {
        ...incident,
        pet_name: pet ? pet.name : order ? order.pet_name : '',
        order_status: order ? order.status : ''
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    res.json({ success: true, data: incidents });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建异常事件
app.post('/api/incidents', (req, res) => {
  const { order_id, pet_id, type, severity, description, image_paths } = req.body;
  
  if (!order_id || !type) {
    return res.status(400).json({ success: false, error: '订单和异常类型为必填项' });
  }
  
  try {
    const data = db.loadData();
    const order = data.orders.find(o => o.id === order_id);
    if (!order) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    
    const id = db.generateId();
    const now = new Date().toISOString();
    const newIncident = {
      id,
      order_id,
      pet_id: pet_id || order.pet_id,
      type,
      severity: severity || 'medium',
      description: description || '',
      image_paths: image_paths || [],
      resolved: false,
      resolved_at: null,
      resolution: '',
      created_at: now,
      updated_at: now
    };
    
    data.incidents.push(newIncident);
    
    const incidentTodo = {
      id: db.generateId(),
      order_id: order_id,
      type: 'incident',
      title: `${order.pet_name} - 异常事件跟进`,
      description: `异常类型: ${type}\n严重程度: ${severity}\n${description}`,
      due_date: dayjs().format('YYYY-MM-DD'),
      status: 'pending',
      created_at: now,
      completed_at: null,
      completed_by: null,
      notes: '',
      incident_id: id
    };
    data.todos.push(incidentTodo);
    
    db.saveData(data);
    db.logOperation('incident', id, 'create', 'system', { type, severity, order_id });
    res.json({ success: true, data: { id, type } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 解决异常事件
app.post('/api/incidents/:id/resolve', (req, res) => {
  const { resolution } = req.body;
  
  try {
    const data = db.loadData();
    const incidentIndex = data.incidents.findIndex(i => i.id === req.params.id);
    if (incidentIndex === -1) {
      return res.status(404).json({ success: false, error: '异常事件不存在' });
    }
    
    const incident = data.incidents[incidentIndex];
    if (incident.resolved) {
      return res.status(400).json({ success: false, error: '该异常事件已解决' });
    }
    
    const now = new Date().toISOString();
    data.incidents[incidentIndex] = {
      ...incident,
      resolved: true,
      resolved_at: now,
      resolution: resolution || '',
      updated_at: now
    };
    
    const incidentTodo = data.todos.find(t => t.incident_id === incident.id && t.status === 'pending');
    if (incidentTodo) {
      const todoIndex = data.todos.indexOf(incidentTodo);
      data.todos[todoIndex] = {
        ...incidentTodo,
        status: 'completed',
        completed_at: now,
        completed_by: 'system',
        notes: resolution || '异常已解决'
      };
    }
    
    db.saveData(data);
    db.logOperation('incident', req.params.id, 'resolve', 'system', { resolution });
    res.json({ success: true, data: data.incidents[incidentIndex] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== 导出接口 ==========

// 生成 Markdown 交接单
function generateMarkdownHandover(order, pet, owner, cage, todos, incidents) {
  const statusMap = {
    'pending': '待入住',
    'checked_in': '已入住',
    'checked_out': '已离店',
    'cancelled': '已取消'
  };
  
  const transportMap = {
    'owner': '主人自行接送',
    'delivery': '门店接送',
    'third_party': '第三方接送'
  };
  
  const severityMap = {
    'low': '低',
    'medium': '中',
    'high': '高',
    'urgent': '紧急'
  };
  
  let md = `# 宠物寄养交接单\n\n`;
  md += `---\n\n`;
  
  md += `## 📋 基本信息\n\n`;
  md += `| 项目 | 内容 |\n|------|------|\n`;
  md += `| 订单状态 | ${statusMap[order.status] || order.status} |\n`;
  md += `| 入住日期 | ${order.check_in_date} |\n`;
  md += `| 离店日期 | ${order.check_out_date} |\n`;
  md += `| 笼位 | ${cage ? cage.name : order.cage_name} |\n`;
  if (order.check_in_time) {
    md += `| 实际入住时间 | ${order.check_in_time} |\n`;
  }
  if (order.check_out_time) {
    md += `| 实际离店时间 | ${order.check_out_time} |\n`;
  }
  md += `\n`;
  
  md += `## 🐾 宠物信息\n\n`;
  if (pet) {
    md += `| 项目 | 内容 |\n|------|------|\n`;
    md += `| 宠物名称 | ${pet.name} |\n`;
    md += `| 种类 | ${pet.type} |\n`;
    if (pet.breed) md += `| 品种 | ${pet.breed} |\n`;
    md += `| 体重 | ${pet.weight || '-'} kg |\n`;
    md += `| 性别 | ${pet.gender === 'male' ? '公' : pet.gender === 'female' ? '母' : '未知'} |\n`;
    if (pet.birthday) md += `| 生日 | ${pet.birthday} |\n`;
    if (pet.personality) md += `| 性格特点 | ${pet.personality} |\n`;
    if (pet.health_notes) md += `| 健康备注 | ${pet.health_notes} |\n`;
  } else {
    md += `| 宠物名称 | ${order.pet_name} |\n`;
  }
  md += `\n`;
  
  md += `## 👤 主人信息\n\n`;
  if (owner) {
    md += `| 项目 | 内容 |\n|------|------|\n`;
    md += `| 姓名 | ${owner.name} |\n`;
    md += `| 联系电话 | ${owner.phone} |\n`;
    if (owner.emergency_name) md += `| 紧急联系人 | ${owner.emergency_name} |\n`;
    if (owner.emergency_phone) md += `| 紧急联系电话 | ${owner.emergency_phone} |\n`;
  } else {
    md += `| 姓名 | ${order.owner_name || '-'} |\n`;
  }
  md += `\n`;
  
  md += `## 📝 寄养要求\n\n`;
  md += `- **接送方式**: ${transportMap[order.transportation] || order.transportation}\n\n`;
  
  if (order.feeding_instructions) {
    md += `### 🍖 喂食说明\n\n`;
    md += `${order.feeding_instructions}\n\n`;
  }
  
  if (order.medication_plan) {
    md += `### 💊 用药计划\n\n`;
    md += `${order.medication_plan}\n\n`;
  }
  
  if (order.special_requirements) {
    md += `### ⚠️ 特殊要求\n\n`;
    md += `${order.special_requirements}\n\n`;
  }
  
  if (incidents && incidents.length > 0) {
    md += `## 🚨 异常事件记录\n\n`;
    incidents.forEach((incident, idx) => {
      md += `### ${idx + 1}. ${incident.type}\n\n`;
      md += `- **发生时间**: ${incident.created_at}\n`;
      md += `- **严重程度**: ${severityMap[incident.severity] || incident.severity}\n`;
      if (incident.description) md += `- **详细描述**: ${incident.description}\n`;
      if (incident.image_paths && incident.image_paths.length > 0) {
        md += `- **相关图片/文件**: ${incident.image_paths.join(', ')}\n`;
      }
      if (incident.resolved) {
        md += `- **处理状态**: ✅ 已解决\n`;
        md += `- **解决时间**: ${incident.resolved_at}\n`;
        if (incident.resolution) md += `- **解决方案**: ${incident.resolution}\n`;
      } else {
        md += `- **处理状态**: ⏳ 处理中\n`;
      }
      md += `\n`;
    });
  }
  
  if (todos && todos.length > 0) {
    md += `## ✅ 操作记录\n\n`;
    md += `| 类型 | 状态 | 计划时间 | 完成时间 | 备注 |\n|------|------|----------|----------|------|\n`;
    const typeMap = {
      'check_in': '到店',
      'check_out': '离店',
      'feeding': '喂食',
      'medication': '用药',
      'incident': '异常跟进'
    };
    const statusMap2 = {
      'pending': '待处理',
      'completed': '已完成',
      'cancelled': '已取消'
    };
    todos.forEach(todo => {
      md += `| ${typeMap[todo.type] || todo.type} | ${statusMap2[todo.status] || todo.status} | ${todo.due_date || '-'} | ${todo.completed_at || '-'} | ${todo.notes || '-'} |\n`;
    });
    md += `\n`;
  }
  
  if (order.check_in_notes) {
    md += `## 📝 入住备注\n\n`;
    md += `${order.check_in_notes}\n\n`;
  }
  
  if (order.check_out_notes) {
    md += `## 📝 离店备注\n\n`;
    md += `${order.check_out_notes}\n\n`;
  }
  
  md += `---\n\n`;
  md += `## 🖊️ 签收确认\n\n`;
  md += `| 确认项 | 签名 | 日期 |\n|--------|------|------|\n`;
  md += `| 主人确认接回宠物 | _______________ | _______________ |\n`;
  md += `| 门店经办人确认 | _______________ | _______________ |\n\n`;
  
  md += `---\n\n`;
  md += `*交接单生成时间: ${new Date().toLocaleString('zh-CN')}*\n`;
  md += `*订单编号: ${order.id}*\n`;
  
  return md;
}

// 生成 CSV 交接单
function generateCSVHandover(order, pet, owner, cage, todos, incidents) {
  const rows = [];
  const statusMap = { 'pending': '待入住', 'checked_in': '已入住', 'checked_out': '已离店', 'cancelled': '已取消' };
  const transportMap = { 'owner': '主人自行接送', 'delivery': '门店接送', 'third_party': '第三方接送' };
  const severityMap = { 'low': '低', 'medium': '中', 'high': '高', 'urgent': '紧急' };
  
  function escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }
  
  rows.push(['宠物寄养交接单', '', '', '']);
  rows.push(['生成时间', new Date().toLocaleString('zh-CN'), '', '']);
  rows.push(['订单编号', order.id, '', '']);
  rows.push(['']);
  
  rows.push(['【基本信息】', '', '', '']);
  rows.push(['订单状态', statusMap[order.status] || order.status, '', '']);
  rows.push(['入住日期', order.check_in_date, '', '']);
  rows.push(['离店日期', order.check_out_date, '', '']);
  rows.push(['笼位', cage ? cage.name : order.cage_name, '', '']);
  rows.push(['接送方式', transportMap[order.transportation] || order.transportation, '', '']);
  if (order.check_in_time) rows.push(['实际入住时间', order.check_in_time, '', '']);
  if (order.check_out_time) rows.push(['实际离店时间', order.check_out_time, '', '']);
  rows.push(['']);
  
  rows.push(['【宠物信息】', '', '', '']);
  if (pet) {
    rows.push(['宠物名称', pet.name, '', '']);
    rows.push(['种类', pet.type, '', '']);
    if (pet.breed) rows.push(['品种', pet.breed, '', '']);
    rows.push(['体重', (pet.weight || '-') + ' kg', '', '']);
    rows.push(['性别', pet.gender === 'male' ? '公' : pet.gender === 'female' ? '母' : '未知', '', '']);
    if (pet.birthday) rows.push(['生日', pet.birthday, '', '']);
    if (pet.personality) rows.push(['性格特点', pet.personality, '', '']);
    if (pet.health_notes) rows.push(['健康备注', pet.health_notes, '', '']);
  } else {
    rows.push(['宠物名称', order.pet_name, '', '']);
  }
  rows.push(['']);
  
  rows.push(['【主人信息】', '', '', '']);
  if (owner) {
    rows.push(['姓名', owner.name, '', '']);
    rows.push(['联系电话', owner.phone, '', '']);
    if (owner.emergency_name) rows.push(['紧急联系人', owner.emergency_name, '', '']);
    if (owner.emergency_phone) rows.push(['紧急联系电话', owner.emergency_phone, '', '']);
  } else {
    rows.push(['姓名', order.owner_name || '-', '', '']);
  }
  rows.push(['']);
  
  if (order.feeding_instructions) {
    rows.push(['【喂食说明】', '', '', '']);
    rows.push([order.feeding_instructions, '', '', '']);
    rows.push(['']);
  }
  
  if (order.medication_plan) {
    rows.push(['【用药计划】', '', '', '']);
    rows.push([order.medication_plan, '', '', '']);
    rows.push(['']);
  }
  
  if (order.special_requirements) {
    rows.push(['【特殊要求】', '', '', '']);
    rows.push([order.special_requirements, '', '', '']);
    rows.push(['']);
  }
  
  if (incidents && incidents.length > 0) {
    rows.push(['【异常事件记录】', '', '', '']);
    rows.push(['序号', '类型', '严重程度', '发生时间', '描述', '状态']);
    incidents.forEach((incident, idx) => {
      rows.push([
        idx + 1,
        incident.type,
        severityMap[incident.severity] || incident.severity,
        incident.created_at,
        incident.description || '',
        incident.resolved ? '已解决' : '处理中'
      ]);
    });
    rows.push(['']);
  }
  
  if (todos && todos.length > 0) {
    rows.push(['【操作记录】', '', '', '']);
    rows.push(['类型', '状态', '计划时间', '完成时间', '备注']);
    const typeMap = { 'check_in': '到店', 'check_out': '离店', 'feeding': '喂食', 'medication': '用药', 'incident': '异常跟进' };
    const statusMap2 = { 'pending': '待处理', 'completed': '已完成', 'cancelled': '已取消' };
    todos.forEach(todo => {
      rows.push([
        typeMap[todo.type] || todo.type,
        statusMap2[todo.status] || todo.status,
        todo.due_date || '',
        todo.completed_at || '',
        todo.notes || ''
      ]);
    });
    rows.push(['']);
  }
  
  if (order.check_in_notes) {
    rows.push(['【入住备注】', '', '', '']);
    rows.push([order.check_in_notes, '', '', '']);
    rows.push(['']);
  }
  
  if (order.check_out_notes) {
    rows.push(['【离店备注】', '', '', '']);
    rows.push([order.check_out_notes, '', '', '']);
    rows.push(['']);
  }
  
  return rows.map(row => row.map(escapeCSV).join(',')).join('\n') + '\n';
}

// 导出 Markdown
app.get('/api/export/order/:id/markdown', (req, res) => {
  try {
    const data = db.loadData();
    const order = data.orders.find(o => o.id === req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    
    const pet = data.pets.find(p => p.id === order.pet_id);
    const owner = data.owners.find(o => o.id === order.owner_id);
    const cage = data.cages.find(c => c.id === order.cage_id);
    const todos = data.todos.filter(t => t.order_id === order.id);
    const incidents = data.incidents.filter(i => i.order_id === order.id);
    
    const markdown = generateMarkdownHandover(order, pet, owner, cage, todos, incidents);
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=交接单-${order.pet_name}-${dayjs().format('YYYYMMDD')}.md`);
    res.send(markdown);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 导出 CSV
app.get('/api/export/order/:id/csv', (req, res) => {
  try {
    const data = db.loadData();
    const order = data.orders.find(o => o.id === req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    
    const pet = data.pets.find(p => p.id === order.pet_id);
    const owner = data.owners.find(o => o.id === order.owner_id);
    const cage = data.cages.find(c => c.id === order.cage_id);
    const todos = data.todos.filter(t => t.order_id === order.id);
    const incidents = data.incidents.filter(i => i.order_id === order.id);
    
    const csv = generateCSVHandover(order, pet, owner, cage, todos, incidents);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=交接单-${order.pet_name}-${dayjs().format('YYYYMMDD')}.csv`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== 首页统计 ==========
app.get('/api/dashboard/stats', (req, res) => {
  try {
    const data = db.loadData();
    const today = dayjs().format('YYYY-MM-DD');
    
    const stats = {
      total_pets: data.pets.length,
      total_orders: data.orders.length,
      checked_in_count: data.orders.filter(o => o.status === 'checked_in').length,
      today_check_in: data.orders.filter(o => o.check_in_date === today && o.status === 'pending').length,
      today_check_out: data.orders.filter(o => o.check_out_date === today && o.status === 'checked_in').length,
      pending_incidents: data.incidents.filter(i => !i.resolved).length,
      today_todos: data.todos.filter(t => {
        const dueDate = dayjs(t.due_date).format('YYYY-MM-DD');
        return dueDate === today && t.status === 'pending';
      }).length
    };
    
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log('========================================');
  console.log('  🐾 宠物寄养交接风险台账系统 已启动');
  console.log(`  访问地址: http://localhost:${PORT}`);
  console.log(`  API 地址: http://localhost:${PORT}/api`);
  console.log('========================================');
});
