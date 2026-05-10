const { v4: uuidv4 } = require('uuid');

function generateReportNo() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `NB${year}${month}${day}${random}`;
}

function generateId() {
    return uuidv4();
}

function formatDate(date) {
    const d = date || new Date();
    return d.toISOString().replace('T', ' ').substring(0, 19);
}

module.exports = {
    generateReportNo,
    generateId,
    formatDate
};
