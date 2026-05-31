const ANOMALY_TYPES = {
  EQUIVALENT_MISMATCH: {
    code: 'EQ001',
    name: '等价答案误判',
    description: '学生答案与标准答案表述不同但实质等价',
    explanation: '学生答案经过归一化处理后，与某个等价答案完全匹配，但系统最初判为错误。需要人工确认是否应为正确。'
  },
  PARTIAL_CORRECT: {
    code: 'PC001',
    name: '部分正确',
    description: '学生答案包含部分正确内容但不完整',
    explanation: '学生答案与标准答案有部分匹配，但缺少关键要素或包含错误内容。可能需要按步给分。'
  },
  FORMAT_DIFFERENCE: {
    code: 'FD001',
    name: '格式差异',
    description: '答案内容正确但格式不符合要求',
    explanation: '学生答案的实质内容正确，但在书写格式、单位、符号等方面存在差异。需要根据评分标准决定是否扣分。'
  },
  CALCULATION_ERROR: {
    code: 'CE001',
    name: '计算错误',
    description: '解题思路正确但计算过程出错',
    explanation: '学生的解题方法和步骤是正确的，但在数值计算过程中出现错误。可能需要酌情给分。'
  },
  CONCEPT_MISUNDERSTANDING: {
    code: 'CM001',
    name: '概念误解',
    description: '对基本概念或原理理解错误',
    explanation: '学生答案反映出对相关知识点的理解存在偏差或错误。这是需要重点讲评的内容。'
  },
  METHOD_ERROR: {
    code: 'ME001',
    name: '方法错误',
    description: '解题方法选择错误或应用不当',
    explanation: '学生选择了不恰当的解题方法，或正确方法的应用过程存在错误。需要在讲评中强调方法选择的依据。'
  },
  UNCLEAR_ANSWER: {
    code: 'UA001',
    name: '答案不清晰',
    description: '学生答案表述模糊，无法准确判断正误',
    explanation: '学生答案书写潦草、表述不清或缺关键步骤，导致系统无法准确判断。需要人工审阅后给出最终判定。'
  },
  BLANK_ANSWER: {
    code: 'BA001',
    name: '空白答案',
    description: '学生未作答或答案完全不相关',
    explanation: '学生未提供任何有效答案，或答案与题目完全无关。通常判定为错误。'
  }
};

function detectAnomaly(question, mistakeRecord, checkResult) {
  const anomalies = [];

  if (checkResult.matchType === 'equivalent' && mistakeRecord.originalJudgment === 'wrong') {
    anomalies.push({
      type: ANOMALY_TYPES.EQUIVALENT_MISMATCH,
      details: {
        studentAnswer: mistakeRecord.studentAnswer,
        standardAnswer: question.standardAnswer,
        matchedEquivalent: checkResult.matchedAnswer
      }
    });
  }

  const studentAns = String(mistakeRecord.studentAnswer || '').trim();
  const standardAns = String(question.standardAnswer || '').trim();

  if (studentAns.length > 0 && standardAns.length > 0) {
    const similarity = calculateSimilarity(studentAns, standardAns);
    if (similarity > 0.6 && similarity < 0.95 && checkResult.matchType === 'none') {
      anomalies.push({
        type: ANOMALY_TYPES.PARTIAL_CORRECT,
        details: {
          similarity: Math.round(similarity * 100) + '%',
          studentAnswer: mistakeRecord.studentAnswer,
          standardAnswer: question.standardAnswer
        }
      });
    }
  }

  if (studentAns.length === 0 || studentAns === '无' || studentAns === '不会') {
    anomalies.push({
      type: ANOMALY_TYPES.BLANK_ANSWER,
      details: {}
    });
  }

  return anomalies;
}

function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const costs = [];
  for (let i = 0; i <= shorter.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= longer.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (shorter.charAt(i - 1) !== longer.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) {
      costs[longer.length] = lastValue;
    }
  }
  
  return (longer.length - costs[longer.length]) / longer.length;
}

function explainAnomaly(anomaly) {
  const type = anomaly.type;
  let explanation = `【${type.code}】${type.name}\n`;
  explanation += `${type.description}\n\n`;
  explanation += `详细说明：\n${type.explanation}\n\n`;
  
  if (anomaly.details) {
    explanation += `具体信息：\n`;
    Object.entries(anomaly.details).forEach(([key, value]) => {
      explanation += `  ${key}: ${value}\n`;
    });
  }
  
  return explanation;
}

function getAnomalyType(code) {
  return Object.values(ANOMALY_TYPES).find(t => t.code === code);
}

module.exports = {
  ANOMALY_TYPES,
  detectAnomaly,
  explainAnomaly,
  getAnomalyType
};
