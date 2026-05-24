package com.cityops.batterydispatch.service;

import com.cityops.batterydispatch.entity.BatterySwapReport;
import com.cityops.batterydispatch.entity.DispatchTask;
import com.cityops.batterydispatch.repository.BatterySwapReportRepository;
import com.cityops.batterydispatch.repository.DispatchTaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReportService {
    private final BatterySwapReportRepository swapReportRepository;
    private final DispatchTaskRepository dispatchTaskRepository;
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public byte[] exportSwapReport(LocalDateTime startTime, LocalDateTime endTime, String areaCode) throws IOException {
        List<BatterySwapReport> reports;
        if (areaCode != null && !areaCode.isEmpty()) {
            reports = swapReportRepository.findByAreaCode(areaCode);
        } else {
            reports = swapReportRepository.findByTimeRange(startTime, endTime);
        }

        return generateSwapExcel(reports);
    }

    public byte[] exportTaskReport(LocalDateTime startTime, LocalDateTime endTime, String areaCode) throws IOException {
        List<DispatchTask> tasks;
        if (areaCode != null && !areaCode.isEmpty()) {
            tasks = dispatchTaskRepository.findByAreaCode(areaCode);
        } else {
            tasks = dispatchTaskRepository.findByTimeRange(startTime, endTime);
        }

        return generateTaskExcel(tasks);
    }

    private byte[] generateSwapExcel(List<BatterySwapReport> reports) throws IOException {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet("换电报告");
            CellStyle headerStyle = createHeaderStyle(workbook);
            CellStyle dataStyle = createDataStyle(workbook);

            String[] headers = {
                "报告编号", "任务编号", "车辆编号", "旧电池编号", "新电池编号",
                "片区", "派送员编号", "派送员姓名", "骑手姓名",
                "旧电量(%)", "新电量(%)", "换电地点", "最终状态", "处置原因", "换电时间"
            };

            createHeaderRow(sheet, headers, headerStyle);

            int rowNum = 1;
            for (BatterySwapReport report : reports) {
                Row row = sheet.createRow(rowNum++);
                createCell(row, 0, report.getReportNo(), dataStyle);
                createCell(row, 1, report.getTaskNo(), dataStyle);
                createCell(row, 2, report.getVehicleNo(), dataStyle);
                createCell(row, 3, report.getOldBatteryNo(), dataStyle);
                createCell(row, 4, report.getNewBatteryNo(), dataStyle);
                createCell(row, 5, report.getAreaCode(), dataStyle);
                createCell(row, 6, report.getDispatcherNo(), dataStyle);
                createCell(row, 7, report.getDispatcherName(), dataStyle);
                createCell(row, 8, report.getRiderName(), dataStyle);
                createCell(row, 9, report.getOldBatteryLevel() != null ? report.getOldBatteryLevel().toString() : "", dataStyle);
                createCell(row, 10, report.getNewBatteryLevel() != null ? report.getNewBatteryLevel().toString() : "", dataStyle);
                createCell(row, 11, report.getLocation(), dataStyle);
                createCell(row, 12, report.getFinalStatus() != null ? report.getFinalStatus().getDescription() : "", dataStyle);
                createCell(row, 13, report.getDisposeReason(), dataStyle);
                createCell(row, 14, report.getSwapTime() != null ? report.getSwapTime().format(DATE_FORMATTER) : "", dataStyle);
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return out.toByteArray();
        }
    }

    private byte[] generateTaskExcel(List<DispatchTask> tasks) throws IOException {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet("任务明细");
            CellStyle headerStyle = createHeaderStyle(workbook);
            CellStyle dataStyle = createDataStyle(workbook);

            String[] headers = {
                "任务编号", "批次号", "车辆编号", "电池编号", "片区", "车辆位置",
                "派送员", "骑手", "原始电量(%)", "状态", "状态说明",
                "处置原因", "是否人工确认", "确认人", "创建时间", "完成时间"
            };

            createHeaderRow(sheet, headers, headerStyle);

            int rowNum = 1;
            for (DispatchTask task : tasks) {
                Row row = sheet.createRow(rowNum++);
                createCell(row, 0, task.getTaskNo(), dataStyle);
                createCell(row, 1, task.getBatchNo(), dataStyle);
                createCell(row, 2, task.getVehicleNo(), dataStyle);
                createCell(row, 3, task.getBatteryNo(), dataStyle);
                createCell(row, 4, task.getAreaCode(), dataStyle);
                createCell(row, 5, task.getVehicleLocation(), dataStyle);
                createCell(row, 6, task.getDispatcherName(), dataStyle);
                createCell(row, 7, task.getRiderName(), dataStyle);
                createCell(row, 8, task.getOriginalBatteryLevel() != null ? task.getOriginalBatteryLevel().toString() : "", dataStyle);
                createCell(row, 9, task.getStatus().name(), dataStyle);
                createCell(row, 10, task.getStatus().getDescription(), dataStyle);
                createCell(row, 11, task.getDisposeReason(), dataStyle);
                createCell(row, 12, task.getManualConfirmed() ? "是" : "否", dataStyle);
                createCell(row, 13, task.getConfirmedBy(), dataStyle);
                createCell(row, 14, task.getCreatedAt().format(DATE_FORMATTER), dataStyle);
                createCell(row, 15, task.getCompletedAt() != null ? task.getCompletedAt().format(DATE_FORMATTER) : "", dataStyle);
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return out.toByteArray();
        }
    }

    private void createHeaderRow(Sheet sheet, String[] headers, CellStyle style) {
        Row headerRow = sheet.createRow(0);
        for (int i = 0; i < headers.length; i++) {
            createCell(headerRow, i, headers[i], style);
        }
    }

    private void createCell(Row row, int column, String value, CellStyle style) {
        Cell cell = row.createCell(column);
        cell.setCellValue(value != null ? value : "");
        cell.setCellStyle(style);
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
