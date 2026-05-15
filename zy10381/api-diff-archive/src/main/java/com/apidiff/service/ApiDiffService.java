package com.apidiff.service;

import com.apidiff.dto.*;
import com.apidiff.entity.ApiDiffRecord;
import com.apidiff.entity.DiffField;
import com.apidiff.entity.OperationLog;
import com.apidiff.entity.enums.ConfirmationStatus;
import com.apidiff.repository.ApiDiffRecordRepository;
import com.apidiff.repository.DiffFieldRepository;
import com.apidiff.repository.OperationLogRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ApiDiffService {

    private final ApiDiffRecordRepository diffRecordRepository;
    private final DiffFieldRepository diffFieldRepository;
    private final OperationLogRepository operationLogRepository;
    private final JsonDiffService jsonDiffService;
    private final ObjectMapper objectMapper;

    @Transactional
    public ApiDiffResponse createDiffRecord(ApiDiffRequest request) {
        String requestHash = generateRequestHash(request);

        if (diffRecordRepository.existsByRequestHash(requestHash)) {
            ApiDiffRecord existingRecord = diffRecordRepository.findByRequestHash(requestHash).orElseThrow();
            log.info("Duplicate request detected, returning existing record. Hash: {}", requestHash);
            return convertToResponse(existingRecord, true);
        }

        List<DiffField> diffFields = jsonDiffService.compareJson(request.getResponseA(), request.getResponseB());

        ApiDiffRecord record = ApiDiffRecord.builder()
                .apiPath(request.getApiPath())
                .httpMethod(request.getHttpMethod())
                .requestBody(request.getRequestBody())
                .requestHeaders(mapToString(request.getRequestHeaders()))
                .queryParams(request.getQueryParams())
                .requestHash(requestHash)
                .versionA(request.getVersionA())
                .responseA(stringify(request.getResponseA()))
                .statusCodeA(request.getStatusCodeA())
                .responseTimeA(request.getResponseTimeA())
                .versionB(request.getVersionB())
                .responseB(stringify(request.getResponseB()))
                .statusCodeB(request.getStatusCodeB())
                .responseTimeB(request.getResponseTimeB())
                .hasDifferences(!diffFields.isEmpty())
                .diffCount(diffFields.size())
                .diffSummary(generateDiffSummary(diffFields))
                .status(ConfirmationStatus.PENDING)
                .tags(request.getTags())
                .createdBy(request.getCreatedBy())
                .build();

        record = diffRecordRepository.save(record);

        for (DiffField diffField : diffFields) {
            diffField.setDiffRecord(record);
            diffFieldRepository.save(diffField);
        }

        recordOperation(record.getId(), "CREATE", null, null, "创建差异记录", request.getCreatedBy());

        return convertToResponse(record, true);
    }

    public ApiDiffResponse getDiffRecord(Long id) {
        ApiDiffRecord record = diffRecordRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("差异记录不存在: " + id));
        return convertToResponse(record, true);
    }

    public Page<ApiDiffResponse> queryDiffRecords(DiffQueryRequest request) {
        Pageable pageable = PageRequest.of(
                request.getPage(),
                request.getSize(),
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Page<ApiDiffRecord> recordPage = diffRecordRepository.findByConditions(
                request.getStatus(),
                request.getApiPath(),
                request.getHasDifferences(),
                request.getStartTime(),
                request.getEndTime(),
                pageable
        );

        return recordPage.map(record -> convertToResponse(record, false));
    }

    @Transactional
    public ApiDiffResponse updateStatus(Long id, StatusUpdateRequest request) {
        ApiDiffRecord record = diffRecordRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("差异记录不存在: " + id));

        ConfirmationStatus oldStatus = record.getStatus();
        ConfirmationStatus newStatus = request.getStatus();

        record.setStatus(newStatus);

        if (request.getAttributionNote() != null) {
            record.setAttributionNote(request.getAttributionNote());
            record.setAttributedBy(request.getOperatedBy());
            record.setAttributedAt(LocalDateTime.now());
        }

        if (isFinalStatus(newStatus)) {
            record.setConfirmedBy(request.getOperatedBy());
            record.setConfirmedAt(LocalDateTime.now());
        }

        record = diffRecordRepository.save(record);

        recordOperation(id, "STATUS_UPDATE",
                oldStatus.name(),
                newStatus.name(),
                request.getRemark(),
                request.getOperatedBy());

        return convertToResponse(record, true);
    }

    @Transactional
    public void deleteDiffRecord(Long id, String operatedBy) {
        if (!diffRecordRepository.existsById(id)) {
            throw new RuntimeException("差异记录不存在: " + id);
        }
        diffFieldRepository.deleteByDiffRecordId(id);
        diffRecordRepository.deleteById(id);

        OperationLog log = OperationLog.builder()
                .diffRecordId(id)
                .operationType("DELETE")
                .remark("删除差异记录")
                .operatedBy(operatedBy)
                .build();
        operationLogRepository.save(log);
    }

    public List<OperationLog> getOperationLogs(Long id) {
        return operationLogRepository.findByDiffRecordIdOrderByOperatedAtDesc(id);
    }

    public byte[] exportToCsv(DiffQueryRequest request) {
        request.setPage(0);
        request.setSize(10000);
        Page<ApiDiffResponse> records = queryDiffRecords(request);

        try (ByteArrayOutputStream out = new ByteArrayOutputStream();
             CSVPrinter csvPrinter = new CSVPrinter(
                     new OutputStreamWriter(out, StandardCharsets.UTF_8),
                     CSVFormat.DEFAULT.builder()
                             .setHeader("ID", "API路径", "HTTP方法", "版本A", "版本B",
                                     "是否有差异", "差异数量", "状态", "创建人", "创建时间", "备注")
                             .build())) {

            for (ApiDiffResponse record : records.getContent()) {
                csvPrinter.printRecord(
                        record.getId(),
                        record.getApiPath(),
                        record.getHttpMethod(),
                        record.getVersionA(),
                        record.getVersionB(),
                        record.getHasDifferences(),
                        record.getDiffCount(),
                        record.getStatus(),
                        record.getCreatedBy(),
                        record.getCreatedAt(),
                        record.getAttributionNote()
                );
            }

            csvPrinter.flush();
            return out.toByteArray();
        } catch (Exception e) {
            log.error("Export to CSV failed", e);
            throw new RuntimeException("导出CSV失败: " + e.getMessage());
        }
    }

    private String generateRequestHash(ApiDiffRequest request) {
        try {
            String input = String.join("|",
                    request.getApiPath(),
                    request.getHttpMethod(),
                    request.getRequestBody() != null ? request.getRequestBody() : "",
                    request.getQueryParams() != null ? request.getQueryParams() : "",
                    request.getVersionA(),
                    request.getVersionB(),
                    stringify(request.getResponseA()),
                    stringify(request.getResponseB())
            );

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(input.getBytes(StandardCharsets.UTF_8));

            StringBuilder hexString = new StringBuilder();
            for (byte b : hashBytes) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            log.error("Generate request hash failed", e);
            return UUID.randomUUID().toString();
        }
    }

    private String generateDiffSummary(List<DiffField> diffFields) {
        if (diffFields.isEmpty()) {
            return "无差异";
        }

        Map<String, Long> typeCount = diffFields.stream()
                .collect(Collectors.groupingBy(
                        f -> f.getDiffType().name(),
                        Collectors.counting()
                ));

        List<String> parts = new ArrayList<>();
        for (Map.Entry<String, Long> entry : typeCount.entrySet()) {
            parts.add(entry.getKey() + ": " + entry.getValue());
        }

        String summary = String.join(", ", parts);
        return summary.length() > 1000 ? summary.substring(0, 1000) : summary;
    }

    private String mapToString(Map<String, String> map) {
        if (map == null || map.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(map);
        } catch (Exception e) {
            return map.toString();
        }
    }

    private String stringify(Object obj) {
        if (obj == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return obj.toString();
        }
    }

    private boolean isFinalStatus(ConfirmationStatus status) {
        return status == ConfirmationStatus.CONFIRMED_EXPECTED ||
               status == ConfirmationStatus.CONFIRMED_BUG ||
               status == ConfirmationStatus.CONFIRMED_ENV ||
               status == ConfirmationStatus.REJECTED ||
               status == ConfirmationStatus.ARCHIVED;
    }

    private ApiDiffResponse convertToResponse(ApiDiffRecord record, boolean includeFields) {
        ApiDiffResponse response = new ApiDiffResponse();
        response.setId(record.getId());
        response.setApiPath(record.getApiPath());
        response.setHttpMethod(record.getHttpMethod());
        response.setVersionA(record.getVersionA());
        response.setVersionB(record.getVersionB());
        response.setHasDifferences(record.getHasDifferences());
        response.setDiffCount(record.getDiffCount());
        response.setDiffSummary(record.getDiffSummary());
        response.setStatus(record.getStatus());
        response.setAttributionNote(record.getAttributionNote());
        response.setAttributedBy(record.getAttributedBy());
        response.setAttributedAt(record.getAttributedAt());
        response.setConfirmedBy(record.getConfirmedBy());
        response.setConfirmedAt(record.getConfirmedAt());
        response.setTags(record.getTags());
        response.setCreatedAt(record.getCreatedAt());
        response.setUpdatedAt(record.getUpdatedAt());
        response.setCreatedBy(record.getCreatedBy());

        if (includeFields) {
            List<DiffField> fields = diffFieldRepository.findByDiffRecordIdOrderByFieldPath(record.getId());
            response.setDiffFields(fields.stream().map(this::convertToFieldDTO).collect(Collectors.toList()));
        }

        return response;
    }

    private DiffFieldDTO convertToFieldDTO(DiffField field) {
        DiffFieldDTO dto = new DiffFieldDTO();
        dto.setId(field.getId());
        dto.setFieldPath(field.getFieldPath());
        dto.setDiffType(field.getDiffType());
        dto.setExpectedValue(field.getExpectedValue());
        dto.setActualValue(field.getActualValue());
        dto.setExpectedType(field.getExpectedType());
        dto.setActualType(field.getActualType());
        dto.setAttributionNote(field.getAttributionNote());
        dto.setAttributedBy(field.getAttributedBy());
        dto.setAttributedAt(field.getAttributedAt());
        dto.setCreatedAt(field.getCreatedAt());
        return dto;
    }

    @Transactional
    public DiffFieldDTO updateFieldAttribution(Long recordId, FieldAttributionRequest request) {
        ApiDiffRecord record = diffRecordRepository.findById(recordId)
                .orElseThrow(() -> new RuntimeException("差异记录不存在: " + recordId));

        DiffField diffField = diffFieldRepository.findById(request.getFieldId())
                .orElseThrow(() -> new RuntimeException("差异字段不存在: " + request.getFieldId()));

        if (!diffField.getDiffRecord().getId().equals(recordId)) {
            throw new RuntimeException("差异字段不属于该记录");
        }

        String oldNote = diffField.getAttributionNote();
        diffField.setAttributionNote(request.getAttributionNote());
        diffField.setAttributedBy(request.getOperatedBy());
        diffField.setAttributedAt(LocalDateTime.now());

        diffField = diffFieldRepository.save(diffField);

        recordOperation(recordId, "FIELD_ATTRIBUTION",
                oldNote,
                request.getAttributionNote(),
                request.getRemark() != null ? request.getRemark() : "字段归因更新: " + diffField.getFieldPath(),
                request.getOperatedBy());

        return convertToFieldDTO(diffField);
    }

    @Transactional
    public List<DiffFieldDTO> batchUpdateFieldAttribution(Long recordId, BatchFieldAttributionRequest request) {
        ApiDiffRecord record = diffRecordRepository.findById(recordId)
                .orElseThrow(() -> new RuntimeException("差异记录不存在: " + recordId));

        List<DiffFieldDTO> result = new ArrayList<>();
        for (FieldAttributionRequest fieldRequest : request.getFields()) {
            DiffField diffField = diffFieldRepository.findById(fieldRequest.getFieldId())
                    .orElseThrow(() -> new RuntimeException("差异字段不存在: " + fieldRequest.getFieldId()));

            if (!diffField.getDiffRecord().getId().equals(recordId)) {
                throw new RuntimeException("差异字段不属于该记录: " + fieldRequest.getFieldId());
            }

            String oldNote = diffField.getAttributionNote();
            diffField.setAttributionNote(fieldRequest.getAttributionNote());
            diffField.setAttributedBy(request.getOperatedBy() != null ? request.getOperatedBy() : fieldRequest.getOperatedBy());
            diffField.setAttributedAt(LocalDateTime.now());

            diffField = diffFieldRepository.save(diffField);
            result.add(convertToFieldDTO(diffField));

            recordOperation(recordId, "FIELD_ATTRIBUTION",
                    oldNote,
                    fieldRequest.getAttributionNote(),
                    fieldRequest.getRemark() != null ? fieldRequest.getRemark() : "字段归因更新: " + diffField.getFieldPath(),
                    request.getOperatedBy() != null ? request.getOperatedBy() : fieldRequest.getOperatedBy());
        }

        return result;
    }

    public List<DiffFieldDTO> getDiffFieldsByRecordId(Long recordId) {
        if (!diffRecordRepository.existsById(recordId)) {
            throw new RuntimeException("差异记录不存在: " + recordId);
        }
        List<DiffField> fields = diffFieldRepository.findByDiffRecordIdOrderByFieldPath(recordId);
        return fields.stream().map(this::convertToFieldDTO).collect(Collectors.toList());
    }

    private void recordOperation(Long recordId, String type, String oldValue, String newValue, String remark, String operatedBy) {
        OperationLog log = OperationLog.builder()
                .diffRecordId(recordId)
                .operationType(type)
                .previousValue(oldValue)
                .newValue(newValue)
                .remark(remark)
                .operatedBy(operatedBy)
                .operatedAt(LocalDateTime.now())
                .build();
        operationLogRepository.save(log);
    }
}
