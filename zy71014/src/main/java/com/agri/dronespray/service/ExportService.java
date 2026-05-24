package com.agri.dronespray.service;

import com.agri.dronespray.entity.*;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class ExportService {

    private static final DateTimeFormatter DATETIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public byte[] exportPermissionToExcel(Permission permission) throws IOException {
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("许可详情");

            CellStyle headerStyle = createHeaderStyle(workbook);
            CellStyle dataStyle = createDataStyle(workbook);

            int rowNum = 0;

            rowNum = createPermissionHeader(sheet, rowNum, headerStyle, dataStyle, permission);

            rowNum += 2;
            rowNum = createPermissionItems(sheet, rowNum, headerStyle, dataStyle, permission.getItems());

            rowNum += 2;
            rowNum = createCheckRecords(sheet, rowNum, headerStyle, dataStyle, permission.getCheckRecords());

            rowNum += 2;
            createProcessingRecords(sheet, rowNum, headerStyle, dataStyle, permission.getProcessingRecords());

            for (int i = 0; i < 8; i++) {
                sheet.autoSizeColumn(i);
            }

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            workbook.write(outputStream);
            return outputStream.toByteArray();
        }
    }

    public byte[] exportPermissionListToExcel(List<Permission> permissions) throws IOException {
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("许可列表");

            CellStyle headerStyle = createHeaderStyle(workbook);
            CellStyle dataStyle = createDataStyle(workbook);

            String[] headers = {"许可编号", "状态", "作业类型", "计划开始时间", "计划结束时间",
                    "飞手", "无人机", "最终结论", "创建人", "创建时间"};

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            int rowNum = 1;
            for (Permission permission : permissions) {
                Row row = sheet.createRow(rowNum++);
                row.createCell(0).setCellValue(permission.getPermissionNo());
                row.createCell(1).setCellValue(permission.getStatus().getDisplayName());
                row.createCell(2).setCellValue(permission.getOperationType() != null ? permission.getOperationType() : "");
                row.createCell(3).setCellValue(permission.getPlannedStartTime() != null ?
                        permission.getPlannedStartTime().format(DATETIME_FORMATTER) : "");
                row.createCell(4).setCellValue(permission.getPlannedEndTime() != null ?
                        permission.getPlannedEndTime().format(DATETIME_FORMATTER) : "");
                row.createCell(5).setCellValue(permission.getPilot() != null ? permission.getPilot().getPilotName() : "");
                row.createCell(6).setCellValue(permission.getDrone() != null ? permission.getDrone().getDroneCode() : "");
                row.createCell(7).setCellValue(permission.getFinalConclusion() != null ? permission.getFinalConclusion() : "");
                row.createCell(8).setCellValue(permission.getCreatedBy());
                row.createCell(9).setCellValue(permission.getCreatedAt().format(DATETIME_FORMATTER));

                for (int i = 0; i < headers.length; i++) {
                    row.getCell(i).setCellStyle(dataStyle);
                }
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            workbook.write(outputStream);
            return outputStream.toByteArray();
        }
    }

    private int createPermissionHeader(Sheet sheet, int startRow, CellStyle headerStyle,
                                        CellStyle dataStyle, Permission permission) {
        int rowNum = startRow;

        String[][] headers = {
                {"许可编号", permission.getPermissionNo()},
                {"当前状态", permission.getStatus().getDisplayName()},
                {"作业类型", permission.getOperationType()},
                {"计划开始时间", permission.getPlannedStartTime() != null ?
                        permission.getPlannedStartTime().format(DATETIME_FORMATTER) : ""},
                {"计划结束时间", permission.getPlannedEndTime() != null ?
                        permission.getPlannedEndTime().format(DATETIME_FORMATTER) : ""},
                {"飞手", permission.getPilot() != null ? permission.getPilot().getPilotName() : ""},
                {"无人机", permission.getDrone() != null ? permission.getDrone().getDroneCode() : ""},
                {"最终结论", permission.getFinalConclusion() != null ? permission.getFinalConclusion() : ""},
                {"结论说明", permission.getConclusionRemark() != null ? permission.getConclusionRemark() : ""},
                {"创建人", permission.getCreatedBy()},
                {"创建时间", permission.getCreatedAt().format(DATETIME_FORMATTER)}
        };

        for (String[] pair : headers) {
            Row row = sheet.createRow(rowNum++);
            Cell labelCell = row.createCell(0);
            labelCell.setCellValue(pair[0]);
            labelCell.setCellStyle(headerStyle);

            Cell valueCell = row.createCell(1);
            valueCell.setCellValue(pair[1] != null ? pair[1] : "");
            valueCell.setCellStyle(dataStyle);
        }

        return rowNum;
    }

    private int createPermissionItems(Sheet sheet, int startRow, CellStyle headerStyle,
                                       CellStyle dataStyle, List<PermissionItem> items) {
        int rowNum = startRow;

        Row titleRow = sheet.createRow(rowNum++);
        Cell titleCell = titleRow.createCell(0);
        titleCell.setCellValue("作业明细");
        titleCell.setCellStyle(headerStyle);

        String[] itemHeaders = {"序号", "地块名称", "地块编码", "作物", "虫害",
                "药剂名称", "批次号", "用量", "单位"};
        Row headerRow = sheet.createRow(rowNum++);
        for (int i = 0; i < itemHeaders.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(itemHeaders[i]);
            cell.setCellStyle(headerStyle);
        }

        int idx = 1;
        for (PermissionItem item : items) {
            Row row = sheet.createRow(rowNum++);
            Plot plot = item.getPlot();
            PesticideBatch batch = item.getPesticideBatch();
            Pesticide pesticide = batch.getPesticide();

            row.createCell(0).setCellValue(idx++);
            row.createCell(1).setCellValue(plot.getPlotName());
            row.createCell(2).setCellValue(plot.getPlotCode());
            row.createCell(3).setCellValue(plot.getCropType() != null ? plot.getCropType() : "");
            row.createCell(4).setCellValue(plot.getPestType() != null ? plot.getPestType() : "");
            row.createCell(5).setCellValue(pesticide.getPesticideName());
            row.createCell(6).setCellValue(batch.getBatchNumber());
            row.createCell(7).setCellValue(item.getDosage() != null ? item.getDosage().toString() : "");
            row.createCell(8).setCellValue(item.getDosageUnit() != null ? item.getDosageUnit() : "");

            for (int i = 0; i < itemHeaders.length; i++) {
                row.getCell(i).setCellStyle(dataStyle);
            }
        }

        return rowNum;
    }

    private int createCheckRecords(Sheet sheet, int startRow, CellStyle headerStyle,
                                    CellStyle dataStyle, List<CheckRecord> records) {
        int rowNum = startRow;

        Row titleRow = sheet.createRow(rowNum++);
        Cell titleCell = titleRow.createCell(0);
        titleCell.setCellValue("校验记录");
        titleCell.setCellStyle(headerStyle);

        String[] checkHeaders = {"校验类型", "校验结果", "校验详情", "处置说明", "校验时间", "校验人"};
        Row headerRow = sheet.createRow(rowNum++);
        for (int i = 0; i < checkHeaders.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(checkHeaders[i]);
            cell.setCellStyle(headerStyle);
        }

        for (CheckRecord record : records) {
            Row row = sheet.createRow(rowNum++);
            row.createCell(0).setCellValue(record.getCheckType().getDisplayName());
            row.createCell(1).setCellValue(record.getCheckResult().getDisplayName());
            row.createCell(2).setCellValue(record.getCheckDetail() != null ? record.getCheckDetail() : "");
            row.createCell(3).setCellValue(record.getDisposalInstruction() != null ? record.getDisposalInstruction() : "");
            row.createCell(4).setCellValue(record.getCheckedAt().format(DATETIME_FORMATTER));
            row.createCell(5).setCellValue(record.getCheckedBy() != null ? record.getCheckedBy() : "");

            for (int i = 0; i < checkHeaders.length; i++) {
                row.getCell(i).setCellStyle(dataStyle);
            }
        }

        return rowNum;
    }

    private int createProcessingRecords(Sheet sheet, int startRow, CellStyle headerStyle,
                                         CellStyle dataStyle, List<ProcessingRecord> records) {
        int rowNum = startRow;

        Row titleRow = sheet.createRow(rowNum++);
        Cell titleCell = titleRow.createCell(0);
        titleCell.setCellValue("处理流转记录");
        titleCell.setCellStyle(headerStyle);

        String[] procHeaders = {"原状态", "新状态", "动作", "说明", "处理人", "处理时间"};
        Row headerRow = sheet.createRow(rowNum++);
        for (int i = 0; i < procHeaders.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(procHeaders[i]);
            cell.setCellStyle(headerStyle);
        }

        for (ProcessingRecord record : records) {
            Row row = sheet.createRow(rowNum++);
            row.createCell(0).setCellValue(record.getFromStatus() != null ?
                    record.getFromStatus().getDisplayName() : "无");
            row.createCell(1).setCellValue(record.getToStatus().getDisplayName());
            row.createCell(2).setCellValue(record.getAction() != null ? record.getAction() : "");
            row.createCell(3).setCellValue(record.getRemark() != null ? record.getRemark() : "");
            row.createCell(4).setCellValue(record.getProcessedBy());
            row.createCell(5).setCellValue(record.getProcessedAt().format(DATETIME_FORMATTER));

            for (int i = 0; i < procHeaders.length; i++) {
                row.getCell(i).setCellStyle(dataStyle);
            }
        }

        return rowNum;
    }

    private CellStyle createHeaderStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        return style;
    }

    private CellStyle createDataStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        return style;
    }
}
