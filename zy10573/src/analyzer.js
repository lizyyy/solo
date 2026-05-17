class AttributeAnalyzer {
  constructor(options = {}) {
    this.options = {
      sampleLimit: options.sampleLimit || 5,
      namingRules: options.namingRules || [],
      ...options
    };
    this.serviceAttributes = new Map();
    this.semanticGroups = new Map();
    this.conflicts = [];
    this.samples = new Map();
    this.allAttributes = new Set();
  }

  analyze(parsedData) {
    const { spans, errors, stats } = parsedData;

    spans.forEach(span => {
      this.processSpan(span);
    });

    this.detectConflicts();
    this.detectNamingViolations();

    return {
      summary: this.getSummary(),
      serviceBreakdown: this.getServiceBreakdown(),
      conflicts: this.conflicts,
      semanticGroups: Array.from(this.semanticGroups.entries()).map(([key, data]) => ({
        attribute: key,
        ...data
      })),
      samples: Object.fromEntries(this.samples.entries()),
      errors,
      stats: {
        ...stats,
        services: this.serviceAttributes.size,
        uniqueAttributes: this.allAttributes.size
      }
    };
  }

  processSpan(span) {
    const { serviceName, attributes, lineNum } = span;

    if (!this.serviceAttributes.has(serviceName)) {
      this.serviceAttributes.set(serviceName, {
        attributes: new Map(),
        spanCount: 0
      });
    }

    const serviceData = this.serviceAttributes.get(serviceName);
    serviceData.spanCount++;

    Object.keys(attributes).forEach(attrKey => {
      const value = attributes[attrKey];
      this.allAttributes.add(attrKey);

      this.updateServiceAttribute(serviceData, attrKey, value);
      this.updateSemanticGroup(attrKey, value, serviceName, lineNum);
      this.addSample(attrKey, value, serviceName, lineNum);
    });
  }

  updateServiceAttribute(serviceData, attrKey, value) {
    if (!serviceData.attributes.has(attrKey)) {
      serviceData.attributes.set(attrKey, {
        count: 0,
        values: new Set(),
        valueTypes: new Set()
      });
    }

    const attrData = serviceData.attributes.get(attrKey);
    attrData.count++;
    if (value !== undefined && value !== null) {
      attrData.values.add(String(value).substring(0, 100));
      attrData.valueTypes.add(typeof value);
    }
  }

  updateSemanticGroup(attrKey, value, serviceName, lineNum) {
    const normalized = this.normalizeAttributeName(attrKey);
    
    if (!this.semanticGroups.has(normalized)) {
      this.semanticGroups.set(normalized, {
        variants: new Set(),
        services: new Set(),
        totalCount: 0
      });
    }

    const group = this.semanticGroups.get(normalized);
    group.variants.add(attrKey);
    group.services.add(serviceName);
    group.totalCount++;
  }

  normalizeAttributeName(name) {
    return name
      .toLowerCase()
      .replace(/[-_]/g, '.')
      .replace(/\.+/g, '.')
      .replace(/^tenant\.?(id|no|number)?$/i, 'tenant.id')
      .replace(/^user\.?(id|no|number)?$/i, 'user.id')
      .replace(/^trace\.?id$/i, 'trace.id')
      .replace(/^span\.?id$/i, 'span.id')
      .replace(/^service\.?name$/i, 'service.name');
  }

  detectConflicts() {
    this.semanticGroups.forEach((group, normalized) => {
      if (group.variants.size > 1) {
        this.conflicts.push({
          type: 'naming_conflict',
          normalizedName: normalized,
          variants: Array.from(group.variants),
          services: Array.from(group.services),
          severity: this.calculateConflictSeverity(group)
        });
      }
    });
  }

  calculateConflictSeverity(group) {
    const variantCount = group.variants.size;
    const serviceCount = group.services.size;
    
    if (serviceCount >= 3 && variantCount >= 3) return 'critical';
    if (serviceCount >= 2 || variantCount >= 3) return 'warning';
    return 'info';
  }

  detectNamingViolations() {
    const violations = [];
    
    this.allAttributes.forEach(attr => {
      const violationsForAttr = this.checkNamingRules(attr);
      if (violationsForAttr.length > 0) {
        violations.push({
          attribute: attr,
          violations: violationsForAttr
        });
      }
    });

    if (violations.length > 0) {
      this.conflicts.push({
        type: 'naming_violation',
        details: violations,
        severity: 'info'
      });
    }
  }

  checkNamingRules(attr) {
    const violations = [];
    
    if (!/^[a-z][a-z0-9._]*$/.test(attr)) {
      violations.push('should use lowercase with dots, no special characters');
    }
    
    if (attr.includes('__') || attr.includes('--')) {
      violations.push('should not use consecutive separators');
    }
    
    if (attr.startsWith('.') || attr.endsWith('.')) {
      violations.push('should not start or end with dot');
    }
    
    if (attr.length > 80) {
      violations.push('name too long (max 80 chars)');
    }

    return violations;
  }

  addSample(attrKey, value, serviceName, lineNum) {
    const sampleKey = `${attrKey}:${serviceName}`;
    
    if (!this.samples.has(sampleKey)) {
      this.samples.set(sampleKey, []);
    }

    const samples = this.samples.get(sampleKey);
    
    if (samples.length < this.options.sampleLimit) {
      samples.push({
        value: String(value).substring(0, 200),
        valueType: typeof value,
        service: serviceName,
        lineNum
      });
    }
  }

  getSummary() {
    return {
      totalServices: this.serviceAttributes.size,
      totalAttributes: this.allAttributes.size,
      namingConflicts: this.conflicts.filter(c => c.type === 'naming_conflict').length,
      namingViolations: this.conflicts.filter(c => c.type === 'naming_violation').length,
      attributesPerService: this.getAttributesPerServiceStats()
    };
  }

  getAttributesPerServiceStats() {
    const counts = [];
    this.serviceAttributes.forEach((data) => {
      counts.push(data.attributes.size);
    });
    
    return {
      min: Math.min(...counts),
      max: Math.max(...counts),
      avg: Math.round(counts.reduce((a, b) => a + b, 0) / counts.length * 10) / 10
    };
  }

  getServiceBreakdown() {
    const result = {};
    
    this.serviceAttributes.forEach((data, serviceName) => {
      const attributes = {};
      data.attributes.forEach((attrData, attrKey) => {
        attributes[attrKey] = {
          count: attrData.count,
          valueCount: attrData.values.size,
          types: Array.from(attrData.valueTypes),
          sampleValues: Array.from(attrData.values).slice(0, 3)
        };
      });
      
      result[serviceName] = {
        spanCount: data.spanCount,
        attributeCount: data.attributes.size,
        attributes
      };
    });
    
    return result;
  }
}

module.exports = { AttributeAnalyzer };
