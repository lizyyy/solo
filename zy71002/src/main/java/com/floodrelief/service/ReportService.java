package com.floodrelief.service;

import com.floodrelief.dto.GapReportDTO;
import com.floodrelief.dto.ShelterAllocationSummary;
import com.floodrelief.entity.AllocationRecord;
import com.floodrelief.entity.Shelter;
import com.floodrelief.entity.TransferRecord;
import com.floodrelief.repository.*;
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
    private final ShelterRepository shelterRepository;
    private final TransferRecordRepository transferRepository;
    private final AllocationRecordRepository allocationRepository;
    private final MaterialBatchRepository materialRepository;
    private final GapCalculationService gapCalculationService;

    public byte[] generateAllocationReport(Long shelterId) throws IOException {
        try (Workbook workbook = new XSSFWorkbook()) {
            createAllocationSheet(workbook, shelterId);
            createTransferSheet(workbook, shelterId);
            createGapSheet(workbook, shelterId);
            createSummarySheet(workbook, shelterId);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            log.info("报告生成成功: shelterId={}", shelterId);
            return out.toByteArray();
        }
    }

    private void createAllocationSheet(Workbook workbook, Long shelterId) {
        Sheet sheet = workbook.createSheet("调拨记录");
        String[] headers = {"调拨单号", "物资名称", "数量", "单位", "状态", "申请人", "审批人", "发货人", "签收人", "创建时间", "签收时间"};
        
        createHeaderRow(workbook, sheet, headers);
        
        List<AllocationRecord> allocations = allocationRepository.findByShelterIdOrderByCreatedAtDesc(shelterId);
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        
        int rowNum = 1;
        for (AllocationRecord alloc : allocations) {
            Row row = sheet.createRow(rowNum++);
            row.createCell(0).setCellValue(alloc.getAllocationNo());
            row.createCell(1).setCellValue(getMaterialName(alloc.getMaterialBatchId()));
            row.createCell(2).setCellValue(alloc.getQuantity());
            row.createCell(3).setCellValue(alloc.getUnit() != null ? alloc.getUnit() : "");
            row.createCell(4).setCellValue(alloc.getStatus().name());
            row.createCell(5).setCellValue(alloc.getApplicant() != null ? alloc.getApplicant() : "");
            row.createCell(6).setCellValue(alloc.getApprover() != null ? alloc.getApprover() : "");
            row.createCell(7).setCellValue(alloc.getDispatcher() != null ? alloc.getDispatcher() : "");
            row.createCell(8).setCellValue(alloc.getReceiver() != null ? alloc.getReceiver() : "");
            row.createCell(9).setCellValue(alloc.getCreatedAt() != null ? alloc.getCreatedAt().format(formatter) : "");
            row.createCell(10).setCellValue(alloc.getReceivedAt() != null ? alloc.getReceivedAt().format(formatter) : "");
        }

        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
        }
    }

    private void createTransferSheet(Workbook workbook, Long shelterId) {
        Sheet sheet = workbook.createSheet("转移人数");
        String[] headers = {"总人数", "老人数", "儿童数", "残障人数", "上报人", "人工修正", "上报时间"};
        
        createHeaderRow(workbook, sheet, headers);
        
        List<TransferRecord> records = transferRepository.findByShelterIdOrderByCreatedAtDesc(shelterId);
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        
        int rowNum = 1;
        for (TransferRecord record : records) {
            Row row = sheet.createRow(rowNum++);
            row.createCell(0).setCellValue(record.getTotalCount());
            row.createCell(1).setCellValue(record.getElderlyCount() != null ? record.getElderlyCount() : 0);
            row.createCell(2).setCellValue(record.getChildrenCount() != null ? record.getChildrenCount() : 0);
            row.createCell(3).setCellValue(record.getDisabledCount() != null ? record.getDisabledCount() : 0);
            row.createCell(4).setCellValue(record.getReporter() != null ? record.getReporter() : "");
            row.createCell(5).setCellValue(record.getManualCorrection() ? "是" : "否");
            row.createCell(6).setCellValue(record.getCreatedAt() != null ? record.getCreatedAt().format(formatter) : "");
        }

        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
        }
    }

    private void createGapSheet(Workbook workbook, Long shelterId) {
        Sheet sheet = workbook.createSheet("缺口报告");
        String[] headers = {"物资类型", "物资名称", "需求量", "当前量", "缺口量", "单位", "优先级", "原因", "计算时间"};
        
        createHeaderRow(workbook, sheet, headers);
        
        com.floodrelief.dto.GapCalculationRequest request = new com.floodrelief.dto.GapCalculationRequest();
        request.setShelterId(shelterId);
        List<GapReportDTO> gaps = gapCalculationService.calculateGap(request).getData();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        
        int rowNum = 1;
        for (GapReportDTO gap : gaps) {
            Row row = sheet.createRow(rowNum++);
            row.createCell(0).setCellValue(gap.getMaterialType());
            row.createCell(1).setCellValue(gap.getMaterialName());
            row.createCell(2).setCellValue(gap.getRequiredQuantity());
            row.createCell(3).setCellValue(gap.getCurrentQuantity());
            row.createCell(4).setCellValue(gap.getGapQuantity());
            row.createCell(5).setCellValue(gap.getUnit());
            row.createCell(6).setCellValue(gap.getPriority());
            row.createCell(7).setCellValue(gap.getReason());
            row.createCell(8).setCellValue(LocalDateTime.now().format(formatter));
        }

        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
        }
    }

    private void createSummarySheet(Workbook workbook, Long shelterId) {
        Sheet sheet = workbook.createSheet("配比校验");
        String[] headers = {"项目", "数值", "标准", "状态", "说明"};
        
        createHeaderRow(workbook, sheet, headers);
        
        ShelterAllocationSummary summary = gapCalculationService.getShelterSummary(shelterId).getData();
        
        String[] statusMap = {"NORMAL", "正常", "WARNING", "预警", "CRITICAL", "紧急"};
        
        int rowNum = 1;
        
        Row row1 = sheet.createRow(rowNum++);
        row1.createCell(0).setCellValue("总人数");
        row1.createCell(1).setCellValue(summary.getTotalPeople());
        row1.createCell(2).setCellValue("-");
        row1.createCell(3).setCellValue("-");
        row1.createCell(4).setCellValue("安置总人数");

        Row row2 = sheet.createRow(rowNum++);
        row2.createCell(0).setCellValue("食品配比");
        row2.createCell(1).setCellValue(summary.getFoodRatio() + " 份/人");
        row2.createCell(2).setCellValue(">= 3 份/人");
        row2.createCell(3).setCellValue(getStatusText(summary.getRatioStatus()));
        row2.createCell(4).setCellValue("3天储备标准");

        Row row3 = sheet.createRow(rowNum++);
        row3.createCell(0).setCellValue("药品配比");
        row3.createCell(1).setCellValue(summary.getMedicineRatio() + " 份/老人");
        row3.createCell(2).setCellValue(">= 1 份/老人");
        row3.createCell(3).setCellValue(getStatusText(summary.getRatioStatus()));
        row3.createCell(4).setCellValue("基础医疗保障");

        Row row4 = sheet.createRow(rowNum++);
        row4.createCell(0).setCellValue("老人数量");
        row4.createCell(1).setCellValue(summary.getElderlyCount());
        row4.createCell(2).setCellValue("-");
        row4.createCell(3).setCellValue("-");
        row4.createCell(4).setCellValue("需重点关注");

        Row row5 = sheet.createRow(rowNum++);
        row5.createCell(0).setCellValue("儿童数量");
        row5.createCell(1).setCellValue(summary.getChildrenCount() != null ? summary.getChildrenCount() : 0);
        row5.createCell(2).setCellValue("-");
        row5.createCell(3).setCellValue("-");
        row5.createCell(4).setCellValue("需儿童食品");

        Row row6 = sheet.createRow(rowNum++);
        row6.createCell(0).setCellValue("报告生成时间");
        row6.createCell(1).setCellValue(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        row6.createCell(2).setCellValue("-");
        row6.createCell(3).setCellValue("-");
        row6.createCell(4).setCellValue("数据校验时间");

        for (int i = 0; i < headers.length; i++) {
            sheet.autoSizeColumn(i);
        }
    }

    private void createHeaderRow(Workbook workbook, Sheet sheet, String[] headers) {
        Row headerRow = sheet.createRow(0);
        CellStyle headerStyle = workbook.createCellStyle();
        Font font = workbook.createFont();
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

    private String getMaterialName(Long materialBatchId) {
        if (materialBatchId == null) return "";
        return materialRepository.findById(materialBatchId)
                .map(m -> m.getMaterialName())
                .orElse("未知物资");
    }

    private String getStatusText(String status) {
        return switch (status) {
            case "NORMAL" -> "正常";
            case "WARNING" -> "预警";
            case "CRITICAL" -> "紧急";
            default -> status;
        };
    }
}
