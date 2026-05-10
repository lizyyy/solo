const store = require('../models/store');

const AppError = require('../utils/errors');

function createAppointment(data) {
  const { patientName, patientId, vaccineId, appointmentDate, inventoryId } = data;

  if (!patientName || !patientId || !vaccineId || !appointmentDate) {
    throw new AppError('缺少必填字段: patientName, patientId, vaccineId, appointmentDate', 400);
  }

  const vaccine = store.getVaccineById(vaccineId);
  if (!vaccine) {
    throw new AppError('疫苗不存在', 404);
  }

  let selectedInventory;

  if (inventoryId) {
    selectedInventory = store.getInventoryById(inventoryId);
    if (!selectedInventory) {
      throw new AppError('指定的库存不存在', 404);
    }
    if (selectedInventory.vaccineId !== vaccineId) {
      throw new AppError('库存疫苗类型不匹配', 400);
    }
    if (selectedInventory.status !== 'available') {
      throw new AppError(`库存状态异常: ${selectedInventory.status}`, 400);
    }
  } else {
    const availableInventory = store.getAvailableInventoryForVaccine(vaccineId);
    if (availableInventory.length === 0) {
      throw new AppError('没有可用的疫苗库存', 400);
    }
    selectedInventory = availableInventory.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0];
  }

  const coldBox = store.getColdBoxById(selectedInventory.coldBoxId);
  if (coldBox && coldBox.status === 'exception') {
    throw new AppError('该批次疫苗所在冷链箱异常，无法预约', 400);
  }

  if (selectedInventory.availableDoses <= 0) {
    throw new AppError('该批次疫苗可用剂次不足', 400);
  }

  const appointment = store.createAppointment({
    patientName,
    patientId,
    vaccineId,
    vaccineName: vaccine.name,
    inventoryId: selectedInventory.id,
    batchNo: selectedInventory.batchNo,
    coldBoxId: selectedInventory.coldBoxId,
    appointmentDate
  });

  store.createAppointmentLock({
    appointmentId: appointment.id,
    inventoryId: selectedInventory.id,
    batchNo: selectedInventory.batchNo,
    dose: 1
  });

  const newLockedDoses = selectedInventory.lockedDoses + 1;
  const newAvailableDoses = selectedInventory.availableDoses - 1;
  store.updateInventory(selectedInventory.id, {
    lockedDoses: newLockedDoses,
    availableDoses: newAvailableDoses
  });

  return {
    appointment,
    inventory: {
      ...selectedInventory,
      lockedDoses: newLockedDoses,
      availableDoses: newAvailableDoses
    },
    message: '预约成功，已锁定1剂次'
  };
}

function cancelAppointment(appointmentId, reason = '') {
  const appointment = store.getAppointmentById(appointmentId);
  if (!appointment) {
    throw new AppError('预约不存在', 404);
  }

  if (appointment.status === 'cancelled' || appointment.status === 'completed') {
    throw new AppError(`预约状态为 ${appointment.status}，无法取消`, 400);
  }

  const lock = store.getAppointmentLockByAppointmentId(appointmentId);
  if (!lock) {
    throw new AppError('未找到对应的预约锁定记录', 500);
  }

  store.releaseLock(lock.id);

  const inventory = store.getInventoryById(appointment.inventoryId);
  if (inventory) {
    const newLockedDoses = inventory.lockedDoses - 1;
    const newAvailableDoses = inventory.availableDoses + 1;
    store.updateInventory(inventory.id, {
      lockedDoses: newLockedDoses,
      availableDoses: newAvailableDoses
    });
  }

  store.updateAppointment(appointmentId, {
    status: 'cancelled',
    cancelledReason: reason,
    cancelledAt: new Date().toISOString()
  });

  return {
    appointment: { ...appointment, status: 'cancelled', cancelledReason: reason },
    inventory: inventory ? {
      ...inventory,
      lockedDoses: inventory.lockedDoses - 1,
      availableDoses: inventory.availableDoses + 1
    } : null,
    message: `预约已取消，批次 ${appointment.batchNo} 释放1剂次`
  };
}

