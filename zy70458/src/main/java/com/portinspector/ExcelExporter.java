package com.portinspector;

import com.portinspector.model.InspectionResult;
import com.portinspector.model.InspectionSample;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

public class ExcelExporter {
    private final DataStorage storage;

    public ExcelExporter(DataStorage storage) {
        this.storage = storage;
    }

    public String exportAnomalies(String batchId, String outputPath, String riskFilter) {
        List<InspectionResult> results = storage.getResultsByBatch(batchId);

        if (riskFilter != null && !riskFilter.isEmpty()) {
            results.removeIf(r -> !r.getRiskLevel().getValue().equalsIgnoreCase(riskFilter));
        }

        results.removeIf(r -> !r.isAnomaly());

        if (results.isEmpty()) {
            throw new IllegalArgumentException("批次没有异常样本: " + batchId);
        }

        return exportResults(results, outputPath, "anomalies_" + batchId);
    }

    public String exportFullReport(String batchId, String outputPath) {
        List<InspectionResult> results = storage.getResultsByBatch(batchId);
        return exportResults(results, outputPath, "report_" + batchId);
    }

    public String exportByRiskLevel(String riskLevel, String outputPath) {
        List<InspectionResult> results = storage.getAnomaliesByRisk(riskLevel);
        if (results.isEmpty()) {
            throw new IllegalArgumentException("没有找到风险等级为 " + riskLevel + " 的异常样本");
        }
        return exportResults(results, outputPath, "risk_" + riskLevel);
    }

    private String exportResults(List<InspectionResult> results, String outputPath, String defaultPrefix) {
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("巡检结果");

            String[] columns = {
                    "样本ID", "批次ID", "源文件", "IP地址", "端口", "协议", "进程名", "连接数",
                    "供应商(原始)", "供应商(修正)", "部门", "业务线", "规则版本", "风险等级",
                    "是否异常", "结论", "端口状态", "样本状态", "原始样本ID", "原始批次ID",
                    "是否复核", "复核人", "复核时间", "复核备注"
            };

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < columns.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(columns[i]);
            }

            int rowNum = 1;
            for (InspectionResult result : results) {
                InspectionSample sample = storage.getSample(result.getSampleId()).orElse(null);
                if (sample == null) continue;

                Row row = sheet.createRow(rowNum++);
                row.createCell(0).setCellValue(sample.getSampleId());
                row.createCell(1).setCellValue(sample.getBatchId());
                row.createCell(2).setCellValue(sample.getSourceFile());
                row.createCell(3).setCellValue(sample.getIpAddress());
                row.createCell(4).setCellValue(sample.getPort());
                row.createCell(5).setCellValue(sample.getProtocol());
                row.createCell(6).setCellValue(sample.getProcessName());
                row.createCell(7).setCellValue(sample.getConnectionCount());
                row.createCell(8).setCellValue(sample.getSupplierOriginal());
                row.createCell(9).setCellValue(sample.getSupplierCorrected() != null ? sample.getSupplierCorrected() : "");
                row.createCell(10).setCellValue(sample.getDepartment());
                row.createCell(11).setCellValue(sample.getBusinessLine());
                row.createCell(12).setCellValue(result.getRuleVersion());
                row.createCell(13).setCellValue(result.getRiskLevel().getValue());
                row.createCell(14).setCellValue(result.isAnomaly() ? "是" : "否");
                row.createCell(15).setCellValue(result.getConclusion());
                row.createCell(16).setCellValue(result.getPortStatus());

                String status = "正常";
                if (result.isReused()) status = "复用";
                else if (result.getConflictInfo() != null) status = "冲突";
                row.createCell(17).setCellValue(status);

                row.createCell(18).setCellValue(result.getOriginalSampleId() != null ? result.getOriginalSampleId() : "");
                row.createCell(19).setCellValue(result.getOriginalBatchId() != null ? result.getOriginalBatchId() : "");
                row.createCell(20).setCellValue(result.isReviewed() ? "是" : "否");
                row.createCell(21).setCellValue(result.getReviewer() != null ? result.getReviewer() : "");
                row.createCell(22).setCellValue(result.getReviewTime() != null ? result.getReviewTime().toString() : "");
                row.createCell(23).setCellValue(result.getReviewNotes() != null ? result.getReviewNotes() : "");
            }

            for (int i = 0; i < columns.length; i++) {
                sheet.autoSizeColumn(i);
            }

            String outputFile;
            if (outputPath != null && !outputPath.isEmpty()) {
                outputFile = outputPath;
            } else {
                String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
                outputFile = storage.getExportsDir().resolve(defaultPrefix + "_" + timestamp + ".xlsx").toString();
            }

            try (FileOutputStream fos = new FileOutputStream(outputFile)) {
                workbook.write(fos);
            }

            return outputFile;
        } catch (IOException e) {
            throw new RuntimeException("导出Excel失败", e);
        }
    }
}
