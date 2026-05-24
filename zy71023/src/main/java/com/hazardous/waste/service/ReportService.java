package com.hazardous.waste.service;

import com.hazardous.waste.entity.DisposalReport;
import com.hazardous.waste.entity.WasteRecord;
import com.hazardous.waste.enums.ErrorCode;
import com.hazardous.waste.enums.WasteStatus;
import com.hazardous.waste.exception.BusinessException;
import com.hazardous.waste.repository.DisposalReportRepository;
import com.hazardous.waste.repository.WasteRecordRepository;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
public class ReportService {

    private final DisposalReportRepository disposalReportRepository;
    private final WasteRecordRepository wasteRecordRepository;

    public ReportService(DisposalReportRepository disposalReportRepository,
                         WasteRecordRepository wasteRecordRepository) {
        this.disposalReportRepository = disposalReportRepository;
        this.wasteRecordRepository = wasteRecordRepository;
    }

    @Transactional
    public DisposalReport generateDisposalReport(String transferFormNo, String operator) {
        List<WasteRecord> records = wasteRecordRepository.findByTransferFormNo(transferFormNo);
        if (records.isEmpty()) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "该转运单下无危废记录");
        }

        String category = records.get(0).getCategory();
        double totalWeight = records.stream().mapToDouble(WasteRecord::getWeight).sum();

        DisposalReport report = new DisposalReport();
        report.setReportNo(generateReportNo());
        report.setCategory(category);
        report.setTotalWeight(totalWeight);
        report.setWasteCount(records.size());
        report.setTransferFormNo(transferFormNo);
        report.setReporter(operator);
        report.setDisposalTime(LocalDateTime.now());

        StringBuilder checkDetail = new StringBuilder();
        StringBuilder disposalReason = new StringBuilder();

        for (WasteRecord record : records) {
            checkDetail.append(String.format("记录[%s]: 类别=%s, 重量=%.2fkg, 状态=%s, 暂存天数=%d天; ",
                    record.getRecordNo(), record.getCategory(), record.getWeight(),
                    record.getStatus(), record.getStorageDays()));
            if (record.getDisposalReason() != null && !record.getDisposalReason().isBlank()) {
                disposalReason.append(record.getRecordNo()).append(": ").append(record.getDisposalReason()).append("; ");
            }
        }

        report.setCheckDetail(checkDetail.toString());
        report.setDisposalReason(disposalReason.toString());
        report.setDisposalResult("待确认");

        return disposalReportRepository.save(report);
    }

    @Transactional
    public DisposalReport approveReport(String reportNo, String approver, Boolean approved, String remark) {
        DisposalReport report = disposalReportRepository.findByReportNo(reportNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "报告不存在: " + reportNo));

        report.setApprover(approver);
        report.setApproveTime(LocalDateTime.now());
        report.setIsApproved(approved);
        if (remark != null) {
            report.setRemark(remark);
        }

        if (approved) {
            List<WasteRecord> records = wasteRecordRepository.findByTransferFormNo(report.getTransferFormNo());
            for (WasteRecord record : records) {
                if (record.getStatus() == WasteStatus.TRANSFERRED) {
                    record.setStatus(WasteStatus.DISPOSED);
                    record.getOperationLogs().add(new WasteRecord.OperationLog(
                            "处置完成",
                            approver,
                            "报告审批通过，处置完成"
                    ));
                    wasteRecordRepository.save(record);
                }
            }
        }

        return disposalReportRepository.save(report);
    }

    public byte[] exportWasteRecordsToExcel(List<WasteRecord> records) throws IOException {
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("危废记录");

            Row headerRow = sheet.createRow(0);
            String[] headers = {"记录编号", "危废类别", "危废名称", "重量(kg)", "暂存桶",
                    "入库时间", "状态", "转运单号", "签收人", "暂存天数", "处置原因", "核对结果"};

            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
            int rowNum = 1;
            for (WasteRecord record : records) {
                Row row = sheet.createRow(rowNum++);
                row.createCell(0).setCellValue(record.getRecordNo());
                row.createCell(1).setCellValue(record.getCategory());
                row.createCell(2).setCellValue(record.getWasteName());
                row.createCell(3).setCellValue(record.getWeight());
                row.createCell(4).setCellValue(record.getBucket() != null ? record.getBucket().getBucketCode() : "");
                row.createCell(5).setCellValue(record.getInTime() != null ? record.getInTime().format(formatter) : "");
                row.createCell(6).setCellValue(record.getStatus().name());
                row.createCell(7).setCellValue(record.getTransferFormNo() != null ? record.getTransferFormNo() : "");
                row.createCell(8).setCellValue(record.getReceiver() != null ? record.getReceiver() : "");
                row.createCell(9).setCellValue(record.getStorageDays() != null ? record.getStorageDays() : 0);
                row.createCell(10).setCellValue(record.getDisposalReason() != null ? record.getDisposalReason() : "");
                row.createCell(11).setCellValue(record.getCheckResult() != null ? record.getCheckResult() : "");
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            workbook.write(outputStream);
            return outputStream.toByteArray();
        }
    }

    public byte[] exportDisposalReportToExcel(DisposalReport report) throws IOException {
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("处置报告");

            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

            createInfoRow(sheet, 0, "报告编号", report.getReportNo());
            createInfoRow(sheet, 1, "危废类别", report.getCategory());
            createInfoRow(sheet, 2, "总重量(kg)", String.format("%.2f", report.getTotalWeight()));
            createInfoRow(sheet, 3, "危废数量", report.getWasteCount() + " 条");
            createInfoRow(sheet, 4, "转运单号", report.getTransferFormNo() != null ? report.getTransferFormNo() : "");
            createInfoRow(sheet, 5, "报告人", report.getReporter() != null ? report.getReporter() : "");
            createInfoRow(sheet, 6, "生成时间", report.getCreatedAt().format(formatter));
            createInfoRow(sheet, 7, "审批人", report.getApprover() != null ? report.getApprover() : "");
            createInfoRow(sheet, 8, "审批状态", report.getIsApproved() ? "已批准" : "待审批");
            createInfoRow(sheet, 9, "核对明细", report.getCheckDetail() != null ? report.getCheckDetail() : "");
            createInfoRow(sheet, 10, "处置原因", report.getDisposalReason() != null ? report.getDisposalReason() : "");

            sheet.autoSizeColumn(0);
            sheet.autoSizeColumn(1);

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            workbook.write(outputStream);
            return outputStream.toByteArray();
        }
    }

    private void createInfoRow(Sheet sheet, int rowNum, String label, String value) {
        Row row = sheet.createRow(rowNum);
        row.createCell(0).setCellValue(label);
        row.createCell(1).setCellValue(value);
    }

    public List<DisposalReport> getAllReports() {
        return disposalReportRepository.findAll();
    }

    public DisposalReport getReportByNo(String reportNo) {
        return disposalReportRepository.findByReportNo(reportNo)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "报告不存在: " + reportNo));
    }

    private String generateReportNo() {
        String date = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String uuid = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        return "RP" + date + uuid;
    }
}
