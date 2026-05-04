const stringSimilarity = require('string-similarity');
const { v4: uuidv4 } = require('uuid');

class ComplianceService {
  constructor() {
    this.similarityThreshold = 0.7;
    this.durationDeviationThreshold = 0.15;
  }

  runAllChecks(transcript, sponsorRequirements, forbiddenTerms) {
    const checks = [];
    
    checks.push(...this.checkSponsorRequirements(transcript, sponsorRequirements));
    checks.push(...this.checkForbiddenTerms(transcript, forbiddenTerms));
    checks.push(...this.checkDurationDeviation(sponsorRequirements, transcript));
    checks.push(...this.checkMissingSponsorElements(sponsorRequirements, transcript));
    
    return checks;
  }

  checkSponsorRequirements(transcript, sponsorRequirements) {
    const checks = [];
    
    for (const req of sponsorRequirements) {
      if (req.type === 'keywords' || req.type === 'phrase') {
        const keywordChecks = this.checkKeywordPhrase(transcript, req);
        checks.push(...keywordChecks);
      } else if (req.type === 'segment') {
        const segmentChecks = this.checkSegment(transcript, req);
        checks.push(...segmentChecks);
      }
    }
    
    return checks;
  }

  checkKeywordPhrase(transcript, req) {
    const checks = [];
    const keywords = req.keywords || [req.text];
    
    for (const keyword of keywords) {
      const normalizedKeyword = this.normalizeText(keyword);
      const normalizedTranscript = this.normalizeText(transcript);
      
      const found = this.findSimilarMatches(normalizedKeyword, normalizedTranscript);
      
      if (found.length === 0) {
        checks.push({
          id: uuidv4(),
          type: 'missing',
          category: 'sponsor_keyword',
          severity: req.required ? 'high' : 'medium',
          expected: keyword,
          found: null,
          context: '',
          position: null,
          suggestion: `请确认是否遗漏了关键词：${keyword}`,
          requirement: req.name || req.text
        });
      } else {
        for (const match of found) {
          if (match.similarity < 0.9) {
            const actualText = this.extractContext(transcript, match.position, keyword.length);
            checks.push({
              id: uuidv4(),
              type: 'mismatch',
              category: 'sponsor_keyword',
              severity: 'medium',
              expected: keyword,
              found: actualText,
              context: this.extractContext(transcript, match.position, 50),
              position: match.position,
              similarity: match.similarity,
              suggestion: `相似度为${(match.similarity * 100).toFixed(1)}%，可能是口误：${actualText}`,
              requirement: req.name || req.text
            });
          }
        }
      }
    }
    
    return checks;
  }

  checkSegment(transcript, req) {
    const checks = [];
    const expectedText = req.text || '';
    const normalizedExpected = this.normalizeText(expectedText);
    const normalizedTranscript = this.normalizeText(transcript);
    
    const segments = this.findSegmentMatches(normalizedExpected, normalizedTranscript);
    
    if (segments.length === 0) {
      checks.push({
        id: uuidv4(),
        type: 'missing',
        category: 'sponsor_segment',
        severity: req.required ? 'high' : 'medium',
        expected: expectedText,
        found: null,
        context: '',
        position: null,
        suggestion: `请确认是否遗漏了赞助段：${req.name || '未命名'}`,
        requirement: req.name || '赞助段'
      });
    } else {
      for (const segment of segments) {
        if (segment.similarity < 0.85) {
          const actualSegment = this.extractContext(transcript, segment.position, expectedText.length + 50);
          checks.push({
            id: uuidv4(),
            type: 'mismatch',
            category: 'sponsor_segment',
            severity: 'medium',
            expected: expectedText,
            found: actualSegment.substring(0, expectedText.length + 20),
            context: actualSegment,
            position: segment.position,
            similarity: segment.similarity,
            suggestion: `段落相似度为${(segment.similarity * 100).toFixed(1)}%，可能存在漏读或错读`,
            requirement: req.name || '赞助段'
          });
        }
      }
    }
    
    return checks;
  }

  checkForbiddenTerms(transcript, forbiddenTerms) {
    const checks = [];
    const normalizedTranscript = this.normalizeText(transcript);
    
    for (const term of forbiddenTerms) {
      const normalizedTerm = this.normalizeText(term.term || term);
      
      const matches = this.findExactMatches(normalizedTerm, normalizedTranscript);
      
      for (const match of matches) {
        const context = this.extractContext(transcript, match.position, 40);
        checks.push({
          id: uuidv4(),
          type: 'forbidden',
          category: 'forbidden_term',
          severity: term.severity || 'high',
          expected: null,
          found: match.text,
          context: context,
          position: match.position,
          suggestion: term.replacement ? `建议替换为：${term.replacement}` : '请移除或替换该表述',
          requirement: `禁用表述：${term.term || term}`
        });
      }
    }
    
    return checks;
  }

