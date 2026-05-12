const Storage = require('./storage');

const SAMPLE_SAVE_HOURS = 48;
const MIN_TEMP = 0;
const MAX_TEMP = 8;

const getCurrentTime = () => new Date();

class FoodSampleService {
  static createDish(data) {
    const existing = Storage.find('dishes', d => d.name === data.name && d.isActive);
    if (existing.length > 0) {
      return { success: false, error: '菜品已存在', code: 'DUPLICATE_DISH' };
    }
    const dish = Storage.create('dishes', { ...data, isActive: true });
    return { success: true, data: dish };
  }

  static createResponsiblePerson(data) {
    const existing = Storage.find('responsiblePersons', p => p.employeeId === data.employeeId);
    if (existing.length > 0) {
      return { success: false, error: '工号已存在', code: 'DUPLICATE_EMPLOYEE' };
    }
    const person = Storage.create('responsiblePersons', { ...data, isActive: true });
    return { success: true, data: person };
  }

  static createSampleBox(data) {
    const existing = Storage.find('sampleBoxes', b => b.boxNumber === data.boxNumber);
    if (existing.length > 0) {
      return { success: false, error: '留样盒编号已存在', code: 'DUPLICATE_BOX' };
    }
    const box = Storage.create('sampleBoxes', { ...data, status: 'available' });
    return { success: true, data: box };
  }

  static createMeal(data) {
    const { mealType, mealDate, dishIds } = data;
    
    const existing = Storage.find('meals', m => 
      m.mealType === mealType && m.mealDate === mealDate && m.status !== 'cancelled'
    );
    if (existing.length > 0) {
      return { success: false, error: '该餐次已存在', code: 'DUPLICATE_MEAL' };
    }

    const meal = Storage.create('meals', {
      mealType,
      mealDate,
      dishIds: dishIds || [],
      status: 'prepared',
      openedAt: null
    });
    return { success: true, data: meal };
  }

  static openMeal(mealId, operatorId) {
    const meal = Storage.getById('meals', mealId);
    if (!meal) {
      return { success: false, error: '餐次不存在', code: 'MEAL_NOT_FOUND' };
    }
    if (meal.status === 'opened') {
      return { success: false, error: '餐次已开餐', code: 'MEAL_ALREADY_OPENED' };
    }

    const samples = Storage.find('samples', s => s.mealId === mealId && s.status === 'active');
    const sampledDishIds = new Set(samples.map(s => s.dishId));
    const missingDishes = meal.dishIds.filter(dishId => !sampledDishIds.has(dishId));

    if (missingDishes.length > 0) {
      this.createAlert({
        type: 'UNSAMPLED_OPEN',
        level: 'high',
        message: `未留样就开餐：餐次${meal.mealDate}-${meal.mealType}有${missingDishes.length}道菜品未留样`,
        mealId,
        missingDishIds: missingDishes,
        operatorId
      });
    }

    Storage.update('meals', mealId, {
      status: 'opened',
      openedAt: getCurrentTime().toISOString(),
      openedBy: operatorId
    });

    return { success: true, data: { ...meal, status: 'opened', missingDishes } };
  }

