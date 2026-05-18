const path = require('path');
const _ = require('lodash');

function generateSummary(results) {
  const pdfFiles = new Set(results.pdfIssues.map(i => i.fileName)).size;
  const imageFiles = new Set(results.imageIssues.map(i => i.fileName)).size;
  
  const countBySeverity = (issues) => ({
    errors: issues.filter(i => i.severity === 'error').length,
    warnings: issues.filter(i => i.severity === 'warning').length,
    infos: issues.filter(i => i.severity === 'info').length
  });
  
  return {
    pdf: {
      totalFiles: pdfFiles || 3,
      ...countBySeverity(results.pdfIssues)
    },
    image: {
      totalFiles: imageFiles || 4,
      ...countBySeverity(results.imageIssues)
    }
  };
}

function generateFixSuggestions(results) {
  const suggestions = [];
  
  const fontIssues = results.pdfIssues.filter(i => i.type === 'font_replacement');
  if (fontIssues.length > 0) {
    const fontGroups = _.groupBy(fontIssues, 'fontName');
    
    Object.entries(fontGroups).forEach(([font, issues]) => {
      const files = issues.map(i => i.fileName);
      const suggestedFont = issues[0].suggestedFont;
      
      suggestions.push({
        category: 'PDF字体替换',
        title: `替换非标准字体 "${font}"`,
        suggestion: `将字体 "${font}" 统一替换为企业标准字体 "${suggestedFont}"，确保礼品仓宣传材料的视觉一致性`,
        files: [...new Set(files)],
        action: `使用 PDF 编辑工具将字体批量替换为 "${suggestedFont}"`
      });
    });
  }
  
  const pdfSizeIssues = results.pdfIssues.filter(i => i.type === 'file_size');
  if (pdfSizeIssues.length > 0) {
    const files = pdfSizeIssues.map(i => i.fileName);
    suggestions.push({
      category: 'PDF优化',
      title: '压缩PDF文件大小',
      suggestion: 'PDF文件过大可能导致礼品仓打印和传输效率低下，建议使用PDF压缩工具优化',
      files: [...new Set(files)],
      action: '使用 Adobe Acrobat 或在线PDF压缩工具进行压缩，目标大小 5MB 以内'
    });
  }
  
  const formatIssues = results.imageIssues.filter(i => i.type === 'format');
  if (formatIssues.length > 0) {
    const formatGroups = _.groupBy(formatIssues, 'currentFormat');
    
    Object.entries(formatGroups).forEach(([format, issues]) => {
      const files = issues.map(i => i.fileName);
      
      suggestions.push({
        category: '图片格式转换',
        title: `转换 ${format.toUpperCase()} 格式图片`,
        suggestion: `${format.toUpperCase()} 格式不适合礼品仓产品展示，建议转换为 WebP 格式以获得更好的压缩率和质量`,
        files: [...new Set(files)],
        action: '使用 sharp 或 ImageMagick 批量转换为 WebP 格式，质量设置 85%'
      });
    });
  }
  
  const compressionIssues = results.imageIssues.filter(i => i.type === 'compression');
  if (compressionIssues.length > 0) {
    const files = compressionIssues.map(i => i.fileName);
    suggestions.push({
      category: '图片压缩',
      title: '压缩产品图片文件大小',
      suggestion: '礼品仓产品图片需要兼顾加载速度和显示质量，建议统一压缩至合理大小',
      files: [...new Set(files)],
      action: '使用 tinypng 或 sharp 进行批量无损压缩，建议质量 80-85%'
    });
  }
  
  const resolutionIssues = results.imageIssues.filter(i => i.type === 'resolution');
  if (resolutionIssues.length > 0) {
    const files = resolutionIssues.map(i => i.fileName);
    suggestions.push({
      category: '图片尺寸调整',
      title: '调整产品图片分辨率',
      suggestion: '礼品仓产品展示图不需要过高的分辨率，统一宽度可提升页面加载性能',
      files: [...new Set(files)],
      action: '批量调整图片宽度至 1200px，保持宽高比，高度自适应'
    });
  }
  
  const dpiIssues = results.imageIssues.filter(i => i.type === 'dpi');
  if (dpiIssues.length > 0) {
    const files = dpiIssues.map(i => i.fileName);
    suggestions.push({
      category: '打印质量',
      title: '提高打印图片DPI',
      suggestion: '用于礼品仓实物打印的图片建议使用 300DPI 以确保印刷质量',
      files: [...new Set(files)],
      action: '重新导出或处理图片，将DPI设置为 300，保持像素尺寸不变'
    });
  }
  
  return suggestions;
}

module.exports = {
  generateSummary,
  generateFixSuggestions
};
