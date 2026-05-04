const {
  OriginalText,
  BrailleProofreading,
  TemperatureCurve,
  StudentFeedback,
} = require('../models');
const moment = require('moment');

async function importOriginalTexts(data) {
  const imported = [];
  
  for (const item of data) {
    const existing = await OriginalText.findOne({
      where: { paragraphId: item.paragraphId },
    });
    
    if (!existing) {
      const newText = await OriginalText.create({
        paragraphId: item.paragraphId,
        pageNumber: item.pageNumber,
        content: item.content,
        charCount: item.content.length,
      });
      imported.push(newText);
    } else {
      await existing.update({
        pageNumber: item.pageNumber,
        content: item.content,
        charCount: item.content.length,
      });
      imported.push(existing);
    }
  }
  
  return imported;
}

async function importBrailleProofreadings(data) {
  const imported = [];
  
  for (const item of data) {
    const existing = await BrailleProofreading.findOne({
      where: { paragraphId: item.paragraphId },
    });
    
    if (!existing) {
      const newProofreading = await BrailleProofreading.create({
        paragraphId: item.paragraphId,
        pageNumber: item.pageNumber,
        brailleContent: item.brailleContent,
        points: typeof item.points === 'string' ? item.points : JSON.stringify(item.points),
        proofreader: item.proofreader,
        proofreadingTime: item.proofreadingTime ? moment(item.proofreadingTime).toDate() : null,
        status: item.status || 'pending',
        comments: item.comments,
      });
      imported.push(newProofreading);
    } else {
      await existing.update({
        pageNumber: item.pageNumber,
        brailleContent: item.brailleContent,
        points: typeof item.points === 'string' ? item.points : JSON.stringify(item.points),
        proofreader: item.proofreader,
        proofreadingTime: item.proofreadingTime ? moment(item.proofreadingTime).toDate() : null,
        status: item.status || existing.status,
        comments: item.comments || existing.comments,
      });
      imported.push(existing);
    }
  }
  
  return imported;
}

async function importTemperatureCurves(data) {
  const imported = [];
  
  for (const item of data) {
    const existing = await TemperatureCurve.findOne({
      where: {
        jobId: item.jobId,
        pageNumber: item.pageNumber,
        timestamp: moment(item.timestamp).toDate(),
      },
    });
    
    if (!existing) {
      const newCurve = await TemperatureCurve.create({
        jobId: item.jobId,
        pageNumber: item.pageNumber,
        timestamp: moment(item.timestamp).toDate(),
        temperature: item.temperature,
        targetTemperature: item.targetTemperature,
        machineId: item.machineId,
      });
      imported.push(newCurve);
    } else {
      await existing.update({
        temperature: item.temperature,
        targetTemperature: item.targetTemperature,
        machineId: item.machineId,
      });
      imported.push(existing);
    }
  }
  
  return imported;
}

async function importStudentFeedbacks(data) {
  const imported = [];
  
  for (const item of data) {
    const existing = await StudentFeedback.findOne({
      where: {
        pageNumber: item.pageNumber,
        studentName: item.studentName,
        feedbackTime: moment(item.feedbackTime).toDate(),
      },
    });
    
    if (!existing) {
      const newFeedback = await StudentFeedback.create({
        pageNumber: item.pageNumber,
        studentName: item.studentName,
        feedback: item.feedback,
        rating: item.rating,
        feedbackTime: moment(item.feedbackTime).toDate(),
      });
      imported.push(newFeedback);
    } else {
      await existing.update({
        feedback: item.feedback,
        rating: item.rating,
      });
      imported.push(existing);
    }
  }
  
  return imported;
}

module.exports = {
  importOriginalTexts,
  importBrailleProofreadings,
  importTemperatureCurves,
  importStudentFeedbacks,
};