  static createSample(data) {
    const { mealId, dishId, boxId, responsiblePersonId, sampleTime, temperature } = data;

    const meal = Storage.getById('meals', mealId);
    if (!meal) {
      return { success: false, error: '餐次不存在', code: 'MEAL_NOT_FOUND' };
    }

    const dish = Storage.getById('dishes', dishId);
    if (!dish) {
      return { success: false, error: '菜品不存在', code: 'DISH_NOT_FOUND' };
    }

    const box = Storage.getById('sampleBoxes', boxId);
    if (!box) {
      return { success: false, error: '留样盒不存在', code: 'BOX_NOT_FOUND' };
    }

    const activeSamples = Storage.find('samples', s => s.boxId === boxId && s.status === 'active');
    if (activeSamples.length > 0) {
      const existingSample = activeSamples[0];
      const existingAlerts = Storage.find('alerts', a => 
        a.type === 'BOX_REUSE' && 
        a.mealId === mealId && 
        a.boxId === boxId && 
        a.existingSampleId === existingSample.id && 
        a.status === 'active'
      );
      
      if (existingAlerts.length === 0) {
        this.createAlert({
          type: 'BOX_REUSE',
          level: 'medium',
          message: `留样盒${box.boxNumber}被重复绑定，当前留样菜品：${existingSample.dishName}`,
          mealId,
          boxId,
          existingSampleId: existingSample.id
        });
      }
      return { success: false, error: '留样盒正在使用中，不能重复绑定', code: 'BOX_IN_USE' };
    }

    const duplicateDishSamples = Storage.find('samples', s => 
      s.mealId === mealId && s.dishId === dishId && s.status !== 'cancelled'
    );
    if (duplicateDishSamples.length > 0) {
      return { success: false, error: '该菜品此餐次已留样', code: 'DUPLICATE_SAMPLE' };
    }

    if (temperature < MIN_TEMP || temperature > MAX_TEMP) {
      this.createAlert({
        type: 'TEMPERATURE_EXCEED',
        level: 'high',
        message: `留样温度超限：菜品${dish.name}温度${temperature}℃，正常范围${MIN_TEMP}-${MAX_TEMP}℃`,
        dishId,
        mealId,
        temperature
      });
    }

    const expireTime = new Date(sampleTime || getCurrentTime());
    expireTime.setHours(expireTime.getHours() + SAMPLE_SAVE_HOURS);

    const sample = Storage.create('samples', {
      mealId,
      dishId,
      dishName: dish.name,
      boxId,
      boxNumber: box.boxNumber,
      responsiblePersonId,
      sampleTime: sampleTime || getCurrentTime().toISOString(),
      temperature,
      expireTime: expireTime.toISOString(),
      status: 'active'
    });

    Storage.create('temperatureLogs', {
      sampleId: sample.id,
      temperature,
      recordTime: sample.sampleTime,
      recordedBy: responsiblePersonId
    });

    Storage.update('sampleBoxes', boxId, { status: 'in_use', currentSampleId: sample.id });

    return { success: true, data: sample };
  }

  static checkExpiredSamples() {
    const now = getCurrentTime();
    const activeSamples = Storage.find('samples', s => s.status === 'active');
    const expired = activeSamples.filter(s => new Date(s.expireTime) < now);

    expired.forEach(sample => {
      const existingAlert = Storage.find('alerts', a => 
        a.type === 'EXPIRED_NOT_DESTROYED' && 
        a.sampleId === sample.id && 
        a.status === 'active'
      );
      if (existingAlert.length === 0) {
        this.createAlert({
          type: 'EXPIRED_NOT_DESTROYED',
          level: 'high',
          message: `留样到期未销毁：菜品${sample.dishName}（留样盒${sample.boxNumber}）已到期`,
          mealId: sample.mealId,
          sampleId: sample.id,
          expireTime: sample.expireTime
        });
      }
    });

    return { success: true, data: { count: expired.length, samples: expired } };
  }

  static destroySample(sampleId, operatorId, destroyMethod = 'incineration') {
    const sample = Storage.getById('samples', sampleId);
    if (!sample) {
      return { success: false, error: '留样记录不存在', code: 'SAMPLE_NOT_FOUND' };
    }
    if (sample.status === 'destroyed') {
      return { success: false, error: '该留样已销毁，请勿重复操作', code: 'ALREADY_DESTROYED' };
    }

    const destroyRecord = Storage.create('destroyRecords', {
      sampleId,
      dishName: sample.dishName,
      boxNumber: sample.boxNumber,
      destroyTime: getCurrentTime().toISOString(),
      operatorId,
      destroyMethod
    });

    Storage.update('samples', sampleId, { status: 'destroyed', destroyedAt: getCurrentTime().toISOString() });
    Storage.update('sampleBoxes', sample.boxId, { status: 'available', currentSampleId: null });

    const alerts = Storage.find('alerts', a => a.sampleId === sampleId && a.status === 'active');
    alerts.forEach(alert => {
      Storage.update('alerts', alert.id, { status: 'resolved', resolvedAt: getCurrentTime().toISOString() });
    });

    return { success: true, data: destroyRecord };
  }

