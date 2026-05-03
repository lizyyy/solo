module.exports = {
  localeDir: './locales',
  baseLang: 'zh-CN',
  outputDir: './reports',
  
  formats: ['console', 'json', 'markdown', 'html'],
  
  checks: {
    missingKeys: true,
    extraKeys: true,
    emptyValues: true,
    placeholders: true,
    icuPlurals: true,
    variableNames: true,
    lengthRisk: true
  },
  
  lengthRisk: {
    threshold: 1.5,
    minBaseLength: 5,
    ignoreKeys: ['common.loading', 'common.success']
  },
  
  ignore: {
    keys: [
      'debug.*',
      '*.internal'
    ],
    languages: [],
    rules: []
  },
  
  fileTypes: ['.json', '.yaml', '.yml', '.po']
};
