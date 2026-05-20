const fs = require('fs');
const csv = require('csv-parser');

const parseAppointmentCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const errors = [];
    let rowNumber = 0;

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('headers', (headers) => {
        const requiredHeaders = ['childId', 'childName', 'vaccineCode', 'vaccineName', 'appointmentDate'];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
          reject(new Error(`CSV缺少必要的列: ${missingHeaders.join(', ')}`));
        }
      })
      .on('data', (data) => {
        rowNumber++;
        try {
          const appointment = {
            childId: data.childId?.trim(),
            childName: data.childName?.trim(),
            birthDate: data.birthDate?.trim() || '',
            vaccineCode: data.vaccineCode?.trim(),
            vaccineName: data.vaccineName?.trim(),
            appointmentDate: data.appointmentDate?.trim(),
            phone: data.phone?.trim() || '',
            contraindications: data.contraindications?.trim() || '',
            isReschedule: (data.isReschedule?.trim() || '').toLowerCase() === 'true',
            originalAppointmentDate: data.originalAppointmentDate?.trim() || '',
            guardianName: data.guardianName?.trim() || '',
            address: data.address?.trim() || '',
            remarks: data.remarks?.trim() || ''
          };

          if (!appointment.childId) {
            errors.push({ row: rowNumber, data, error: '儿童ID不能为空', suggestion: '请填写儿童身份证号或建档编号' });
          } else if (!appointment.vaccineCode) {
            errors.push({ row: rowNumber, data, error: '疫苗编码不能为空', suggestion: '请填写正确的疫苗编码' });
          } else if (!appointment.appointmentDate) {
            errors.push({ row: rowNumber, data, error: '预约日期不能为空', suggestion: '请填写预约日期(YYYY-MM-DD)' });
          } else {
            results.push(appointment);
          }
        } catch (e) {
          errors.push({ row: rowNumber, data, error: `解析错误: ${e.message}`, suggestion: '请检查该行数据格式' });
        }
      })
      .on('end', () => {
        resolve({ success: results, parseErrors: errors });
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

const parseJSON = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error(`JSON解析失败: ${e.message}`));
      }
    });
  });
};

module.exports = {
  parseAppointmentCSV,
  parseJSON
};