function rescheduleAppointment(appointmentId, newDate, newInventoryId = null) {
  const appointment = store.getAppointmentById(appointmentId);
  if (!appointment) {
    throw new AppError('预约不存在', 404);
  }

  if (appointment.status !== 'scheduled') {
    throw new AppError(`预约状态为 ${appointment.status}，无法改约`, 400);
  }

  if (!newDate) {
    throw new AppError('缺少新的预约日期', 400);
  }

  if (newInventoryId && newInventoryId !== appointment.inventoryId) {
    const oldInventory = store.getInventoryById(appointment.inventoryId);
    const newInventory = store.getInventoryById(newInventoryId);

    if (!newInventory) {
      throw new AppError('新的库存不存在', 404);
    }

    if (newInventory.vaccineId !== appointment.vaccineId) {
      throw new AppError('新库存疫苗类型不匹配', 400);
    }

    if (newInventory.status !== 'available') {
      throw new AppError(`新库存状态异常: ${newInventory.status}`, 400);
    }

    if (newInventory.availableDoses <= 0) {
      throw new AppError('新库存可用剂次不足', 400);
    }

    const coldBox = store.getColdBoxById(newInventory.coldBoxId);
    if (coldBox && coldBox.status === 'exception') {
      throw new AppError('新批次疫苗所在冷链箱异常，无法改约', 400);
    }

    const oldLock = store.getAppointmentLockByAppointmentId(appointmentId);
    if (!oldLock) {
      throw new AppError('未找到旧的预约锁定记录', 500);
    }
    store.releaseLock(oldLock.id);

    if (oldInventory) {
      store.updateInventory(oldInventory.id, {
        lockedDoses: oldInventory.lockedDoses - 1,
        availableDoses: oldInventory.availableDoses + 1
      });
    }

    store.createAppointmentLock({
      appointmentId: appointment.id,
      inventoryId: newInventory.id,
      batchNo: newInventory.batchNo,
      dose: 1
    });

    store.updateInventory(newInventory.id, {
      lockedDoses: newInventory.lockedDoses + 1,
      availableDoses: newInventory.availableDoses - 1
    });

    store.updateAppointment(appointmentId, {
      appointmentDate: newDate,
      inventoryId: newInventoryId,
      batchNo: newInventory.batchNo,
      coldBoxId: newInventory.coldBoxId,
      updatedAt: new Date().toISOString()
    });

    return {
      appointment: store.getAppointmentById(appointmentId),
      oldInventory: oldInventory ? {
        ...oldInventory,
        lockedDoses: oldInventory.lockedDoses - 1,
        availableDoses: oldInventory.availableDoses + 1
      } : null,
      newInventory: {
        ...newInventory,
        lockedDoses: newInventory.lockedDoses + 1,
        availableDoses: newInventory.availableDoses - 1
      },
      message: `改约成功，旧批次 ${appointment.batchNo} 已释放，新批次 ${newInventory.batchNo} 已锁定`
    };
  } else {
    store.updateAppointment(appointmentId, {
      appointmentDate: newDate,
      updatedAt: new Date().toISOString()
    });

    return {
      appointment: store.getAppointmentById(appointmentId),
      inventory: store.getInventoryById(appointment.inventoryId),
      message: '改约成功，日期已更新'
    };
  }
}

function completeAppointment(appointmentId) {
  const appointment = store.getAppointmentById(appointmentId);
  if (!appointment) {
    throw new AppError('预约不存在', 404);
  }

  if (appointment.status !== 'scheduled') {
    throw new AppError(`预约状态为 ${appointment.status}，无法完成`, 400);
  }

  const lock = store.getAppointmentLockByAppointmentId(appointmentId);
  if (lock) {
    store.releaseLock(lock.id);
  }

  const inventory = store.getInventoryById(appointment.inventoryId);
  if (inventory) {
    const newLockedDoses = inventory.lockedDoses - 1;
    const newTotalDoses = inventory.totalDoses - 1;
    store.updateInventory(inventory.id, {
      lockedDoses: newLockedDoses,
      totalDoses: newTotalDoses
    });
  }

  store.updateAppointment(appointmentId, {
    status: 'completed',
    completedAt: new Date().toISOString()
  });

  return {
    appointment: store.getAppointmentById(appointmentId),
    inventory: inventory ? {
      ...inventory,
      lockedDoses: inventory.lockedDoses - 1,
      totalDoses: inventory.totalDoses - 1
    } : null,
    message: '预约已完成，剂次已消耗'
  };
}

module.exports = {
  createAppointment,
  cancelAppointment,
  rescheduleAppointment,
  completeAppointment
};