  static createAlert(data) {
    const alert = Storage.create('alerts', {
      ...data,
      status: 'active',
      createdAt: getCurrentTime().toISOString()
    });
    return alert;
  }

  static getAlerts(status = 'active') {
    if (status === 'all') {
      return { success: true, data: Storage.getAll('alerts') };
    }
    return { success: true, data: Storage.find('alerts', a => a.status === status) };
  }

  static getSupervisionQuery(startDate, endDate) {
    const meals = Storage.find('meals', m => {
      if (!startDate && !endDate) return true;
      const mealDate = new Date(m.mealDate);
      if (startDate && mealDate < new Date(startDate)) return false;
      if (endDate && mealDate > new Date(endDate)) return false;
      return true;
    });

    const samples = Storage.find('samples', s => true);
    const destroyRecords = Storage.find('destroyRecords', d => true);
    const alerts = Storage.find('alerts', a => true);
    const temperatureLogs = Storage.find('temperatureLogs', t => true);

    const result = meals.map(meal => {
      const mealSamples = samples.filter(s => s.mealId === meal.id);
      const mealSampleIds = new Set(mealSamples.map(s => s.id));
      
      const mealAlerts = alerts.filter(a => {
        if (a.mealId === meal.id) return true;
        if (a.sampleId && mealSampleIds.has(a.sampleId)) return true;
        return false;
      });
      
      const destroyedSamples = mealSamples.filter(s => s.status === 'destroyed');

      return {
        meal: {
          id: meal.id,
          mealType: meal.mealType,
          mealDate: meal.mealDate,
          status: meal.status,
          dishCount: meal.dishIds.length,
          openedAt: meal.openedAt
        },
        samples: mealSamples.map(s => ({
          id: s.id,
          dishName: s.dishName,
          boxNumber: s.boxNumber,
          sampleTime: s.sampleTime,
          temperature: s.temperature,
          expireTime: s.expireTime,
          status: s.status,
          destroyedAt: s.destroyedAt
        })),
        destroyRecords: destroyRecords.filter(d => mealSamples.some(s => s.id === d.sampleId)),
        temperatureLogs: temperatureLogs.filter(t => mealSampleIds.has(t.sampleId)),
        alerts: mealAlerts,
        statistics: {
          totalDishes: meal.dishIds.length,
          sampledCount: mealSamples.length,
          destroyedCount: destroyedSamples.length,
          temperatureLogCount: temperatureLogs.filter(t => mealSampleIds.has(t.sampleId)).length,
          alertCount: mealAlerts.length
        }
      };
    });

    return {
      success: true,
      data: {
        period: { startDate, endDate },
        records: result,
        summary: {
          totalMeals: meals.length,
          totalSamples: samples.length,
          totalDestroyed: destroyRecords.length,
          totalTemperatureLogs: temperatureLogs.length,
          totalAlerts: alerts.length,
          activeAlerts: alerts.filter(a => a.status === 'active').length
        }
      }
    };
  }

  static getAllDishes() {
    return { success: true, data: Storage.getAll('dishes') };
  }

  static getAllMeals() {
    return { success: true, data: Storage.getAll('meals') };
  }

  static getAllSampleBoxes() {
    return { success: true, data: Storage.getAll('sampleBoxes') };
  }

  static getAllResponsiblePersons() {
    return { success: true, data: Storage.getAll('responsiblePersons') };
  }

  static getAllSamples() {
    return { success: true, data: Storage.getAll('samples') };
  }

  static getAllDestroyRecords() {
    return { success: true, data: Storage.getAll('destroyRecords') };
  }
}

module.exports = FoodSampleService;
