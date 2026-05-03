const moment = require('moment');

class Validator {
  constructor() {
    this.riskIdCounter = 0;
  }

  // 生成唯一风险ID
  generateRiskId() {
    return `risk_${++this.riskIdCounter}`;
  }

  // 创建风险对象
  createRisk(type, level, description, suggestion) {
    return {
      id: this.generateRiskId(),
      type: type,
      level: level,
      description: description,
      suggestion: suggestion,
      confirmed: false,
      createdAt: new Date().toISOString()
    };
  }

  // 主校验方法
  async validate(parsedData) {
    const { caseManifest, documents, ocrTexts, signatureLogs, archiveRules } = parsedData;
    
    // 重置风险ID计数器
    this.riskIdCounter = 0;

    // 构建案件结构
    const cases = this.buildCaseStructure(caseManifest, documents);
    
    // 执行各项校验
    const validationResults = {
      timestamp: new Date().toISOString(),
      cases: [],
      summary: {
        totalCases: 0,
        totalDocuments: 0,
        totalRisks: 0,
        highRisks: 0,
        mediumRisks: 0,
        lowRisks: 0
      }
    };

    // 1. 校验每个案件
    for (const caseItem of cases) {
      const caseResult = {
        ...caseItem,
        risks: [],
        documents: []
      };

      // 获取该案件的所有文档
      const caseDocuments = documents.filter(doc => doc.caseNumber === caseItem.caseNumber);
      
      // 2. 校验必备材料
      const requiredDocsResult = this.validateRequiredDocuments(
        caseDocuments, 
        archiveRules, 
        caseItem.caseType
      );
      caseResult.risks.push(...requiredDocsResult.risks);

      // 3. 校验页码连续性
      const pageContinuityResult = this.validatePageContinuity(
        caseDocuments, 
        caseItem.startPage, 
        caseItem.endPage
      );
      caseResult.risks.push(...pageContinuityResult.risks);

      // 4. 校验案号/文书类型匹配
      const caseNumberResult = this.validateCaseNumber(
        caseItem.caseNumber, 
        caseDocuments, 
        archiveRules
      );
      caseResult.risks.push(...caseNumberResult.risks);

      // 5. 校验重复文号
      const duplicateNumberResult = this.validateDuplicateNumbers(
        caseDocuments, 
        caseItem.caseNumber
      );
      caseResult.risks.push(...duplicateNumberResult.risks);

      // 6. 处理每个文档的校验
      for (const doc of caseDocuments) {
        const docResult = {
          ...doc,
          risks: [],
          signatureInfo: null
        };

        // 6.1 校验电子签名有效期
        const signatureResult = this.validateSignatureValidity(
          doc, 
          signatureLogs
        );
        docResult.risks.push(...signatureResult.risks);
        docResult.signatureInfo = signatureResult.signatureInfo;

        // 6.2 校验密级脱敏
        const classificationResult = this.validateClassification(
          doc, 
          ocrTexts, 
          archiveRules
        );
        docResult.risks.push(...classificationResult.risks);

        caseResult.documents.push(docResult);
      }

      // 统计案件风险
      validationResults.summary.totalCases++;
      validationResults.summary.totalDocuments += caseResult.documents.length;
      
      // 统计所有风险
      const allRisks = [
        ...caseResult.risks,
        ...caseResult.documents.flatMap(d => d.risks)
      ];
      
      validationResults.summary.totalRisks += allRisks.length;
      validationResults.summary.highRisks += allRisks.filter(r => r.level === 'high').length;
      validationResults.summary.mediumRisks += allRisks.filter(r => r.level === 'medium').length;
      validationResults.summary.lowRisks += allRisks.filter(r => r.level === 'low').length;

      validationResults.cases.push(caseResult);
    }

    return validationResults;
  }

  // 构建案件结构
  buildCaseStructure(caseManifest, documents) {
    const cases = [];
    
    // 从 caseManifest 中提取案件
    if (caseManifest.cases && Array.isArray(caseManifest.cases)) {
      for (const caseItem of caseManifest.cases) {
        cases.push({
          caseNumber: caseItem.caseNumber,
          caseType: caseItem.caseType,
          year: caseItem.year,
          court: caseItem.court,
          startPage: caseItem.startPage || 1,
          endPage: caseItem.endPage || 
            Math.max(...documents.filter(d => d.caseNumber === caseItem.caseNumber).map(d => d.endPage || 0), 0),
          totalPages: caseItem.totalPages
        });
      }
    } else {
      // 如果没有明确的 cases 数组，尝试从 documents 中推断
      const caseNumbers = [...new Set(documents.map(d => d.caseNumber))];
      for (const caseNumber of caseNumbers) {
        const caseDocs = documents.filter(d => d.caseNumber === caseNumber);
        const minPage = Math.min(...caseDocs.map(d => d.startPage || Infinity));
        const maxPage = Math.max(...caseDocs.map(d => d.endPage || 0));
        
        // 尝试从案号中提取年度和案件类型
        const { year, caseType } = this.parseCaseNumber(caseNumber);
        
        cases.push({
          caseNumber: caseNumber,
          caseType: caseType || '未知',
          year: year,
          court: caseManifest.court || '未知',
          startPage: minPage,
          endPage: maxPage,
          totalPages: maxPage - minPage + 1
        });
      }
    }
    
    return cases;
  }

