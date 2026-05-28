import { useCallback } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useArtworkStore } from '../store/useArtworkStore';
import { useFilterStore } from '../store/useFilterStore';
import { CLASSES } from '../data/artworks';
import { hslToCssString } from '../utils/hslCalculator';

interface ReportOptions {
  includeImages?: boolean;
  includeAlerts?: boolean;
  includeStatistics?: boolean;
  title?: string;
}

export function useReportExport() {
  const artworks = useArtworkStore(state => state.artworks);
  const selectedArtwork = useArtworkStore(state => state.getSelectedArtwork());
  const qualityAlerts = useArtworkStore(state => state.qualityAlerts);
  const filterState = useFilterStore();

  const generateStatistics = useCallback(() => {
    const classStats = CLASSES.map(cls => {
      const classArtworks = artworks.filter(a => a.classId === cls.id);
      const validArtworks = classArtworks.filter(a => 
        a.hue !== null && a.lightness !== null && a.saturation !== null
      );
      
      if (validArtworks.length === 0) return null;

      const avgHue = validArtworks.reduce((sum, a) => sum + (a.hue || 0), 0) / validArtworks.length;
      const avgLightness = validArtworks.reduce((sum, a) => sum + (a.lightness || 0), 0) / validArtworks.length;
      const avgSaturation = validArtworks.reduce((sum, a) => sum + (a.saturation || 0), 0) / validArtworks.length;
      const avgScore = validArtworks.reduce((sum, a) => sum + a.score, 0) / validArtworks.length;

      return {
        className: cls.name,
        count: classArtworks.length,
        validCount: validArtworks.length,
        avgHue: avgHue.toFixed(1),
        avgLightness: avgLightness.toFixed(1),
        avgSaturation: avgSaturation.toFixed(1),
        avgScore: avgScore.toFixed(1),
        avgColor: hslToCssString(avgHue, avgSaturation, avgLightness)
      };
    }).filter(Boolean);

    const alertStats = {
      total: qualityAlerts.length,
      transparentBg: qualityAlerts.filter(a => a.alertType === 'transparent_bg').length,
      extremeColor: qualityAlerts.filter(a => a.alertType === 'extreme_color').length,
      missingData: qualityAlerts.filter(a => a.alertType === 'missing_data').length,
      versionConflict: qualityAlerts.filter(a => a.alertType === 'version_conflict').length
    };

    return { classStats, alertStats };
  }, [artworks, qualityAlerts]);

  const exportAsJSON = useCallback(() => {
    const { classStats, alertStats } = generateStatistics();
    const report = {
      title: '美术色彩空间星图分析报告',
      generatedAt: new Date().toISOString(),
      filters: {
        selectedClasses: filterState.selectedClassIds.map(id => 
          CLASSES.find(c => c.id === id)?.name || id
        ),
        hueRange: filterState.hueRange,
        lightnessRange: filterState.lightnessRange,
        saturationRange: filterState.saturationRange
      },
      statistics: {
        totalArtworks: artworks.length,
        classStats,
        alertStats
      },
      selectedArtwork: selectedArtwork ? {
        title: selectedArtwork.title,
        className: selectedArtwork.className,
        hue: selectedArtwork.hue,
        lightness: selectedArtwork.lightness,
        saturation: selectedArtwork.saturation,
        score: selectedArtwork.score,
        alerts: qualityAlerts.filter(a => a.artworkId === selectedArtwork.id)
      } : null,
      artworks: artworks.map(a => ({
        id: a.id,
        title: a.title,
        className: a.className,
        hue: a.hue,
        lightness: a.lightness,
        saturation: a.saturation,
        score: a.score,
        qualityFlags: a.qualityFlags
      }))
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `色彩分析报告_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [artworks, selectedArtwork, qualityAlerts, filterState, generateStatistics]);

  const exportAsPNG = useCallback(async (elementId: string, filename?: string) => {
    const element = document.getElementById(elementId);
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        backgroundColor: '#0a0e1a',
        scale: 2,
        useCORS: true,
        allowTaint: true
      });

      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `色彩空间截图_${new Date().toISOString().split('T')[0]}.png`;
      a.click();
    } catch (error) {
      console.error('Failed to export PNG:', error);
      throw error;
    }
  }, []);

  const exportAsPDF = useCallback(async (options: ReportOptions = {}) => {
    const { 
      includeImages = true, 
      includeAlerts = true, 
      includeStatistics = true,
      title = '美术色彩空间星图分析报告'
    } = options;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text(title, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    if (includeStatistics) {
      const { classStats, alertStats } = generateStatistics();

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('一、数据统计', 20, yPos);
      yPos += 10;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`作品总数: ${artworks.length}`, 25, yPos);
      yPos += 8;
      doc.text(`质量警报总数: ${alertStats.total}`, 25, yPos);
      yPos += 8;
      doc.text(`  - 透明背景误采: ${alertStats.transparentBg}`, 30, yPos);
      yPos += 8;
      doc.text(`  - 极端颜色: ${alertStats.extremeColor}`, 30, yPos);
      yPos += 8;
      doc.text(`  - 数据缺失: ${alertStats.missingData}`, 30, yPos);
      yPos += 8;
      doc.text(`  - 版本冲突: ${alertStats.versionConflict}`, 30, yPos);
      yPos += 15;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('二、班级风格对比', 20, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const tableHeaders = ['班级', '作品数', '平均色相', '平均明度', '平均饱和度', '平均分'];
      const colWidths = [35, 20, 25, 25, 30, 20];
      let xPos = 25;
      
      doc.setFont('helvetica', 'bold');
      tableHeaders.forEach((header, i) => {
        doc.text(header, xPos, yPos);
        xPos += colWidths[i];
      });
      yPos += 8;
      doc.setFont('helvetica', 'normal');

      classStats.forEach((stat, idx) => {
        if (!stat) return;
        if (yPos > pageHeight - 30) {
          doc.addPage();
          yPos = 20;
        }
        
        xPos = 25;
        doc.text(stat.className, xPos, yPos);
        xPos += colWidths[0];
        doc.text(`${stat.validCount}/${stat.count}`, xPos, yPos);
        xPos += colWidths[1];
        doc.text(`${stat.avgHue}°`, xPos, yPos);
        xPos += colWidths[2];
        doc.text(`${stat.avgLightness}%`, xPos, yPos);
        xPos += colWidths[3];
        doc.text(`${stat.avgSaturation}%`, xPos, yPos);
        xPos += colWidths[4];
        doc.text(stat.avgScore, xPos, yPos);
        yPos += 7;
      });
      yPos += 10;
    }

    if (includeAlerts && qualityAlerts.length > 0) {
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('三、质量警报详情', 20, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      const alertTypeLabels: Record<string, string> = {
        transparent_bg: '透明背景误采',
        extreme_color: '极端颜色',
        missing_data: '数据缺失',
        version_conflict: '版本冲突'
      };

      qualityAlerts.slice(0, 15).forEach((alert, idx) => {
        if (yPos > pageHeight - 30) {
          doc.addPage();
          yPos = 20;
        }
        
        const artwork = artworks.find(a => a.id === alert.artworkId);
        const severitySymbol = alert.severity === 'error' ? '❌' : alert.severity === 'warning' ? '⚠️' : 'ℹ️';
        
        doc.text(
          `${severitySymbol} ${alertTypeLabels[alert.alertType] || alert.alertType}: ${artwork?.title || alert.artworkId}`,
          25, yPos
        );
        yPos += 7;
        doc.text(`   ${alert.description}`, 30, yPos);
        yPos += 7;
      });

      if (qualityAlerts.length > 15) {
        doc.text(`... 还有 ${qualityAlerts.length - 15} 条警报`, 25, yPos);
        yPos += 7;
      }
    }

    if (includeImages && selectedArtwork) {
      if (yPos > pageHeight - 80) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('四、选中作品详情', 20, yPos);
      yPos += 10;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`作品名称: ${selectedArtwork.title}`, 25, yPos);
      yPos += 8;
      doc.text(`班级: ${selectedArtwork.className}`, 25, yPos);
      yPos += 8;
      doc.text(`色相: ${selectedArtwork.hue ?? '未知'}°`, 25, yPos);
      yPos += 8;
      doc.text(`明度: ${selectedArtwork.lightness ?? '未知'}%`, 25, yPos);
      yPos += 8;
      doc.text(`饱和度: ${selectedArtwork.saturation ?? '未知'}%`, 25, yPos);
      yPos += 8;
      doc.text(`评分: ${selectedArtwork.score}`, 25, yPos);
      yPos += 8;
      doc.text(`数据版本: ${selectedArtwork.dataVersion}`, 25, yPos);
    }

    doc.save(`色彩分析报告_${new Date().toISOString().split('T')[0]}.pdf`);
  }, [artworks, selectedArtwork, qualityAlerts, generateStatistics]);

  return {
    exportAsJSON,
    exportAsPNG,
    exportAsPDF,
    generateStatistics
  };
}
