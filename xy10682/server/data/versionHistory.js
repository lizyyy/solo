module.exports = [
  {
    id: 1,
    recordId: 3,
    before: {
      reading: 2175,
      estimateFlag: true,
      abnormalThreshold: 50,
      feeDifference: 65.00
    },
    after: {
      reading: 2180,
      estimateFlag: true,
      abnormalThreshold: 60,
      feeDifference: 78.00
    },
    operator: '张主管',
    operationTime: '2024-05-05T10:30:00Z'
  },
  {
    id: 2,
    recordId: 6,
    before: {
      reading: 740,
      estimateFlag: false,
      abnormalThreshold: 50,
      feeDifference: 0
    },
    after: {
      reading: 742,
      estimateFlag: false,
      abnormalThreshold: 50,
      feeDifference: 0
    },
    operator: '李主管',
    operationTime: '2024-05-07T14:20:00Z'
  }
];