  // 解析案号
  parseCaseNumber(caseNumber) {
    // 典型案号格式：(2023)京0101民初1234号
    // 尝试提取年度和案件类型
    const yearMatch = caseNumber.match(/[(\[【](\d{4})[)\]】]/);
    const year = yearMatch ? yearMatch[1] : null;

    // 案件类型标识
    const typeKeywords = {
      '民初': '民事一审',
      '民终': '民事二审',
      '民申': '民事再审',
      '刑初': '刑事一审',
      '刑终': '刑事二审',
      '行初': '行政一审',
      '行终': '行政二审',
      '执': '执行',
      '民特': '民事特别程序',
      '民监': '民事监督'
    };

    let caseType = null;
    for (const [keyword, type] of Object.entries(typeKeywords)) {
      if (caseNumber.includes(keyword)) {
        caseType = type;
        break;
      }
    }

    return { year, caseType };
  }

  // 校验必备材料
  validateRequiredDocuments(documents, archiveRules, caseType) {
    const risks = [];
    
    // 获取规则中的必备材料列表
    const requiredDocs = this.getRequiredDocumentsFromRules(archiveRules, caseType);
    
    if (requiredDocs.length === 0) {
      return { risks };
    }

    // 检查每种必备材料是否存在
    for (const required of requiredDocs) {
      const found = documents.some(doc => 
        this.matchDocumentType(doc, required.type)
      );
      
      if (!found) {
        risks.push(this.createRisk(
          'missing_required_document',
          'high',
          `缺少必备材料：${required.name} (类型: ${required.type})`,
          `请补充 ${required.name} 材料，这是 ${caseType} 案件归档的必备材料`
        ));
      }
    }

    return { risks };
  }

  // 从规则中获取必备材料
  getRequiredDocumentsFromRules(rules, caseType) {
    const requiredDocs = [];
    
    // 尝试多种可能的规则结构
    if (rules.requiredDocuments) {
      // 直接有 requiredDocuments 列表
      if (Array.isArray(rules.requiredDocuments)) {
        requiredDocs.push(...rules.requiredDocuments);
      }
    }
    
    // 按案件类型分类的规则
    if (rules.documentRequirements && rules.documentRequirements[caseType]) {
      const caseTypeRules = rules.documentRequirements[caseType];
      if (caseTypeRules.required) {
        requiredDocs.push(...caseTypeRules.required);
      }
    }
    
    // 默认必备材料
    if (rules.defaultRequired && Array.isArray(rules.defaultRequired)) {
      requiredDocs.push(...rules.defaultRequired);
    }

    return requiredDocs;
  }

  // 匹配文档类型
  matchDocumentType(doc, typePattern) {
    const docType = doc.documentType || doc.type || '';
    const docName = doc.documentName || doc.name || '';
    
    // 精确匹配
    if (docType === typePattern) {
      return true;
    }
    
    // 包含匹配
    if (docType.includes(typePattern) || docName.includes(typePattern)) {
      return true;
    }
    
    return false;
  }

