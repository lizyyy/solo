package com.aerialsurvey.service;

import com.aerialsurvey.dto.InspectionResultDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class ExportService {

    private static final Logger log = LoggerFactory.getLogger(ExportService.class);

    private final UnifiedInspectionResultService unifiedResultService;
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public ExportService(UnifiedInspectionResultService unifiedResultService) {
        this.unifiedResultService = unifiedResultService;
    }

    @Transactional(readOnly = true)
    public List<InspectionResultDTO> getExportData(String parkingLotCode) {
        log.debug("导出服务获取停车楼{}数据（与页面/接口同一份）", parkingLotCode);
        return unifiedResultService.getUnifiedResults(parkingLotCode);
    }

    @Transactional(readOnly = true)
    public List<InspectionResultDTO> getExportDataRequiringReview(String parkingLotCode) {
        log.debug("导出服务获取停车楼{}待复核数据（与页面/接口同一份）", parkingLotCode);
        return unifiedResultService.getResultsRequiringManagerReview(parkingLotCode);
    }

    @Transactional(readOnly = true)
    public InspectionResultDTO getExportDataById(Long inspectionId) {
        return unifiedResultService.getUnifiedResultById(inspectionId);
    }

    @Transactional(readOnly = true)
    public byte[] exportToExcel(String parkingLotCode) throws IOException {
        log.info("导出停车楼{}的检查结果到Excel", parkingLotCode);
        List<InspectionResultDTO> results = getExportData(parkingLotCode);

        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("车位坡度检查结果");
            CellStyle headerStyle = createHeaderStyle(workbook);
            CellStyle alertStyle = createAlertStyle(workbook);

            String[] headers = {"ID", "停车楼编号", "车位编号", "坡度值(%)", "最大允许坡度(%)",
                    "实际安全距离(m)", "计算安全距离(m)", "坐标X", "坐标Y", "状态",
                    "截图是否遮挡", "是否需经理复核", "告警信息", "创建人", "创建时间"};

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            int rowNum = 1;
            for (InspectionResultDTO dto : results) {
                Row row = sheet.createRow(rowNum++);
                boolean isAlert = Boolean.TRUE.equals(dto.getRequiresManagerReview()) ||
                        !dto.getAlertMessages().isEmpty();

                createCell(row, 0, dto.getId(), isAlert, alertStyle);
                createCell(row, 1, dto.getParkingLotCode(), isAlert, alertStyle);
                createCell(row, 2, dto.getParkingSpaceNo(), isAlert, alertStyle);
                createCell(row, 3, dto.getSlopeValue(), isAlert, alertStyle);
                createCell(row, 4, dto.getMaxAllowedSlope(), isAlert, alertStyle);
                createCell(row, 5, dto.getActualSafeDistance(), isAlert, alertStyle);
                createCell(row, 6, dto.getCalculatedSafeDistance(), isAlert, alertStyle);
                createCell(row, 7, dto.getCoordinateX(), isAlert, alertStyle);
                createCell(row, 8, dto.getCoordinateY(), isAlert, alertStyle);
                createCell(row, 9, dto.getStatus() != null ? dto.getStatus().name() : "", isAlert, alertStyle);
                createCell(row, 10, dto.getIsScreenshotBlocked() != null ?
                        (dto.getIsScreenshotBlocked() ? "是" : "否") : "否", isAlert, alertStyle);
                createCell(row, 11, dto.getRequiresManagerReview() != null ?
                        (dto.getRequiresManagerReview() ? "是" : "否") : "否", isAlert, alertStyle);
                createCell(row, 12, String.join("；", dto.getAlertMessages()), isAlert, alertStyle);
                createCell(row, 13, dto.getCreatedBy(), isAlert, alertStyle);
                createCell(row, 14, dto.getCreatedAt() != null ?
                        dto.getCreatedAt().format(DATE_FORMATTER) : "", isAlert, alertStyle);
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            Sheet alertSheet = workbook.createSheet("待施工经理复核");
            List<InspectionResultDTO> reviewResults = getExportDataRequiringReview(parkingLotCode);
            Row alertHeaderRow = alertSheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = alertHeaderRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            int alertRowNum = 1;
            for (InspectionResultDTO dto : reviewResults) {
                Row row = alertSheet.createRow(alertRowNum++);
                createCell(row, 0, dto.getId(), true, alertStyle);
                createCell(row, 1, dto.getParkingLotCode(), true, alertStyle);
                createCell(row, 2, dto.getParkingSpaceNo(), true, alertStyle);
                createCell(row, 3, dto.getSlopeValue(), true, alertStyle);
                createCell(row, 4, dto.getMaxAllowedSlope(), true, alertStyle);
                createCell(row, 5, dto.getActualSafeDistance(), true, alertStyle);
                createCell(row, 6, dto.getCalculatedSafeDistance(), true, alertStyle);
                createCell(row, 7, dto.getCoordinateX(), true, alertStyle);
                createCell(row, 8, dto.getCoordinateY(), true, alertStyle);
                createCell(row, 9, dto.getStatus() != null ? dto.getStatus().name() : "", true, alertStyle);
                createCell(row, 10, dto.getIsScreenshotBlocked() != null ?
                        (dto.getIsScreenshotBlocked() ? "是" : "否") : "否", true, alertStyle);
                createCell(row, 11, dto.getRequiresManagerReview() != null ?
                        (dto.getRequiresManagerReview() ? "是" : "否") : "否", true, alertStyle);
                createCell(row, 12, String.join("；", dto.getAlertMessages()), true, alertStyle);
                createCell(row, 13, dto.getCreatedBy(), true, alertStyle);
                createCell(row, 14, dto.getCreatedAt() != null ?
                        dto.getCreatedAt().format(DATE_FORMATTER) : "", true, alertStyle);
            }

            for (int i = 0; i < headers.length; i++) {
                alertSheet.autoSizeColumn(i);
            }

            try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                workbook.write(out);
                return out.toByteArray();
            }
        }
    }

    private void createCell(Row row, int column, Object value, boolean isAlert, CellStyle alertStyle) {
        Cell cell = row.createCell(column);
        if (value == null) {
            cell.setCellValue("");
        } else if (value instanceof Number) {
            cell.setCellValue(((Number) value).doubleValue());
        } else {
            cell.setCellValue(value.toString());
        }
        if (isAlert) {
            cell.setCellStyle(alertStyle);
        }
    }

    private CellStyle createHeaderStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }

    private CellStyle createAlertStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setColor(IndexedColors.RED.getIndex());
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.YELLOW.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }
}
