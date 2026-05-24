package com.airport.baggage.service;

import com.airport.baggage.dto.request.CompensationQueryRequest;
import com.airport.baggage.entity.CompensationOrder;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;

@Service
public class ReportExportService {
    private final CompensationService compensationService;

    public ReportExportService(CompensationService compensationService) {
        this.compensationService = compensationService;
    }

    public byte[] exportToExcel(CompensationQueryRequest request) throws IOException {
        List<CompensationOrder> orders = compensationService.findOrdersForExport(request);

        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("临赔记录");

            CellStyle headerStyle = createHeaderStyle(workbook);
            String[] headers = {
                "补偿单号", "旅客ID", "旅客姓名", "联系电话",
                "航班号", "行李牌号", "来源渠道",
                "状态", "补偿金额", "登记时间",
                "行李到件", "已签收", "处置原因", "备注"
            };

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            int rowNum = 1;
            for (CompensationOrder order : orders) {
                Row row = sheet.createRow(rowNum++);
                row.createCell(0).setCellValue(order.getOrderNo());
                row.createCell(1).setCellValue(order.getPassenger().getPassengerId());
                row.createCell(2).setCellValue(order.getPassenger().getName());
                row.createCell(3).setCellValue(order.getPassenger().getPhone() != null ? order.getPassenger().getPhone() : "");
                row.createCell(4).setCellValue(order.getFlight().getFlightNo());
                row.createCell(5).setCellValue(order.getBaggage().getTagNumber());
                row.createCell(6).setCellValue(order.getSourceType().getDescription());
                row.createCell(7).setCellValue(order.getStatus().getDescription());
                row.createCell(8).setCellValue(order.getAmount() != null ? order.getAmount().doubleValue() : 0);
                row.createCell(9).setCellValue(order.getCreatedAt() != null ? order.getCreatedAt().toString() : "");
                row.createCell(10).setCellValue(order.getBaggageArrived() ? "是" : "否");
                row.createCell(11).setCellValue(order.getPickedUp() ? "是" : "否");
                row.createCell(12).setCellValue(order.getDisposalReason() != null ? order.getDisposalReason() : "");
                row.createCell(13).setCellValue(order.getRemark() != null ? order.getRemark() : "");
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                workbook.write(out);
                return out.toByteArray();
            }
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
}
