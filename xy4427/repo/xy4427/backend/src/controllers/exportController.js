const {
  generateReleaseMarkdown,
  generateAuditPackage,
} = require('../services/exportService');

async function exportReleaseMarkdownHandler(req, res) {
  try {
    const { teacherName } = req.body || {};
    
    const result = await generateReleaseMarkdown(teacherName || '未指定');
    
    res.setHeader('Content-Type', 'application/json');
    res.json({
      success: true,
      data: {
        releaseId: result.releaseId,
        markdown: result.markdown,
        generatedAt: result.generatedAt,
        teacherName: result.teacherName,
        canRelease: result.canRelease,
      },
    });
  } catch (error) {
    console.error('生成放行单失败:', error);
    res.status(500).json({
      success: false,
      message: '生成放行单失败: ' + error.message,
    });
  }
}

async function downloadReleaseMarkdownHandler(req, res) {
  try {
    const { teacherName } = req.query || {};
    
    const result = await generateReleaseMarkdown(teacherName || '未指定');
    
    const filename = `放行单_${result.releaseId.substring(0, 8)}.md`;
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(filename)}`);
    res.send(result.markdown);
  } catch (error) {
    console.error('下载放行单失败:', error);
    res.status(500).json({
      success: false,
      message: '下载放行单失败: ' + error.message,
    });
  }
}

async function exportAuditPackageHandler(req, res) {
  try {
    const { teacherName } = req.body || {};
    
    const result = await generateAuditPackage(teacherName || '未指定');
    
    res.setHeader('Content-Type', 'application/json');
    res.json({
      success: true,
      data: {
        auditId: result.auditId,
        auditPackage: result.auditPackage,
        generatedAt: result.generatedAt,
        generatedBy: result.generatedBy,
      },
    });
  } catch (error) {
    console.error('生成审计包失败:', error);
    res.status(500).json({
      success: false,
      message: '生成审计包失败: ' + error.message,
    });
  }
}

async function downloadAuditPackageHandler(req, res) {
  try {
    const { teacherName } = req.query || {};
    
    const result = await generateAuditPackage(teacherName || '未指定');
    
    const filename = `审计包_${result.auditId.substring(0, 8)}.json`;
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(filename)}`);
    res.send(result.auditPackage);
  } catch (error) {
    console.error('下载审计包失败:', error);
    res.status(500).json({
      success: false,
      message: '下载审计包失败: ' + error.message,
    });
  }
}

module.exports = {
  exportReleaseMarkdownHandler,
  downloadReleaseMarkdownHandler,
  exportAuditPackageHandler,
  downloadAuditPackageHandler,
};
