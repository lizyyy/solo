package com.riskcontrol.graylist.service;

import com.riskcontrol.graylist.entity.GraylistRecord;
import com.riskcontrol.graylist.enums.GraylistStatus;
import com.riskcontrol.graylist.repository.GraylistRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class GraylistExportService {

    private final GraylistRecordRepository graylistRecordRepository;
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public byte[] exportGraylist(String customerId, String customerName, GraylistStatus status) throws IOException {
        Specification<GraylistRecord> spec = Specification.where(null);

        if (customerId != null && !customerId.isEmpty()) {
            spec = spec.and((root, query, cb) -> cb.like(root.get("customerId"), "%" + customerId + "%"));
        }
        if (customerName != null && !customerName.isEmpty()) {
            spec = spec.and((root, query, cb) -> cb.like(root.get("customerName"), "%" + customerName + "%"));
        }
        if (status != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }

        List<GraylistRecord> records = graylistRecordRepository.findAll(spec);

        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet("灰名单复核记录");

            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            String[] headers = {"ID", "客户ID", "客户名称", "名单原因", "到期时间", "状态", "复核备注", "复核人", "复核时间", "导入批次", "是否到期未复核", "创建时间", "更新时间"};
            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            int rowNum = 1;
            for (GraylistRecord record : records) {
                Row row = sheet.createRow(rowNum++);
                row.createCell(0).setCellValue(record.getId());
                row.createCell(1).setCellValue(record.getCustomerId());
                row.createCell(2).setCellValue(record.getCustomerName());
                row.createCell(3).setCellValue(record.getListReason());
                row.createCell(4).setCellValue(record.getExpireTime() != null ? record.getExpireTime().format(DATE_FORMATTER) : "");
                row.createCell(5).setCellValue(record.getStatus() != null ? record.getStatus().getDescription() : "");
                row.createCell(6).setCellValue(record.getReviewRemark() != null ? record.getReviewRemark() : "");
                row.createCell(7).setCellValue(record.getReviewer() != null ? record.getReviewer() : "");
                row.createCell(8).setCellValue(record.getReviewTime() != null ? record.getReviewTime().format(DATE_FORMATTER) : "");
                row.createCell(9).setCellValue(record.getBatchNo() != null ? record.getBatchNo() : "");
                row.createCell(10).setCellValue(Boolean.TRUE.equals(record.getIsExpiredNotReviewed()) ? "是" : "否");
                row.createCell(11).setCellValue(record.getCreatedAt() != null ? record.getCreatedAt().format(DATE_FORMATTER) : "");
                row.createCell(12).setCellValue(record.getUpdatedAt() != null ? record.getUpdatedAt().format(DATE_FORMATTER) : "");
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return out.toByteArray();
        }
    }
}
