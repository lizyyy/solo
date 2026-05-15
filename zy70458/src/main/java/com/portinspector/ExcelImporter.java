package com.portinspector;

import com.portinspector.model.InspectionSample;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

public class ExcelImporter {
    private final PortInspector inspector;

    public ExcelImporter(PortInspector inspector) {
        this.inspector = inspector;
    }

    public List<InspectionSample> loadSamplesFromExcel(String filePath) {
        List<InspectionSample> samples = new ArrayList<>();
        Path path = Paths.get(filePath);
        String batchId = generateBatchId();
        LocalDateTime inspectionTime = LocalDateTime.now();

        try (FileInputStream fis = new FileInputStream(filePath);
             Workbook workbook = new XSSFWorkbook(fis)) {

            Sheet sheet = workbook.getSheetAt(0);
            Iterator<Row> rowIterator = sheet.iterator();

            if (rowIterator.hasNext()) {
                rowIterator.next();
            }

            int rowNum = 2;
            while (rowIterator.hasNext()) {
                Row row = rowIterator.next();
                if (isEmptyRow(row)) continue;

                InspectionSample sample = new InspectionSample();
                sample.setSampleId(generateSampleId());
                sample.setBatchId(batchId);
                sample.setSourceFile(path.getFileName().toString());
                sample.setRowNumber(rowNum);
                sample.setInspectionTime(inspectionTime);

                sample.setIpAddress(getCellValueAsString(row, 0));
                sample.setPort((int) getCellValueAsDouble(row, 1));
                sample.setProtocol(getCellValueAsString(row, 2));
                sample.setProcessName(getCellValueAsString(row, 3));
                sample.setConnectionCount((int) getCellValueAsDouble(row, 4));

                String supplierOriginal = getCellValueAsString(row, 5);
                sample.setSupplierOriginal(supplierOriginal);
                String supplierCorrected = correctSupplier(supplierOriginal);
                sample.setSupplierCorrected(supplierCorrected);
                sample.setSupplier(supplierCorrected != null ? supplierCorrected : supplierOriginal);

                sample.setDepartment(getCellValueAsString(row, 6));
                sample.setBusinessLine(getCellValueAsString(row, 7));

                sample.setRawData(new HashMap<>());
                for (int i = 0; i < 8; i++) {
                    sample.getRawData().put("col" + i, getCellValueAsString(row, i));
                }

                samples.add(sample);
                rowNum++;
            }
        } catch (IOException e) {
            throw new RuntimeException("读取Excel文件失败", e);
        }

        return samples;
    }

    private String generateBatchId() {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String uuid = UUID.randomUUID().toString().substring(0, 6);
        return "batch_" + timestamp + "_" + uuid;
    }

    private String generateSampleId() {
        return "sample_" + UUID.randomUUID().toString().substring(0, 12);
    }

    private String correctSupplier(String supplier) {
        Map<String, String> corrections = new HashMap<>();
        corrections.put("阿里", "阿里巴巴");
        corrections.put("阿里云计算", "阿里巴巴");
        corrections.put("腾讯", "腾讯科技");
        corrections.put("腾讯云", "腾讯科技");
        corrections.put("百度", "百度在线");
        corrections.put("百度云", "百度在线");
        return corrections.getOrDefault(supplier, null);
    }

    private String getCellValueAsString(Row row, int cellIndex) {
        Cell cell = row.getCell(cellIndex);
        if (cell == null) return "";
        switch (cell.getCellType()) {
            case STRING: return cell.getStringCellValue();
            case NUMERIC: return String.valueOf((int) cell.getNumericCellValue());
            case BOOLEAN: return String.valueOf(cell.getBooleanCellValue());
            default: return "";
        }
    }

    private double getCellValueAsDouble(Row row, int cellIndex) {
        Cell cell = row.getCell(cellIndex);
        if (cell == null) return 0;
        if (cell.getCellType() == CellType.NUMERIC) {
            return cell.getNumericCellValue();
        }
        try {
            return Double.parseDouble(cell.getStringCellValue());
        } catch (Exception e) {
            return 0;
        }
    }

    private boolean isEmptyRow(Row row) {
        for (int i = 0; i < 8; i++) {
            Cell cell = row.getCell(i);
            if (cell != null && !cell.getStringCellValue().trim().isEmpty()) {
                return false;
            }
        }
        return true;
    }
}