  // 校验页码连续性
  validatePageContinuity(documents, caseStartPage, caseEndPage) {
    const risks = [];
    
    // 如果没有文档，直接返回
    if (documents.length === 0) {
      return { risks };
    }

    // 按起始页码排序
    const sortedDocs = [...documents].sort((a, b) => a.startPage - b.startPage);
    
    // 1. 检查文档内部页码是否连续
    for (const doc of sortedDocs) {
      if (doc.endPage < doc.startPage) {
        risks.push(this.createRisk(
          'page_number_error',
          'high',
          `文档 "${doc.documentName}" 页码错误：结束页码 ${doc.endPage} 小于起始页码 ${doc.startPage}`,
          '请检查文档的页码范围设置'
        ));
        continue;
      }
      
      const expectedPages = doc.endPage - doc.startPage + 1;
      if (doc.pageCount && doc.pageCount !== expectedPages) {
        risks.push(this.createRisk(
          'page_count_mismatch',
          'medium',
          `文档 "${doc.documentName}" 页数不匹配：声明 ${doc.pageCount} 页，实际应为 ${expectedPages} 页`,
          '请核对文档的实际页数'
        ));
      }
    }

    // 2. 检查文档之间的页码连续性
    let expectedNextPage = caseStartPage || 1;
    
    for (let i = 0; i < sortedDocs.length; i++) {
      const doc = sortedDocs[i];
      
      // 检查是否有跳页
      if (doc.startPage > expectedNextPage) {
        const missingPages = doc.startPage - expectedNextPage;
        risks.push(this.createRisk(
          'page_gap',
          'high',
          `页码不连续：从第 ${expectedNextPage} 页到第 ${doc.startPage - 1} 页（共 ${missingPages} 页）缺失`,
          `请检查第 ${expectedNextPage} 到 ${doc.startPage - 1} 页的材料是否遗漏`
        ));
      }
      
      // 检查是否有页码重叠
      if (i > 0 && doc.startPage <= sortedDocs[i-1].endPage) {
        const overlapStart = Math.max(doc.startPage, sortedDocs[i-1].startPage);
        const overlapEnd = Math.min(doc.endPage, sortedDocs[i-1].endPage);
        risks.push(this.createRisk(
          'page_overlap',
          'medium',
          `页码重叠：第 ${overlapStart} 页到第 ${overlapEnd} 页同时出现在 "${sortedDocs[i-1].documentName}" 和 "${doc.documentName}" 中`,
          '请检查是否重复扫描或页码标注错误'
        ));
      }
      
      expectedNextPage = doc.endPage + 1;
    }

    // 3. 检查案件整体页码范围
    if (caseEndPage && expectedNextPage - 1 < caseEndPage) {
      risks.push(this.createRisk(
        'incomplete_pages',
        'high',
        `案件页码不完整：声明结束于第 ${caseEndPage} 页，但实际材料只到第 ${expectedNextPage - 1} 页`,
        `请检查第 ${expectedNextPage} 到 ${caseEndPage} 页的材料是否遗漏`
      ));
    }

    return { risks };
  }

  // 校验案号/文书类型匹配
  validateCaseNumber(caseNumber, documents, archiveRules) {
    const risks = [];
    
    // 1. 校验案号格式
    if (!this.isValidCaseNumberFormat(caseNumber)) {
      risks.push(this.createRisk(
        'invalid_case_number_format',
        'medium',
        `案号 "${caseNumber}" 格式不规范`,
        '请确认案号格式是否正确，标准格式应为：(年度)法院代字+类型代字+序号号'
      ));
    }

    // 2. 检查跨年度案号
    const { year, caseType } = this.parseCaseNumber(caseNumber);
    
    // 获取当前年度
    const currentYear = moment().format('YYYY');
    
    // 检查是否为跨年度案件
    if (year && parseInt(year) < parseInt(currentYear) - 1) {
      // 两年前的案件，可能需要特别注意
      risks.push(this.createRisk(
        'cross_year_case',
        'low',
        `案号 "${caseNumber}" 为 ${year} 年度案件，需确认是否符合跨年度归档规定`,
        '请确认该案件是否为跨年度归档，是否符合相关规定'
      ));
    }

    // 3. 检查文书类型是否与案件类型匹配
    const expectedDocumentTypes = this.getExpectedDocumentTypes(caseType);
    
    for (const doc of documents) {
      const docType = doc.documentType || doc.type || '';
      const isExpected = this.isDocumentTypeExpected(docType, expectedDocumentTypes);
      
      if (!isExpected && docType) {
        // 不是高风险，只是提醒
        risks.push(this.createRisk(
          'unexpected_document_type',
          'low',
          `文档 "${doc.documentName}" 类型 "${docType}" 可能不匹配案件类型 "${caseType}"`,
          '请确认该文书是否属于本案件'
        ));
      }
    }

    return { risks };
  }

  // 验证案号格式
  isValidCaseNumberFormat(caseNumber) {
    // 常见案号格式：(2023)京0101民初1234号 或 (2023)京0101民初1234号
    // 也可能包含：民初、民终、刑初、行初 等
    const pattern = /^[(\[【]\d{4}[)\]】][\u4e00-\u9fa5]+?\d*?[\u4e00-\u9fa5]{2,}?\d+?[号字]?$/;
    
    return pattern.test(caseNumber);
  }

