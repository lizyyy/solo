"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskPhone = maskPhone;
exports.getPhoneLast4 = getPhoneLast4;
exports.checkPhoneLeaked = checkPhoneLeaked;
exports.findAllPhones = findAllPhones;
exports.auditRecordPhones = auditRecordPhones;
exports.maskText = maskText;
function maskPhone(phone) {
    if (!phone)
        return '';
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 7)
        return phone;
    return clean.slice(0, 3) + '****' + clean.slice(-4);
}
function getPhoneLast4(phone) {
    if (!phone)
        return '';
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 4)
        return clean;
    return clean.slice(-4);
}
function checkPhoneLeaked(text) {
    if (!text)
        return false;
    return findAllPhones(text).length > 0;
}
function findAllPhones(text) {
    if (!text)
        return [];
    const phonePattern = /1[3-9]\d{9}/g;
    const occurrences = [];
    let match;
    while ((match = phonePattern.exec(text)) !== null) {
        const phone = match[0];
        if (!phone.includes('*')) {
            occurrences.push({
                phone,
                masked: maskPhone(phone),
                last4: getPhoneLast4(phone),
            });
        }
    }
    return occurrences;
}
function auditRecordPhones(record) {
    const audits = [];
    const fieldMap = [
        { key: 'phone_number', name: '手机号字段' },
        { key: 'user_query', name: '用户问题' },
        { key: 'annotator_comment', name: '标注员留言' },
        { key: 'model_output', name: '模型输出' },
    ];
    fieldMap.forEach(({ key, name }) => {
        const text = record[key] || '';
        const occurrences = findAllPhones(text);
        if (occurrences.length > 0) {
            audits.push({ field: key, fieldName: name, occurrences });
        }
    });
    return audits;
}
function maskText(text) {
    if (!text)
        return '';
    return text.replace(/1[3-9]\d{9}/g, (match) => maskPhone(match));
}
