import jsPDF from 'jspdf';
import { useStore } from '../store/useStore';

export function exportPDFReport() {
  const state = useStore.getState();
  const { yard, containers, currentTask, selectedContainerId } = state;

  if (!yard) {
    alert('没有数据可导出');
    return;
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('港口箱堆可达性分析报告', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('一、堆场概况', 20, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`堆场名称: ${yard.name}`, 25, yPos);
  yPos += 7;
  doc.text(`箱区数量: ${yard.bays}`, 25, yPos);
  yPos += 7;
  doc.text(`每箱区行数: ${yard.rows}`, 25, yPos);
  yPos += 7;
  doc.text(`最大层数: ${yard.maxTiers}`, 25, yPos);
  yPos += 7;
  doc.text(`集装箱总数: ${containers.length}`, 25, yPos);
  yPos += 15;

  if (currentTask && selectedContainerId) {
    const targetContainer = containers.find((c) => c.id === selectedContainerId);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('二、取箱任务分析', 20, yPos);
    yPos += 10;

    if (targetContainer) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('目标集装箱:', 25, yPos);
      yPos += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.text(`箱号: ${targetContainer.id}`, 30, yPos);
      yPos += 7;
      doc.text(`位置: ${targetContainer.bay + 1}区 ${targetContainer.row + 1}行 ${targetContainer.tier + 1}层`, 30, yPos);
      yPos += 7;
      doc.text(`尺寸: ${targetContainer.size}`, 30, yPos);
      yPos += 7;
      doc.text(`重量: ${targetContainer.weight} 吨`, 30, yPos);
      yPos += 12;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('可达性分析结果:', 25, yPos);
    yPos += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`遮挡层数: ${currentTask.totalRelocations} 层`, 30, yPos);
    yPos += 7;
    doc.text(`最优取箱侧: ${currentTask.optimalSide === 'left' ? '左侧' : '右侧'}`, 30, yPos);
    yPos += 7;
    doc.text(`总操作步数: ${currentTask.moves.length} 步`, 30, yPos);
    yPos += 7;
    doc.text(`倒箱数量: ${currentTask.totalRelocations} 个`, 30, yPos);
    yPos += 15;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('作业步骤列表:', 25, yPos);
    yPos += 8;

    currentTask.moves.forEach((move, index) => {
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const moveType = move.type === 'retrieval' ? '取箱' : '倒箱';
      const fromPos = `${move.from.bay + 1}区${move.from.row + 1}行${move.from.tier + 1}层`;
      const toPos = move.to
        ? `${move.to.bay + 1}区${move.to.row + 1}行${move.to.tier + 1}层`
        : '移出堆场';

      doc.text(
        `${move.step}. [${moveType}] ${move.containerId}: ${fromPos} → ${toPos}`,
        30,
        yPos
      );
      yPos += 6;
    });
  }

  yPos += 10;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.text('本报告由港口箱堆可达性分析系统自动生成', pageWidth / 2, pageHeight - 20, {
    align: 'center',
  });

  doc.save(`yard-analysis-report-${Date.now()}.pdf`);
}
