import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { ProblemWithDetails } from '../types'
import { formatDateTime, statusLabels } from './format'

export async function exportToPDF(reportData: ProblemWithDetails[], title: string): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  let yPos = 20

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(title, pageWidth / 2, yPos, { align: 'center' })
  yPos += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(`生成时间: ${formatDateTime(new Date().toISOString())}`, pageWidth / 2, yPos, { align: 'center' })
  yPos += 10

  doc.setDrawColor(200, 200, 200)
  doc.line(20, yPos, pageWidth - 20, yPos)
  yPos += 8

  for (let i = 0; i < reportData.length; i++) {
    const problem = reportData[i]

    if (yPos > pageHeight - 40) {
      doc.addPage()
      yPos = 20
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(0, 0, 0)
    doc.text(`${i + 1}. ${problem.musicianName} - 通道${problem.channel}`, 20, yPos)
    yPos += 5

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(`声部: ${problem.section} | 状态: ${statusLabels[problem.status]} | 版本: V${problem.currentVersion}`, 20, yPos)
    yPos += 4

    doc.text(`发现时间: ${formatDateTime(problem.discoveredAt)}`, 20, yPos)
    yPos += 6

    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.text('问题描述:', 20, yPos)
    yPos += 4
    doc.setFont('helvetica', 'normal')
    const descLines = doc.splitTextToSize(problem.description, pageWidth - 40)
    doc.text(descLines, 25, yPos)
    yPos += descLines.length * 4 + 4

    if (problem.versions.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.text('调音记录:', 20, yPos)
      yPos += 4

      for (const version of [...problem.versions].reverse()) {
        if (yPos > pageHeight - 30) {
          doc.addPage()
          yPos = 20
        }

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(60, 60, 60)
        doc.text(`V${version.version} | ${version.operatorName} | ${formatDateTime(version.createdAt)}`, 25, yPos)
        yPos += 3

        if (version.tuningAction) {
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(0, 0, 0)
          doc.setFontSize(9)
          const actionLines = doc.splitTextToSize(`调音动作: ${version.tuningAction}`, pageWidth - 50)
          doc.text(actionLines, 30, yPos)
          yPos += actionLines.length * 4
        }

        if (version.changeReason) {
          doc.setFontSize(8)
          doc.setTextColor(80, 80, 80)
          const reasonLines = doc.splitTextToSize(`原因: ${version.changeReason}`, pageWidth - 50)
          doc.text(reasonLines, 30, yPos)
          yPos += reasonLines.length * 4
        }

        if (version.anomalyDetected) {
          doc.setFontSize(8)
          doc.setTextColor(239, 68, 68)
          doc.text(`⚠️ 异常: ${version.anomalyDetected.reason}`, 30, yPos)
          yPos += 4
        }

        yPos += 2
      }
    }

    if (problem.confirmation) {
      if (yPos > pageHeight - 40) {
        doc.addPage()
        yPos = 20
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(0, 0, 0)
      doc.text('签收确认:', 20, yPos)
      yPos += 4

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(60, 60, 60)

      const musStatus = problem.confirmation.musicianSigned
        ? `✓ 乐手: ${problem.confirmation.musicianSignature} (${formatDateTime(problem.confirmation.musicianSignedAt!)})`
        : '✗ 乐手: 未确认'
      doc.text(musStatus, 25, yPos)
      yPos += 3

      const engStatus = problem.confirmation.engineerSigned
        ? `✓ 音响师: ${problem.confirmation.engineerSignature} (${formatDateTime(problem.confirmation.engineerSignedAt!)})`
        : '✗ 音响师: 未确认'
      doc.text(engStatus, 25, yPos)
      yPos += 4

      if (problem.confirmation.notes) {
        doc.setTextColor(80, 80, 80)
        const noteLines = doc.splitTextToSize(`备注: ${problem.confirmation.notes}`, pageWidth - 50)
        doc.text(noteLines, 25, yPos)
        yPos += noteLines.length * 4
      }
    }

    if (problem.anomalies.length > 0) {
      if (yPos > pageHeight - 30) {
        doc.addPage()
        yPos = 20
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(239, 68, 68)
      doc.text(`异常记录 (${problem.anomalies.length}条):`, 20, yPos)
      yPos += 4

      for (const anomaly of problem.anomalies) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(239, 68, 68)
        doc.text(`• ${anomaly.reason}`, 25, yPos)
        yPos += 3
        doc.setTextColor(100, 100, 100)
        doc.text(`  影响: ${anomaly.impact}`, 25, yPos)
        yPos += 3
        doc.setTextColor(16, 185, 129)
        doc.text(`  下一步: ${anomaly.nextAction}`, 25, yPos)
        yPos += 4
      }
    }

    yPos += 4
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.1)
    doc.line(20, yPos, pageWidth - 20, yPos)
    yPos += 6
  }

  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text('--- 现场返听问题单系统 | 完整追溯报告 ---', pageWidth / 2, pageHeight - 15, { align: 'center' })

  doc.save(`返听报告_${new Date().toISOString().slice(0, 10)}.pdf`)
}

export async function exportElementToPDF(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId)
  if (!element) return

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#0f172a',
  })

  const imgData = canvas.toDataURL('image/png')
  const imgWidth = 210
  const pageHeight = 297
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  let heightLeft = imgHeight
  let position = 0

  doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
  heightLeft -= pageHeight

  while (heightLeft >= 0) {
    position = heightLeft - imgHeight
    doc.addPage()
    doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
  }

  doc.save(filename)
}