  // 获取预期的文书类型
  getExpectedDocumentTypes(caseType) {
    const typeMap = {
      '民事一审': ['起诉状', '答辩状', '证据材料', '庭审笔录', '判决书', '裁定书', '调解书'],
      '民事二审': ['上诉状', '答辩状', '庭审笔录', '判决书', '裁定书'],
      '民事再审': ['再审申请书', '裁定书', '判决书'],
      '刑事一审': ['起诉书', '辩护词', '庭审笔录', '判决书', '裁定书'],
      '刑事二审': ['上诉状', '抗诉书', '庭审笔录', '判决书', '裁定书'],
      '行政一审': ['起诉状', '答辩状', '庭审笔录', '判决书', '裁定书'],
      '行政二审': ['上诉状', '答辩状', '庭审笔录', '判决书', '裁定书'],
      '执行': ['执行申请书', '执行裁定书', '协助执行通知书']
    };
    
    return typeMap[caseType] || [];
  }

  // 检查文书类型是否符合预期
  isDocumentTypeExpected(docType, expectedTypes) {
    if (expectedTypes.length === 0) return true; // 没有预期类型，全部接受
    
    return expectedTypes.some(expected => 
      docType.includes(expected) || expected.includes(docType)
    );
  }

  // 校验重复文号
  validateDuplicateNumbers(documents, currentCaseNumber) {
    const risks = [];
    
    // 1. 检查当前案件内是否有重复的文书号
    const documentNumbers = new Map();
    
    for (const doc of documents) {
      // 提取文书号（可能在 documentNumber、number、或从名称中提取）
      const docNumber = doc.documentNumber || doc.number || doc.id;
      
      if (docNumber) {
        if (documentNumbers.has(docNumber)) {
          const firstDoc = documentNumbers.get(docNumber);
          risks.push(this.createRisk(
            'duplicate_document_number',
            'high',
            `发现重复文号 "${docNumber}"：同时出现在 "${firstDoc.documentName}" 和 "${doc.documentName}" 中`,
            '请检查是否重复归档或文号标注错误'
          ));
        } else {
          documentNumbers.set(docNumber, doc);
        }
      }
    }

    // 2. 检查是否有与其他案件案号冲突的情况
    // （这里简化处理，主要检查是否有案号格式但与当前案号不同的情况）
    for (const doc of documents) {
      const docText = doc.documentName || '';
      // 检查文档名称中是否包含其他案号
      const caseNumberPattern = /[(\[【]\d{4}[)\]】][\u4e00-\u9fa5]+?\d*?[\u4e00-\u9fa5]{2,}?\d+?[号字]?/g;
      const foundCaseNumbers = docText.match(caseNumberPattern);
      
      if (foundCaseNumbers) {
        for (const foundCaseNumber of foundCaseNumbers) {
          if (foundCaseNumber !== currentCaseNumber) {
            risks.push(this.createRisk(
              'cross_case_reference',
              'medium',
              `文档 "${doc.documentName}" 中引用了其他案件案号 "${foundCaseNumber}"，当前案件为 "${currentCaseNumber}"`,
              '请确认该文档是否属于当前案件，是否存在材料混淆'
            ));
          }
        }
      }
    }

    return { risks };
  }

  // 校验电子签名有效期
  validateSignatureValidity(document, signatureLogs) {
    const risks = [];
    let signatureInfo = null;
    
    // 查找该文档的签名记录
    const docSignatures = signatureLogs.filter(log => 
      log.documentId === document.documentId || 
      log.documentName === document.documentName
    );

    if (document.hasSignature || docSignatures.length > 0) {
      // 有签名，检查有效期
      if (docSignatures.length > 0) {
        const signature = docSignatures[0];
        signatureInfo = {
          signer: signature.signer || signature.user,
          validFrom: signature.validFrom || signature.startDate,
          validTo: signature.validTo || signature.endDate,
          signedAt: signature.signedAt || signature.timestamp
        };

        // 检查签名是否在有效期内
        if (signatureInfo.validTo) {
          const validTo = moment(signatureInfo.validTo);
          const now = moment();
          
          if (validTo.isBefore(now)) {
            risks.push(this.createRisk(
              'signature_expired',
              'high',
              `文档 "${document.documentName}" 的电子签名已过期（有效期至 ${signatureInfo.validTo}）`,
              '请确认是否需要重新签名或确认签名有效性'
            ));
          } else if (validTo.diff(now, 'months') < 3) {
            // 即将过期（3个月内）
            risks.push(this.createRisk(
              'signature_expiring_soon',
              'medium',
              `文档 "${document.documentName}" 的电子签名即将过期（有效期至 ${signatureInfo.validTo}）`,
              '请注意签名有效期，及时办理续期手续'
            ));
          }
        }

        // 检查签名是否在归档时有效
        if (signatureInfo.signedAt && signatureInfo.validFrom) {
          const signedAt = moment(signatureInfo.signedAt);
          const validFrom = moment(signatureInfo.validFrom);
          
          if (signedAt.isBefore(validFrom)) {
            risks.push(this.createRisk(
              'signature_before_valid',
              'high',
              `文档 "${document.documentName}" 的签名时间（${signatureInfo.signedAt}）早于证书生效时间（${signatureInfo.validFrom}）`,
              '请检查签名是否有效，可能存在签名证书问题'
            ));
          }
        }
      } else {
        // 文档声明有签名，但没有找到签名记录
        risks.push(this.createRisk(
          'signature_record_missing',
          'medium',
          `文档 "${document.documentName}" 声明有电子签名，但未找到签名记录`,
          '请确认电子签名是否完整，或补充签名日志'
        ));
      }
    } else {
      // 没有签名，检查是否需要签名
      if (this.requiresSignature(document)) {
        risks.push(this.createRisk(
          'missing_required_signature',
          'high',
          `文档 "${document.documentName}" 为需要电子签名的文书，但未检测到签名`,
          '请确认该文书是否需要电子签名，并补充签名'
        ));
      }
    }

    return { risks, signatureInfo };
  }

