package com.identity.verification.service;

import com.identity.verification.dto.ApiResponse;
import com.identity.verification.model.*;
import com.identity.verification.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExportService {

    private final VerificationTaskRepository taskRepository;
    private final PersonIdentifierRepository identifierRepository;
    private final ConflictFieldRepository conflictRepository;
    private final MergeSuggestionRepository suggestionRepository;
    private final ConfirmationRecordRepository confirmationRepository;

    public ResponseEntity<ApiResponse<Map<String, Object>>> getExportData(Long taskId) {
        VerificationTask task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("校验任务不存在"));

        Map<String, Object> exportData = new HashMap<>();
        exportData.put("task", task);
        exportData.put("identifiers", identifierRepository.findByTaskId(taskId));
        exportData.put("conflicts", conflictRepository.findByTaskId(taskId));
        exportData.put("suggestions", suggestionRepository.findByTaskId(taskId));
        exportData.put("confirmations", confirmationRepository.findByTaskId(taskId));

        return ApiResponse.successEntity(exportData);
    }

    public byte[] exportToExcel(Long taskId) throws Exception {
        VerificationTask task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("校验任务不存在"));

        List<PersonIdentifier> identifiers = identifierRepository.findByTaskId(taskId);
        List<ConflictField> conflicts = conflictRepository.findByTaskId(taskId);
        List<MergeSuggestion> suggestions = suggestionRepository.findByTaskId(taskId);
        List<ConfirmationRecord> confirmations = confirmationRepository.findByTaskId(taskId);

        try (Workbook workbook = new XSSFWorkbook()) {
            CellStyle headerStyle = workbook.createCellStyle();
            Font font = workbook.createFont();
            font.setBold(true);
            headerStyle.setFont(font);

            Sheet taskSheet = workbook.createSheet("任务概览");
            createTaskSheet(taskSheet, task, headerStyle);

            Sheet identifiersSheet = workbook.createSheet("身份数据");
            createIdentifiersSheet(identifiersSheet, identifiers, headerStyle);

            Sheet conflictsSheet = workbook.createSheet("冲突字段");
            createConflictsSheet(conflictsSheet, conflicts, headerStyle);

            Sheet suggestionsSheet = workbook.createSheet("合并建议");
            createSuggestionsSheet(suggestionsSheet, suggestions, headerStyle);

            Sheet confirmationsSheet = workbook.createSheet("确认记录");
            createConfirmationsSheet(confirmationsSheet, confirmations, headerStyle);

            for (int i = 0; i < 5; i++) {
                workbook.getSheetAt(i).autoSizeColumn(0);
            }

            try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
                workbook.write(outputStream);
                return outputStream.toByteArray();
            }
        }
    }

    private void createTaskSheet(Sheet sheet, VerificationTask task, CellStyle headerStyle) {
        Row headerRow = sheet.createRow(0);
        String[] headers = {"字段", "值"};
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }

        Object[][] data = {
                {"任务ID", task.getId()},
                {"请求ID", task.getRequestId()},
                {"业务类型", task.getBusinessType()},
                {"状态", task.getStatus().getDescription()},
                {"信任评分", task.getTrustScore()},
                {"信任等级", task.getTrustLevel()},
                {"冲突数量", task.getConflictCount()},
                {"创建人", task.getCreatedBy()},
                {"创建时间", task.getCreatedAt().toString()},
                {"完成时间", task.getCompletedAt() != null ? task.getCompletedAt().toString() : ""}
        };

        for (int i = 0; i < data.length; i++) {
            Row row = sheet.createRow(i + 1);
            row.createCell(0).setCellValue(data[i][0].toString());
            row.createCell(1).setCellValue(data[i][1] != null ? data[i][1].toString() : "");
        }
    }

    private void createIdentifiersSheet(Sheet sheet, List<PersonIdentifier> identifiers, CellStyle headerStyle) {
        Row headerRow = sheet.createRow(0);
        String[] headers = {"数据源", "证件类型", "证件号", "姓名", "性别", "生日", "地址", "电话", "邮箱"};
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }

        for (int i = 0; i < identifiers.size(); i++) {
            PersonIdentifier id = identifiers.get(i);
            Row row = sheet.createRow(i + 1);
            row.createCell(0).setCellValue(id.getSourceCode());
            row.createCell(1).setCellValue(id.getIdType());
            row.createCell(2).setCellValue(id.getIdValue());
            row.createCell(3).setCellValue(id.getName() != null ? id.getName() : "");
            row.createCell(4).setCellValue(id.getGender() != null ? id.getGender() : "");
            row.createCell(5).setCellValue(id.getBirthDate() != null ? id.getBirthDate() : "");
            row.createCell(6).setCellValue(id.getAddress() != null ? id.getAddress() : "");
            row.createCell(7).setCellValue(id.getPhoneNumber() != null ? id.getPhoneNumber() : "");
            row.createCell(8).setCellValue(id.getEmail() != null ? id.getEmail() : "");
        }
    }

    private void createConflictsSheet(Sheet sheet, List<ConflictField> conflicts, CellStyle headerStyle) {
        Row headerRow = sheet.createRow(0);
        String[] headers = {"字段名", "数据源A", "值A", "数据源B", "值B", "状态", "已解决值"};
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }

        for (int i = 0; i < conflicts.size(); i++) {
            ConflictField c = conflicts.get(i);
            Row row = sheet.createRow(i + 1);
            row.createCell(0).setCellValue(c.getFieldName());
            row.createCell(1).setCellValue(c.getSourceACode() != null ? c.getSourceACode() : "");
            row.createCell(2).setCellValue(c.getSourceAValue() != null ? c.getSourceAValue() : "");
            row.createCell(3).setCellValue(c.getSourceBCode() != null ? c.getSourceBCode() : "");
            row.createCell(4).setCellValue(c.getSourceBValue() != null ? c.getSourceBValue() : "");
            row.createCell(5).setCellValue(Boolean.TRUE.equals(c.getResolved()) ? "已解决" : "未解决");
            row.createCell(6).setCellValue(c.getResolvedValue() != null ? c.getResolvedValue() : "");
        }
    }

    private void createSuggestionsSheet(Sheet sheet, List<MergeSuggestion> suggestions, CellStyle headerStyle) {
        Row headerRow = sheet.createRow(0);
        String[] headers = {"字段名", "建议值", "建议来源", "置信度", "信任等级", "理由", "是否采纳"};
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }

        for (int i = 0; i < suggestions.size(); i++) {
            MergeSuggestion s = suggestions.get(i);
            Row row = sheet.createRow(i + 1);
            row.createCell(0).setCellValue(s.getFieldName());
            row.createCell(1).setCellValue(s.getSuggestedValue() != null ? s.getSuggestedValue() : "");
            row.createCell(2).setCellValue(s.getSuggestedSource() != null ? s.getSuggestedSource() : "");
            row.createCell(3).setCellValue(s.getConfidenceScore() != null ? s.getConfidenceScore() : 0);
            row.createCell(4).setCellValue(s.getTrustLevel() != null ? s.getTrustLevel().name() : "");
            row.createCell(5).setCellValue(s.getReasoning() != null ? s.getReasoning() : "");
            row.createCell(6).setCellValue(Boolean.TRUE.equals(s.getAdopted()) ? "已采纳" : "未采纳");
        }
    }

    private void createConfirmationsSheet(Sheet sheet, List<ConfirmationRecord> confirmations, CellStyle headerStyle) {
        Row headerRow = sheet.createRow(0);
        String[] headers = {"操作时间", "操作人", "字段名", "最终值", "备注"};
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(headerStyle);
        }

        for (int i = 0; i < confirmations.size(); i++) {
            ConfirmationRecord c = confirmations.get(i);
            Row row = sheet.createRow(i + 1);
            row.createCell(0).setCellValue(c.getCreatedAt().toString());
            row.createCell(1).setCellValue(c.getOperatorName() != null ? c.getOperatorName() : "");
            row.createCell(2).setCellValue(c.getFieldName() != null ? c.getFieldName() : "");
            row.createCell(3).setCellValue(c.getFinalValue() != null ? c.getFinalValue() : "");
            row.createCell(4).setCellValue(c.getComments() != null ? c.getComments() : "");
        }
    }
}