  checkDurationDeviation(sponsorRequirements, transcript) {
    const checks = [];
    
    for (const req of sponsorRequirements) {
      if (req.expectedDuration && req.type === 'segment') {
        const actualDuration = this.estimateDuration(transcript, req.text);
        
        if (actualDuration > 0) {
          const deviation = Math.abs(actualDuration - req.expectedDuration) / req.expectedDuration;
          
          if (deviation > this.durationDeviationThreshold) {
            const isTooLong = actualDuration > req.expectedDuration;
            checks.push({
              id: uuidv4(),
              type: 'duration',
              category: 'duration_deviation',
              severity: 'medium',
              expected: req.expectedDuration,
              found: actualDuration,
              context: `预计${req.expectedDuration}秒，实际约${actualDuration.toFixed(1)}秒`,
              position: null,
              deviation: deviation,
              suggestion: isTooLong 
                ? `当前段落比预期长${((deviation) * 100).toFixed(0)}%，建议精简` 
                : `当前段落比预期短${((deviation) * 100).toFixed(0)}%，建议补充`,
              requirement: req.name || '赞助段时长'
            });
          }
        }
      }
    }
    
    return checks;
  }

  checkMissingSponsorElements(sponsorRequirements, transcript) {
    const checks = [];
    const requiredElements = sponsorRequirements.filter(req => req.required);
    
    for (const req of requiredElements) {
      if (req.elements) {
        for (const element of req.elements) {
          const normalizedElement = this.normalizeText(element);
          const normalizedTranscript = this.normalizeText(transcript);
          
          const found = this.findSimilarMatches(normalizedElement, normalizedTranscript);
          
          if (found.length === 0) {
            checks.push({
              id: uuidv4(),
              type: 'missing',
              category: 'required_element',
              severity: 'high',
              expected: element,
              found: null,
              context: '',
              position: null,
              suggestion: `必须要素"${element}"未找到，请确认`,
              requirement: req.name || '赞助要求'
            });
          }
        }
      }
    }
    
    return checks;
  }

  normalizeText(text) {
    if (!text) return '';
    return text.toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  findSimilarMatches(keyword, text) {
    const matches = [];
    const keywordLen = keyword.length;
    
    for (let i = 0; i <= text.length - keywordLen; i++) {
      const substring = text.substring(i, i + keywordLen);
      const similarity = stringSimilarity.compareTwoStrings(keyword, substring);
      
      if (similarity >= this.similarityThreshold) {
        matches.push({
          position: i,
          text: substring,
          similarity: similarity
        });
      }
    }
    
    return matches.sort((a, b) => b.similarity - a.similarity);
  }

  findExactMatches(keyword, text) {
    const matches = [];
    let pos = -1;
    
    while ((pos = text.indexOf(keyword, pos + 1)) !== -1) {
      matches.push({
        position: pos,
        text: text.substring(pos, pos + keyword.length)
      });
    }
    
    return matches;
  }

  findSegmentMatches(expected, text) {
    const matches = [];
    const expectedLen = expected.length;
    const windowSize = Math.max(expectedLen * 0.8, 10);
    
    for (let i = 0; i <= text.length - windowSize; i++) {
      const window = text.substring(i, i + windowSize);
      const similarity = stringSimilarity.compareTwoStrings(expected, window);
      
      if (similarity >= 0.6) {
        matches.push({
          position: i,
          text: window,
          similarity: similarity
        });
      }
    }
    
    return matches.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  }

  extractContext(text, position, range) {
    const start = Math.max(0, position - range / 2);
    const end = Math.min(text.length, position + range / 2);
    
    let prefix = '';
    let suffix = '';
    
    if (start > 0) prefix = '...';
    if (end < text.length) suffix = '...';
    
    return prefix + text.substring(start, end) + suffix;
  }

  estimateDuration(fullTranscript, segmentText) {
    if (!fullTranscript || !segmentText) return 0;
    
    const chineseRate = 4.5;
    const englishRate = 3.0;
    
    const chineseChars = (segmentText.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (segmentText.match(/[a-zA-Z]+/g) || []).length;
    
    return (chineseChars / chineseRate) + (englishWords / englishRate);
  }
}

module.exports = new ComplianceService();
