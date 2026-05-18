"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatVolume = formatVolume;
exports.formatWeight = formatWeight;
exports.formatCurrency = formatCurrency;
exports.calculateTruckVolume = calculateTruckVolume;
exports.validateDimensions = validateDimensions;
exports.validateWeight = validateWeight;
function formatVolume(volume) {
    return `${volume.toFixed(3)} m³`;
}
function formatWeight(weight) {
    return `${weight.toFixed(2)} kg`;
}
function formatCurrency(amount) {
    return `${amount} 元`;
}
function calculateTruckVolume(width, height, depth) {
    return (width * height * depth) / 1000000000;
}
function validateDimensions(width, height, depth) {
    return width > 0 && height > 0 && depth > 0;
}
function validateWeight(weight) {
    return weight > 0;
}
