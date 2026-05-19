"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorTypeLabel = exports.getStatusLabel = exports.exportErrors = exports.exportBooks = void 0;
const csv_writer_1 = require("csv-writer");
const exportBooks = async (filePath, books) => {
    const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
        path: filePath,
        header: [
            { id: 'id', title: 'ID' },
            { id: 'isbn', title: 'ISBN' },
            { id: 'title', title: '书名' },
            { id: 'condition', title: '品相' },
            { id: 'grade', title: '年级' },
            { id: 'donor', title: '捐赠人' },
            { id: 'volunteer', title: '负责人' },
            { id: 'status', title: '状态' },
            { id: 'created_at', title: '创建时间' },
            { id: 'notes', title: '备注' }
        ]
    });
    const records = books.map(book => ({
        id: book.id,
        isbn: book.isbn,
        title: book.title || '',
        condition: book.condition || '',
        grade: book.grade || '',
        donor: book.donor || '',
        volunteer: book.volunteer,
        status: book.status,
        created_at: book.created_at || '',
        notes: book.notes || ''
    }));
    await csvWriter.writeRecords(records);
};
exports.exportBooks = exportBooks;
const exportErrors = async (filePath, errors) => {
    const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
        path: filePath,
        header: [
            { id: 'id', title: 'ID' },
            { id: 'row_number', title: '行号' },
            { id: 'error_type', title: '错误类型' },
            { id: 'error_message', title: '错误信息' },
            { id: 'suggestion', title: '修改建议' },
            { id: 'volunteer', title: '负责人' },
            { id: 'created_at', title: '创建时间' },
            { id: 'resolved', title: '已解决' },
            { id: 'raw_data', title: '原始数据' }
        ]
    });
    const records = errors.map(error => ({
        id: error.id,
        row_number: error.row_number || '',
        error_type: error.error_type,
        error_message: error.error_message,
        suggestion: error.suggestion || '',
        volunteer: error.volunteer || '',
        created_at: error.created_at || '',
        resolved: error.resolved ? '是' : '否',
        raw_data: error.raw_data || ''
    }));
    await csvWriter.writeRecords(records);
};
exports.exportErrors = exportErrors;
const getStatusLabel = (status) => {
    const labels = {
        pending: '待复核',
        approved: '已通过',
        rejected: '已拒绝',
        shelved: '已上架'
    };
    return labels[status] || status;
};
exports.getStatusLabel = getStatusLabel;
const getErrorTypeLabel = (type) => {
    const labels = {
        invalid_isbn: 'ISBN格式错误',
        missing_required: '缺少必填项',
        invalid_condition: '品相无效',
        invalid_grade: '年级无效',
        duplicate_isbn: 'ISBN重复',
        parse_error: '解析错误',
        unknown: '未知错误'
    };
    return labels[type] || type;
};
exports.getErrorTypeLabel = getErrorTypeLabel;
