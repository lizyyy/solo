export function maskIdCard(idCard: string): string {
  if (!idCard || idCard.length < 8) return idCard;
  return idCard.substring(0, 6) + '********' + idCard.substring(14);
}

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone;
  return phone.substring(0, 3) + '****' + phone.substring(7);
}

export function maskAddress(address: string): string {
  if (!address || address.length < 6) return address;
  return address.substring(0, 3) + '***' + address.substring(address.length - 3);
}

export function maskCustomerData(customer: any): any {
  return {
    ...customer,
    idCard: maskIdCard(customer.idCard || customer.id_card),
    phone: maskPhone(customer.phone),
    address: maskAddress(customer.address)
  };
}
