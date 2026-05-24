package com.factory.gauge.service;

import com.factory.gauge.entity.*;
import com.factory.gauge.repository.*;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ExportService {

    private final MeasuringToolRepository measuringToolRepository;
    private final ProductBatchRepository productBatchRepository;
    private final ReinspectionRecordRepository reinspectionRecordRepository;
    private final DeactivationRecordRepository deactivationRecordRepository;
    private final CalibrationReportRepository calibrationReportRepository;

    public byte[] exportGauges() throws IOException {
        List<MeasuringTool> gauges = measuringToolRepository.findAll();
        
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("量具清单");
            
            String[] headers = {"量具编号", "量具名称", "规格型号", "校准证书", "版本", "校准日期", "有效期至", "状态", "备注"};
            createHeaderRow(sheet, headers);
            
            int rowNum = 1;
            for (MeasuringTool gauge : gauges) {
                Row row = sheet.createRow(rowNum++);
                row.createCell(0).setCellValue(gauge.getToolNo());
                row.createCell(1).setCellValue(gauge.getToolName());
                row.createCell(2).setCellValue(gauge.getSpecification() != null ? gauge.getSpecification() : "");
                row.createCell(3).setCellValue(gauge.getCalibrationCertificateNo());
                row.createCell(4).setCellValue(gauge.getCertificateVersion());
                row.createCell(5).setCellValue(gauge.getCalibrationDate().toString());
                row.createCell(6).setCellValue(gauge.getValidUntilDate().toString());
                row.createCell(7).setCellValue(gauge.getStatus().getDisplayName());
                row.createCell(8).setCellValue(gauge.getRemarks() != null ? gauge.getRemarks() : "");
            }
            
            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }
            
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            return out.toByteArray();
        }
    }

    public byte[] exportBatchesByToolNo(String toolNo) throws IOException {
        List<ProductBatch> batches = productBatchRepository.findByToolNo(toolNo);
        
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("批次记录");
            
            String[] headers = {"批次号", "产品名称", "数量", "生产线", "状态", "锁定原因", "创建时间", "备注"};
            createHeaderRow(sheet, headers);
            
            int rowNum = 1;
            for (ProductBatch batch : batches) {
                Row row = sheet.createRow(rowNum++);
                row.createCell(0).setCellValue(batch.getBatchNo());
                row.createCell(1).setCellValue(batch.getProductName());
                row.createCell(2).setCellValue(batch.getQuantity());
                row.createCell(3).setCellValue(batch.getProductionLine() != null ? batch.getProductionLine() : "");
                row.createCell(4).setCellValue(batch.getStatus().getDisplayName());
                row.createCell(5).setCellValue(batch.getLockReason() != null ? batch.getLockReason() : "");
                row.createCell(6).setCellValue(batch.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
                row.createCell(7).setCellValue(batch.getRemarks() != null ? batch.getRemarks() : "");
            }
            
            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }
            
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            return out.toByteArray();
        }
    }

    public byte[] exportReinspectionRecords(String toolNo) throws IOException {
        List<ReinspectionRecord> records;
        if (toolNo != null && !toolNo.isEmpty()) {
            records = reinspectionRecordRepository.findByToolNo(toolNo);
        } else {
            records = reinspectionRecordRepository.findAll();
        }
        
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("复检记录");
            
            String[] headers = {"批次号", "量具编号", "复检结果", "检验员", "复检详情", "缺陷描述", "是否修正", "修正人", "创建时间"};
            createHeaderRow(sheet, headers);
            
            int rowNum = 1;
            for (ReinspectionRecord record : records) {
                Row row = sheet.createRow(rowNum++);
                row.createCell(0).setCellValue(record.getBatchNo());
                row.createCell(1).setCellValue(record.getToolNo());
                row.createCell(2).setCellValue(record.getResult().getDisplayName());
                row.createCell(3).setCellValue(record.getInspector());
                row.createCell(4).setCellValue(record.getInspectionDetail() != null ? record.getInspectionDetail() : "");
                row.createCell(5).setCellValue(record.getDefectDescription() != null ? record.getDefectDescription() : "");
                row.createCell(6).setCellValue(record.getIsCorrected() ? "是" : "否");
                row.createCell(7).setCellValue(record.getCorrectedBy() != null ? record.getCorrectedBy() : "");
                row.createCell(8).setCellValue(record.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
            }
            
            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }
            
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            return out.toByteArray();
        }
    }

    public byte[] exportFullTraceability(String toolNo) throws IOException {
        try (Workbook workbook = new XSSFWorkbook()) {
            exportGaugesSheet(workbook, toolNo);
            exportBatchesSheet(workbook, toolNo);
            exportReinspectionsSheet(workbook, toolNo);
            exportDeactivationsSheet(workbook, toolNo);
            exportCalibrationReportsSheet(workbook, toolNo);
            
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            return out.toByteArray();
        }
    }

    private void exportGaugesSheet(Workbook workbook, String toolNo) {
        List<MeasuringTool> gauges;
        if (toolNo != null && !toolNo.isEmpty()) {
            gauges = measuringToolRepository.findByToolNo(toolNo).map(List::of).orElse(List.of());
        } else {
            gauges = measuringToolRepository.findAll();
        }
        
        Sheet sheet = workbook.createSheet("1.量具信息");
        String[] headers = {"量具编号", "量具名称", "状态", "校准证书", "版本", "有效期至"};
        createHeaderRow(sheet, headers);
        
        int rowNum = 1;
        for (MeasuringTool gauge : gauges) {
            Row row = sheet.createRow(rowNum++);
            row.createCell(0).setCellValue(gauge.getToolNo());
            row.createCell(1).setCellValue(gauge.getToolName());
            row.createCell(2).setCellValue(gauge.getStatus().getDisplayName());
            row.createCell(3).setCellValue(gauge.getCalibrationCertificateNo());
            row.createCell(4).setCellValue(gauge.getCertificateVersion());
            row.createCell(5).setCellValue(gauge.getValidUntilDate().toString());
        }
        
        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
        }
    }

    private void exportBatchesSheet(Workbook workbook, String toolNo) {
        List<ProductBatch> batches;
        if (toolNo != null && !toolNo.isEmpty()) {
            batches = productBatchRepository.findByToolNo(toolNo);
        } else {
            batches = productBatchRepository.findAll();
        }
        
        Sheet sheet = workbook.createSheet("2.批次记录");
        String[] headers = {"批次号", "产品名称", "量具编号", "数量", "状态", "创建时间"};
        createHeaderRow(sheet, headers);
        
        int rowNum = 1;
        for (ProductBatch batch : batches) {
            Row row = sheet.createRow(rowNum++);
            row.createCell(0).setCellValue(batch.getBatchNo());
            row.createCell(1).setCellValue(batch.getProductName());
            row.createCell(2).setCellValue(batch.getToolNo());
            row.createCell(3).setCellValue(batch.getQuantity());
            row.createCell(4).setCellValue(batch.getStatus().getDisplayName());
            row.createCell(5).setCellValue(batch.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        }
        
        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
        }
    }

    private void exportReinspectionsSheet(Workbook workbook, String toolNo) {
        List<ReinspectionRecord> records;
        if (toolNo != null && !toolNo.isEmpty()) {
            records = reinspectionRecordRepository.findByToolNo(toolNo);
        } else {
            records = reinspectionRecordRepository.findAll();
        }
        
        Sheet sheet = workbook.createSheet("3.复检记录");
        String[] headers = {"批次号", "量具编号", "复检结果", "检验员", "是否修正", "创建时间"};
        createHeaderRow(sheet, headers);
        
        int rowNum = 1;
        for (ReinspectionRecord record : records) {
            Row row = sheet.createRow(rowNum++);
            row.createCell(0).setCellValue(record.getBatchNo());
            row.createCell(1).setCellValue(record.getToolNo());
            row.createCell(2).setCellValue(record.getResult().getDisplayName());
            row.createCell(3).setCellValue(record.getInspector());
            row.createCell(4).setCellValue(record.getIsCorrected() ? "是" : "否");
            row.createCell(5).setCellValue(record.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        }
        
        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
        }
    }

    private void exportDeactivationsSheet(Workbook workbook, String toolNo) {
        List<DeactivationRecord> records;
        if (toolNo != null && !toolNo.isEmpty()) {
            records = deactivationRecordRepository.findByToolNo(toolNo);
        } else {
            records = deactivationRecordRepository.findAll();
        }
        
        Sheet sheet = workbook.createSheet("4.停用记录");
        String[] headers = {"量具编号", "停用原因", "操作人", "停用时间", "是否生效"};
        createHeaderRow(sheet, headers);
        
        int rowNum = 1;
        for (DeactivationRecord record : records) {
            Row row = sheet.createRow(rowNum++);
            row.createCell(0).setCellValue(record.getToolNo());
            row.createCell(1).setCellValue(record.getReason());
            row.createCell(2).setCellValue(record.getOperator());
            row.createCell(3).setCellValue(record.getDeactivatedAt() != null ? 
                record.getDeactivatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")) : "");
            row.createCell(4).setCellValue(record.getIsActive() ? "是" : "否");
        }
        
        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
        }
    }

    private void exportCalibrationReportsSheet(Workbook workbook, String toolNo) {
        List<CalibrationReport> reports;
        if (toolNo != null && !toolNo.isEmpty()) {
            reports = calibrationReportRepository.findByToolNo(toolNo);
        } else {
            reports = calibrationReportRepository.findAll();
        }
        
        Sheet sheet = workbook.createSheet("5.校准报告");
        String[] headers = {"量具编号", "证书编号", "版本", "校准日期", "有效期至", "校准机构"};
        createHeaderRow(sheet, headers);
        
        int rowNum = 1;
        for (CalibrationReport report : reports) {
            Row row = sheet.createRow(rowNum++);
            row.createCell(0).setCellValue(report.getToolNo());
            row.createCell(1).setCellValue(report.getCertificateNo());
            row.createCell(2).setCellValue(report.getVersion());
            row.createCell(3).setCellValue(report.getCalibrationDate().toString());
            row.createCell(4).setCellValue(report.getValidUntilDate().toString());
            row.createCell(5).setCellValue(report.getCalibrationAgency() != null ? report.getCalibrationAgency() : "");
        }
        
        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
        }
    }

    private void createHeaderRow(Sheet sheet, String[] headers) {
        Row headerRow = sheet.createRow(0);
        CellStyle headerStyle = sheet.getWorkbook().createCellStyle();
        Font font = sheet.getWorkbook().createFont();
        font.setBold(true);
        headerStyle.setFont(font);
        headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }
    }

    public String generateExportFileName(String prefix) {
        return prefix + "_" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")) + ".xlsx";
    }
}
