import { ImageAnalyzer } from './image-analyzer.js';

export class RuleEngine {
  constructor(layoutRules) {
    this.rules = layoutRules;
  }

  async analyzeGroup(group, screenshotsDir) {
    const issues = [];

    const baseScreenshot = group.screenshots.find(
      s => s.language === group.base_language
    );

    if (!baseScreenshot) {
      issues.push({
        device: group.device,
        page: group.page,
        language: group.base_language,
        filename: null,
        issue_type: 'missing_base',
        severity: 'critical',
        message: `缺少基准图 (${group.base_language})`,
        details: `设备: ${group.device}, 页面: ${group.page}`
      });
    }

    const baseImage = baseScreenshot
      ? await ImageAnalyzer.loadImage(`${screenshotsDir}/${baseScreenshot.filename}`)
      : null;

    for (const screenshot of group.screenshots) {
      const targetImage = await ImageAnalyzer.loadImage(`${screenshotsDir}/${screenshot.filename}`);

      if (!targetImage) {
        issues.push({
          device: group.device,
          page: group.page,
          language: screenshot.language,
          filename: screenshot.filename,
          issue_type: 'missing_image',
          severity: 'critical',
          message: `截图文件不存在`,
          details: `文件路径: ${screenshotsDir}/${screenshot.filename}`
        });
        continue;
      }

      if (baseImage) {
        const baseSize = ImageAnalyzer.getImageSize(baseImage);
        const targetSize = ImageAnalyzer.getImageSize(targetImage);

        if (baseSize.width !== targetSize.width || baseSize.height !== targetSize.height) {
          issues.push({
            device: group.device,
            page: group.page,
            language: screenshot.language,
            filename: screenshot.filename,
            issue_type: 'size_mismatch',
            severity: 'warning',
            message: `DPR/尺寸不一致`,
            details: `基准图: ${baseSize.width}x${baseSize.height}, 当前图: ${targetSize.width}x${targetSize.height}`
          });
        }

        for (const textRegion of this.rules.text_regions) {
          if (textRegion.device && textRegion.device !== group.device) continue;
          if (textRegion.page && textRegion.page !== group.page) continue;

          const expansionResult = ImageAnalyzer.detectTextExpansion(
            baseImage, targetImage, textRegion
          );

          if (expansionResult && expansionResult.expanded) {
            issues.push({
              device: group.device,
              page: group.page,
              language: screenshot.language,
              filename: screenshot.filename,
              issue_type: 'text_expansion',
              severity: 'warning',
              message: `文字区域可能扩展`,
              details: `区域: (${textRegion.x},${textRegion.y})-${textRegion.width}x${textRegion.height}, 亮度差异: ${expansionResult.brightnessDiff.toFixed(2)}`
            });
          }
        }

        for (const buttonRegion of this.rules.button_regions) {
          if (buttonRegion.device && buttonRegion.device !== group.device) continue;
          if (buttonRegion.page && buttonRegion.page !== group.page) continue;

          for (const textRegion of this.rules.text_regions) {
            if (textRegion.device && textRegion.device !== group.device) continue;
            if (textRegion.page && textRegion.page !== group.page) continue;

            if (ImageAnalyzer.checkOverlap(textRegion, buttonRegion)) {
              issues.push({
                device: group.device,
                page: group.page,
                language: screenshot.language,
                filename: screenshot.filename,
                issue_type: 'button_occlusion',
                severity: 'error',
                message: `文字可能遮挡按钮`,
                details: `文字区域: (${textRegion.x},${textRegion.y})-${textRegion.width}x${textRegion.height}, 按钮区域: (${buttonRegion.x},${buttonRegion.y})-${buttonRegion.width}x${buttonRegion.height}`
              });
            }
          }
        }
      }

      const safeArea = this.rules.safe_areas[group.device];
      if (safeArea) {
        const targetSize = ImageAnalyzer.getImageSize(targetImage);

        for (const textRegion of this.rules.text_regions) {
          if (textRegion.device && textRegion.device !== group.device) continue;
          if (textRegion.page && textRegion.page !== group.page) continue;

          const topSafe = safeArea.top || 0;
          const bottomSafe = safeArea.bottom || 0;
          const leftSafe = safeArea.left || 0;
          const rightSafe = safeArea.right || 0;

          const textBottom = textRegion.y + textRegion.height;
          const textRight = textRegion.x + textRegion.width;

          const safeViolations = [];
          if (textRegion.y < topSafe) safeViolations.push('顶部安全区');
          if (textBottom > targetSize.height - bottomSafe) safeViolations.push('底部安全区');
          if (textRegion.x < leftSafe) safeViolations.push('左侧安全区');
          if (textRight > targetSize.width - rightSafe) safeViolations.push('右侧安全区');

          if (safeViolations.length > 0) {
            issues.push({
              device: group.device,
              page: group.page,
              language: screenshot.language,
              filename: screenshot.filename,
              issue_type: 'safe_area_violation',
              severity: 'warning',
              message: `文字区域超出${safeViolations.join('、')}`,
              details: `区域: (${textRegion.x},${textRegion.y})-${textRegion.width}x${textRegion.height}, 安全区: top=${topSafe}, bottom=${bottomSafe}, left=${leftSafe}, right=${rightSafe}`
            });
          }
        }
      }

      for (const truncationCheck of this.rules.truncation_checks) {
        if (truncationCheck.device && truncationCheck.device !== group.device) continue;
        if (truncationCheck.page && truncationCheck.page !== group.page) continue;

        const targetSize = ImageAnalyzer.getImageSize(targetImage);
        const region = truncationCheck.region;

        if (region.x + region.width > targetSize.width * 0.95) {
          issues.push({
            device: group.device,
            page: group.page,
            language: screenshot.language,
            filename: screenshot.filename,
            issue_type: 'truncation_risk',
            severity: 'warning',
            message: `存在截断风险`,
            details: `区域: (${region.x},${region.y})-${region.width}x${region.height}, 距离右边缘: ${targetSize.width - (region.x + region.width)}px`
          });
        }
      }
    }

    return issues;
  }
}