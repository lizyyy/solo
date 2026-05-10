import { v4 as uuidv4 } from 'uuid';
import { CityNode, ServiceResult } from '../types';
import { getDB, updateDB } from '../storage';

export function createCity(name: string, code: string, description?: string): ServiceResult<CityNode> {
  const db = getDB();
  
  const existingCode = db.cities.find(c => c.code === code.toUpperCase());
  if (existingCode) {
    return {
      success: false,
      message: `城市代码「${code.toUpperCase()}」已被「${existingCode.name}」使用，请更换代码`,
    };
  }
  
  const existingName = db.cities.find(c => c.name === name);
  if (existingName) {
    return {
      success: false,
      message: `城市名称「${name}」已存在，代码为「${existingName.code}」`,
    };
  }
  
  const city: CityNode = {
    id: uuidv4(),
    name,
    code: code.toUpperCase(),
    description,
    isActive: true,
  };
  
  updateDB(d => ({
    ...d,
    cities: [...d.cities, city],
  }));
  
  return {
    success: true,
    message: `城市「${city.name}」(${city.code})已创建成功`,
    data: city,
  };
}

export function listCities(): ServiceResult<CityNode[]> {
  const db = getDB();
  const sorted = [...db.cities].sort((a, b) => a.code.localeCompare(b.code));
  
  return {
    success: true,
    message: `共查询到 ${sorted.length} 个城市节点`,
    data: sorted,
  };
}

export function getCityByIdentifier(identifier: string): ServiceResult<CityNode> {
  const db = getDB();
  
  let city = db.cities.find(c => c.id === identifier);
  if (!city) {
    city = db.cities.find(c => c.code === identifier.toUpperCase());
  }
  if (!city) {
    city = db.cities.find(c => c.name === identifier);
  }
  
  if (!city) {
    return {
      success: false,
      message: `未找到标识为「${identifier}」的城市节点，请确认城市ID、代码或名称是否正确`,
    };
  }
  
  return {
    success: true,
    message: `找到城市「${city.name}」`,
    data: city,
  };
}

export function deactivateCity(cityId: string): ServiceResult<CityNode> {
  const db = getDB();
  const city = db.cities.find(c => c.id === cityId);
  
  if (!city) {
    return {
      success: false,
      message: `未找到ID为「${cityId}」的城市`,
    };
  }
  
  const hasCases = db.equipmentCases.some(c => c.currentCityId === cityId);
  if (hasCases) {
    return {
      success: false,
      message: `城市「${city.name}」仍有设备箱在库，无法停用，请先将设备箱调拨至其他城市`,
    };
  }
  
  updateDB(d => ({
    ...d,
    cities: d.cities.map(c => 
      c.id === cityId ? { ...c, isActive: false } : c
    ),
  }));
  
  return {
    success: true,
    message: `城市「${city.name}」已停用，新的巡演清单和调拨将无法使用该城市`,
    data: { ...city, isActive: false },
  };
}
