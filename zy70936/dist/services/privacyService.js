"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskIdCard = maskIdCard;
exports.maskPhone = maskPhone;
exports.maskAddress = maskAddress;
exports.maskCustomerData = maskCustomerData;
function maskIdCard(idCard) {
    if (!idCard || idCard.length < 8)
        return idCard;
    return idCard.substring(0, 6) + '********' + idCard.substring(14);
}
function maskPhone(phone) {
    if (!phone || phone.length < 7)
        return phone;
    return phone.substring(0, 3) + '****' + phone.substring(7);
}
function maskAddress(address) {
    if (!address || address.length < 6)
        return address;
    return address.substring(0, 3) + '***' + address.substring(address.length - 3);
}
function maskCustomerData(customer) {
    return {
        ...customer,
        idCard: maskIdCard(customer.idCard || customer.id_card),
        phone: maskPhone(customer.phone),
        address: maskAddress(customer.address)
    };
}
