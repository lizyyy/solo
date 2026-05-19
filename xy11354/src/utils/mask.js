const maskPhone = (phone) => {
  if (!phone) return phone;
  const str = String(phone);
  if (str.length <= 7) return str.slice(0, 3) + '****';
  return str.slice(0, 3) + '****' + str.slice(-4);
};

const maskIdCard = (idCard) => {
  if (!idCard) return idCard;
  const str = String(idCard);
  if (str.length <= 10) return str.slice(0, 4) + '********';
  return str.slice(0, 6) + '********' + str.slice(-4);
};

const maskName = (name) => {
  if (!name) return name;
  const str = String(name);
  if (str.length <= 1) return '*';
  if (str.length === 2) return str[0] + '*';
  return str[0] + '*'.repeat(str.length - 2) + str.slice(-1);
};

const maskLicensePlate = (plate) => {
  if (!plate) return plate;
  const str = String(plate);
  if (str.length <= 4) return str;
  return str.slice(0, 2) + '***' + str.slice(-2);
};

const maskData = (data, options = {}) => {
  const { isAdmin = false } = options;
  
  if (isAdmin) {
    return data;
  }
  
  const maskFields = (obj) => {
    const result = { ...obj };
    if (result.phone) result.phone = maskPhone(result.phone);
    if (result.phoneNumber) result.phoneNumber = maskPhone(result.phoneNumber);
    if (result.idCard) result.idCard = maskIdCard(result.idCard);
    if (result.id_card) result.id_card = maskIdCard(result.id_card);
    if (result.name) result.name = maskName(result.name);
    if (result.visitorName) result.visitorName = maskName(result.visitorName);
    if (result.contact) result.contact = maskName(result.contact);
    if (result.licensePlate) result.licensePlate = maskLicensePlate(result.licensePlate);
    if (result.plateNumber) result.plateNumber = maskLicensePlate(result.plateNumber);
    return result;
  };
  
  if (Array.isArray(data)) {
    return data.map(item => maskFields(item));
  }
  
  return maskFields(data);
};

module.exports = {
  maskPhone,
  maskIdCard,
  maskName,
  maskLicensePlate,
  maskData
};
