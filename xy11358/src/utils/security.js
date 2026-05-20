function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone;
  return phone.substring(0, 3) + '****' + phone.substring(phone.length - 4);
}

function maskIdCard(idCard) {
  if (!idCard || idCard.length < 10) return idCard;
  return idCard.substring(0, 6) + '********' + idCard.substring(idCard.length - 4);
}

module.exports = { maskPhone, maskIdCard };