  // 检查文档是否需要签名
  requiresSignature(document) {
    const requiresSignatureTypes = [
      '判决书', '裁定书', '调解书', '决定书', '通知书',
      '起诉状', '答辩状', '上诉状', '申请书',
      '庭审笔录', '合议庭评议笔录', '审判委员会讨论记录'
    ];
    
    const docName = document.documentName || '';
    const docType = document.documentType || '';
    
    return requiresSignatureTypes.some(type => 
      docName.includes(type) || docType.includes(type)
    );
  }

  // 校验密级脱敏
  validateClassification(document, ocrTexts, archiveRules) {
    const risks = [];
    
    // 获取文档密级
    const classification = document.classification || document.securityLevel || '普通';
    
    // 1. 检查密级是否符合规范
    const validClassifications = ['绝密', '机密', '秘密', '内部', '普通', '公开'];
    if (!validClassifications.includes(classification)) {
      risks.push(this.createRisk(
        'invalid_classification',
        'medium',
        `文档 "${document.documentName}" 密级 "${classification}" 不规范`,
        `请确认密级设置，有效密级包括：${validClassifications.join('、')}`
      ));
    }

    // 2. 检查敏感信息是否已脱敏
    const docOCRTexts = ocrTexts.filter(ocr => 
      ocr.documentId === document.documentId || 
      ocr.pageNumber >= document.startPage && ocr.pageNumber <= document.endPage
    );

    // 组合所有OCR文本
    const allText = docOCRTexts.map(ocr => ocr.text || ocr.content || '').join(' ');
    
    if (allText) {
      // 检查是否包含需要脱敏的敏感信息
      const sensitivePatterns = {
        '身份证号': /\d{17}[\dXx]/g,
        '银行卡号': /\d{16,19}/g,
        '手机号': /1[3-9]\d{9}/g,
        '电子邮箱': /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
      };

      // 只有非公开文档需要检查脱敏
      if (classification !== '公开') {
        for (const [type, pattern] of Object.entries(sensitivePatterns)) {
          const matches = allText.match(pattern);
          if (matches && matches.length > 0) {
            // 检查是否已经脱敏（包含 * 号）
            const unmasked = matches.filter(match => !match.includes('*'));
            
            if (unmasked.length > 0) {
              risks.push(this.createRisk(
                'sensitive_data_not_masked',
                'high',
                `文档 "${document.documentName}" 中发现未脱敏的 ${type}：${unmasked.slice(0, 3).join('、')}${unmasked.length > 3 ? '...' : ''}`,
                `请对 ${type} 等敏感个人信息进行脱敏处理（如用 **** 替换）`
              ));
            }
          }
        }
      }

      // 3. 检查密级是否与内容匹配
      if (classification === '绝密' || classification === '机密' || classification === '秘密') {
        // 检查OCR中是否有密级标注
        const hasClassificationMark = allText.includes('绝密') || 
                                    allText.includes('机密') || 
                                    allText.includes('秘密');
        
        if (!hasClassificationMark) {
          risks.push(this.createRisk(
            'classification_mark_missing',
            'medium',
            `文档 "${document.documentName}" 密级为 "${classification}"，但未在文档内容中检测到密级标注`,
            '请确认文档密级设置是否正确，或确认文档中是否应有密级标注'
          ));
        }
      }
    }

    return { risks };
  }
}

module.exports = Validator;
