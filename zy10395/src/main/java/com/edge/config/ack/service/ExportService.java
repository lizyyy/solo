package com.edge.config.ack.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.edge.config.ack.dto.DeliveryQueryReq;
import com.edge.config.ack.entity.AckReceipt;
import com.edge.config.ack.entity.ConfigDelivery;
import com.edge.config.ack.entity.EffectiveCheck;
import com.edge.config.ack.entity.FailureReason;
import com.edge.config.ack.enums.AckResultEnum;
import com.edge.config.ack.enums.CheckResultEnum;
import com.edge.config.ack.enums.DeliveryStatusEnum;
import com.edge.config.ack.enums.FailureTypeEnum;
import com.edge.config.ack.mapper.AckReceiptMapper;
import com.edge.config.ack.mapper.ConfigDeliveryMapper;
import com.edge.config.ack.mapper.EffectiveCheckMapper;
import com.edge.config.ack.mapper.FailureReasonMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExportService {
    private final ConfigDeliveryMapper deliveryMapper;
    private final AckReceiptMapper receiptMapper;
    private final EffectiveCheckMapper checkMapper;
    private final FailureReasonMapper failureMapper;

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public byte[] exportDelivery(DeliveryQueryReq req) throws IOException {
        LambdaQueryWrapper<ConfigDelivery> wrapper = new LambdaQueryWrapper<>();
        if (req.getNodeCode() != null) {
            wrapper.eq(ConfigDelivery::getNodeCode, req.getNodeCode());
        }
        if (req.getVersionNo() != null) {
            wrapper.eq(ConfigDelivery::getVersionNo, req.getVersionNo());
        }
        if (req.getStatus() != null) {
            wrapper.eq(ConfigDelivery::getStatus, req.getStatus());
        }
        if (req.getStartTime() != null) {
            wrapper.ge(ConfigDelivery::getCreatedTime, req.getStartTime());
        }
        if (req.getEndTime() != null) {
            wrapper.le(ConfigDelivery::getCreatedTime, req.getEndTime());
        }
        wrapper.orderByDesc(ConfigDelivery::getCreatedTime);

        List<ConfigDelivery> list = deliveryMapper.selectList(wrapper);

        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("配置下发记录");

            CellStyle headerStyle = createHeaderStyle(workbook);
            CellStyle contentStyle = createContentStyle(workbook);

            String[] headers = {"下发单号", "节点编码", "版本号", "下发时间", "状态", "签收时间", "生效时间", "重试次数"};
            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            int rowNum = 1;
            for (ConfigDelivery delivery : list) {
                Row row = sheet.createRow(rowNum++);
                createCell(row, 0, delivery.getDeliveryNo(), contentStyle);
                createCell(row, 1, delivery.getNodeCode(), contentStyle);
                createCell(row, 2, delivery.getVersionNo(), contentStyle);
                createCell(row, 3, delivery.getDeliveryTime() != null ? delivery.getDeliveryTime().format(FORMATTER) : "", contentStyle);
                DeliveryStatusEnum statusEnum = DeliveryStatusEnum.of(delivery.getStatus());
                createCell(row, 4, statusEnum != null ? statusEnum.getDesc() : String.valueOf(delivery.getStatus()), contentStyle);
                createCell(row, 5, delivery.getAckTime() != null ? delivery.getAckTime().format(FORMATTER) : "", contentStyle);
                createCell(row, 6, delivery.getEffectiveTime() != null ? delivery.getEffectiveTime().format(FORMATTER) : "", contentStyle);
                createCell(row, 7, String.valueOf(delivery.getRetryCount()), contentStyle);
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            return out.toByteArray();
        }
    }

    public byte[] exportReceipt(String deliveryNo) throws IOException {
        List<AckReceipt> list = receiptMapper.selectList(
                new LambdaQueryWrapper<AckReceipt>()
                        .eq(AckReceipt::getDeliveryNo, deliveryNo)
                        .orderByDesc(AckReceipt::getCreatedTime)
        );

        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("签收记录");

            CellStyle headerStyle = createHeaderStyle(workbook);
            CellStyle contentStyle = createContentStyle(workbook);

            String[] headers = {"回执单号", "下发单号", "节点编码", "版本号", "签收结果", "签收时间", "签收来源", "客户端IP"};
            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            int rowNum = 1;
            for (AckReceipt receipt : list) {
                Row row = sheet.createRow(rowNum++);
                createCell(row, 0, receipt.getReceiptNo(), contentStyle);
                createCell(row, 1, receipt.getDeliveryNo(), contentStyle);
                createCell(row, 2, receipt.getNodeCode(), contentStyle);
                createCell(row, 3, receipt.getVersionNo(), contentStyle);
                AckResultEnum resultEnum = AckResultEnum.of(receipt.getAckResult());
                createCell(row, 4, resultEnum != null ? resultEnum.getDesc() : String.valueOf(receipt.getAckResult()), contentStyle);
                createCell(row, 5, receipt.getAckTime() != null ? receipt.getAckTime().format(FORMATTER) : "", contentStyle);
                createCell(row, 6, receipt.getAckBy() != null ? receipt.getAckBy() : "", contentStyle);
                createCell(row, 7, receipt.getClientIp() != null ? receipt.getClientIp() : "", contentStyle);
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            return out.toByteArray();
        }
    }

    public byte[] exportFailure(String deliveryNo) throws IOException {
        List<FailureReason> list = failureMapper.selectList(
                new LambdaQueryWrapper<FailureReason>()
                        .eq(FailureReason::getDeliveryNo, deliveryNo)
                        .orderByDesc(FailureReason::getCreatedTime)
        );

        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("失败记录");

            CellStyle headerStyle = createHeaderStyle(workbook);
            CellStyle contentStyle = createContentStyle(workbook);

            String[] headers = {"下发单号", "节点编码", "版本号", "失败类型", "错误码", "错误信息", "错误详情", "失败时间"};
            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            int rowNum = 1;
            for (FailureReason failure : list) {
                Row row = sheet.createRow(rowNum++);
                createCell(row, 0, failure.getDeliveryNo(), contentStyle);
                createCell(row, 1, failure.getNodeCode(), contentStyle);
                createCell(row, 2, failure.getVersionNo(), contentStyle);
                FailureTypeEnum typeEnum = FailureTypeEnum.of(failure.getFailureType());
                createCell(row, 3, typeEnum != null ? typeEnum.getDesc() : String.valueOf(failure.getFailureType()), contentStyle);
                createCell(row, 4, failure.getFailureCode() != null ? failure.getFailureCode() : "", contentStyle);
                createCell(row, 5, failure.getFailureMsg() != null ? failure.getFailureMsg() : "", contentStyle);
                createCell(row, 6, failure.getFailureDetail() != null ? failure.getFailureDetail() : "", contentStyle);
                createCell(row, 7, failure.getFailureTime() != null ? failure.getFailureTime().format(FORMATTER) : "", contentStyle);
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            return out.toByteArray();
        }
    }

    public byte[] exportCheck(String deliveryNo) throws IOException {
        List<EffectiveCheck> list = checkMapper.selectList(
                new LambdaQueryWrapper<EffectiveCheck>()
                        .eq(EffectiveCheck::getDeliveryNo, deliveryNo)
                        .orderByDesc(EffectiveCheck::getCreatedTime)
        );

        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("生效校验记录");

            CellStyle headerStyle = createHeaderStyle(workbook);
            CellStyle contentStyle = createContentStyle(workbook);

            String[] headers = {"下发单号", "节点编码", "版本号", "校验时间", "校验结果", "校验详情", "校验人"};
            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            int rowNum = 1;
            for (EffectiveCheck check : list) {
                Row row = sheet.createRow(rowNum++);
                createCell(row, 0, check.getDeliveryNo(), contentStyle);
                createCell(row, 1, check.getNodeCode(), contentStyle);
                createCell(row, 2, check.getVersionNo(), contentStyle);
                createCell(row, 3, check.getCheckTime() != null ? check.getCheckTime().format(FORMATTER) : "", contentStyle);
                CheckResultEnum resultEnum = CheckResultEnum.of(check.getCheckResult());
                createCell(row, 4, resultEnum != null ? resultEnum.getDesc() : String.valueOf(check.getCheckResult()), contentStyle);
                createCell(row, 5, check.getCheckDetail() != null ? check.getCheckDetail() : "", contentStyle);
                createCell(row, 6, check.getCheckBy() != null ? check.getCheckBy() : "", contentStyle);
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            return out.toByteArray();
        }
    }

    private CellStyle createHeaderStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 12);
        style.setFont(font);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        return style;
    }

    private CellStyle createContentStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        return style;
    }

    private void createCell(Row row, int column, String value, CellStyle style) {
        Cell cell = row.createCell(column);
        cell.setCellValue(value);
        cell.setCellStyle(style);
    }
}
