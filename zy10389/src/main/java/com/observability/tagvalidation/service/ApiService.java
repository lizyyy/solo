package com.observability.tagvalidation.service;

import com.observability.tagvalidation.dto.CreateApiRequest;
import com.observability.tagvalidation.dto.ReportSampleRequest;
import com.observability.tagvalidation.dto.ValidationResultDto;
import com.observability.tagvalidation.engine.TagValidationEngine;
import com.observability.tagvalidation.engine.ValidationResult;
import com.observability.tagvalidation.entity.*;
import com.observability.tagvalidation.enums.ValidationStatus;
import com.observability.tagvalidation.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ApiService {

    private final ApiInfoRepository apiInfoRepository;
    private final TagKeyRepository tagKeyRepository;
    private final AllowedValueRepository allowedValueRepository;
    private final ReportSampleRepository reportSampleRepository;
    private final ViolationRecordRepository violationRecordRepository;
    private final RepairSuggestionRepository repairSuggestionRepository;
    private final TagValidationEngine validationEngine;

    @Transactional
    public ApiInfo createApi(CreateApiRequest request) {
        if (apiInfoRepository.existsByRequestId(request.getRequestId())) {
            return apiInfoRepository.findByRequestId(request.getRequestId()).orElseThrow();
        }

        ApiInfo apiInfo = new ApiInfo();
        apiInfo.setRequestId(request.getRequestId());
        apiInfo.setApiName(request.getApiName());
        apiInfo.setApiPath(request.getApiPath());
        apiInfo.setApiMethod(request.getApiMethod());
        apiInfo.setServiceName(request.getServiceName());
        apiInfo.setDescription(request.getDescription());
        apiInfo.setCreatedBy(request.getCreatedBy());
        apiInfo.setStatus(ValidationStatus.PENDING);

        apiInfo = apiInfoRepository.save(apiInfo);

        if (request.getTagKeys() != null) {
            for (CreateApiRequest.TagKeyRequest tagKeyReq : request.getTagKeys()) {
                TagKey tagKey = new TagKey();
                tagKey.setKeyName(tagKeyReq.getKeyName());
                tagKey.setDescription(tagKeyReq.getDescription());
                tagKey.setRequired(tagKeyReq.getRequired());
                tagKey.setValuePattern(tagKeyReq.getValuePattern());
                tagKey.setApiInfo(apiInfo);
                tagKey = tagKeyRepository.save(tagKey);

                if (tagKeyReq.getAllowedValues() != null) {
                    for (String allowedValue : tagKeyReq.getAllowedValues()) {
                        AllowedValue av = new AllowedValue();
                        av.setValue(allowedValue);
                        av.setTagKey(tagKey);
                        allowedValueRepository.save(av);
                    }
                }
            }
        }

        return apiInfo;
    }

    public Optional<ApiInfo> findByRequestId(String requestId) {
        return apiInfoRepository.findByRequestId(requestId);
    }

    public List<ApiInfo> findAll() {
        return apiInfoRepository.findAll();
    }

    @Transactional
    public ValidationResultDto reportSample(ReportSampleRequest request) {
        ApiInfo apiInfo = apiInfoRepository.findByRequestId(request.getRequestId())
                .orElseThrow(() -> new IllegalArgumentException("API 不存在: " + request.getRequestId()));

        if (reportSampleRepository.existsBySampleId(request.getSampleId())) {
            ReportSample existingSample = reportSampleRepository.findBySampleId(request.getSampleId()).orElseThrow();
            return buildValidationResult(existingSample, apiInfo);
        }

        ReportSample sample = new ReportSample();
        sample.setSampleId(request.getSampleId());
        sample.setSource(request.getSource());
        sample.setTags(request.getTags());
        sample.setValidated(false);
        sample.setHasViolation(false);
        sample.setApiInfo(apiInfo);
        sample = reportSampleRepository.save(sample);

        ValidationResult validationResult = validationEngine.validate(apiInfo, request.getTags());

        sample.setValidated(true);
        sample.setHasViolation(!validationResult.isValid());
        reportSampleRepository.save(sample);

        for (ValidationResult.ViolationDetail violation : validationResult.getViolations()) {
            Optional<ViolationRecord> existingViolation = violationRecordRepository
                    .findByApiInfoIdAndViolationTypeAndTagKeyAndTagValue(
                            apiInfo.getId(),
                            violation.getType(),
                            violation.getTagKey(),
                            violation.getTagValue()
                    );

            ViolationRecord violationRecord;
            if (existingViolation.isPresent()) {
                violationRecord = existingViolation.get();
                violationRecord.setAggCount(violationRecord.getAggCount() + 1);
            } else {
                violationRecord = new ViolationRecord();
                violationRecord.setSampleId(request.getSampleId());
                violationRecord.setViolationType(violation.getType());
                violationRecord.setTagKey(violation.getTagKey());
                violationRecord.setTagValue(violation.getTagValue());
                violationRecord.setDetail(violation.getDetail());
                violationRecord.setResolved(false);
                violationRecord.setApiInfo(apiInfo);
            }
            violationRecord = violationRecordRepository.save(violationRecord);

            if (existingViolation.isEmpty() && violation.getSuggestion() != null) {
                RepairSuggestion suggestion = new RepairSuggestion();
                suggestion.setSuggestion(violation.getSuggestion());
                suggestion.setOperation(violation.getOperation());
                suggestion.setExpectedValue(violation.getExpectedValue());
                suggestion.setPriority(calculatePriority(violation.getType()));
                suggestion.setApplied(false);
                suggestion.setViolation(violationRecord);
                repairSuggestionRepository.save(suggestion);
            }
        }

        updateApiStatus(apiInfo);

        return buildValidationResult(sample, apiInfo);
    }

    private int calculatePriority(Enum<?> type) {
        return switch (type.name()) {
            case "MISSING_REQUIRED_TAG" -> 1;
            case "INVALID_TAG_VALUE" -> 2;
            case "UNKNOWN_TAG_KEY" -> 3;
            case "FORMAT_MISMATCH" -> 2;
            default -> 5;
        };
    }

    private void updateApiStatus(ApiInfo apiInfo) {
        long unresolvedCount = violationRecordRepository.findByApiInfoIdAndResolved(apiInfo.getId(), false).size();
        if (unresolvedCount > 0) {
            apiInfo.setStatus(ValidationStatus.INVALID);
        } else {
            apiInfo.setStatus(ValidationStatus.VALID);
        }
        apiInfoRepository.save(apiInfo);
    }

    private ValidationResultDto buildValidationResult(ReportSample sample, ApiInfo apiInfo) {
        ValidationResultDto dto = new ValidationResultDto();
        dto.setRequestId(apiInfo.getRequestId());
        dto.setSampleId(sample.getSampleId());
        dto.setValidated(sample.getValidated());
        dto.setValid(sample.getValidated() && !sample.getHasViolation());

        List<ViolationRecord> violations = violationRecordRepository.findBySampleId(sample.getSampleId());
        dto.setViolations(violations.stream().map(this::toViolationDto).toList());

        return dto;
    }

    private ValidationResultDto.ViolationDto toViolationDto(ViolationRecord record) {
        ValidationResultDto.ViolationDto dto = new ValidationResultDto.ViolationDto();
        dto.setViolationType(record.getViolationType().name());
        dto.setTagKey(record.getTagKey());
        dto.setTagValue(record.getTagValue());
        dto.setDetail(record.getDetail());
        dto.setResolved(record.getResolved());
        dto.setAggCount(record.getAggCount());

        if (record.getRepairSuggestion() != null) {
            ValidationResultDto.SuggestionDto suggestion = new ValidationResultDto.SuggestionDto();
            suggestion.setSuggestion(record.getRepairSuggestion().getSuggestion());
            suggestion.setOperation(record.getRepairSuggestion().getOperation());
            suggestion.setExpectedValue(record.getRepairSuggestion().getExpectedValue());
            suggestion.setPriority(record.getRepairSuggestion().getPriority());
            dto.setSuggestion(suggestion);
        }

        return dto;
    }

    public List<ReportSample> getSamplesByRequestId(String requestId) {
        ApiInfo apiInfo = apiInfoRepository.findByRequestId(requestId)
                .orElseThrow(() -> new IllegalArgumentException("API 不存在: " + requestId));
        return reportSampleRepository.findByApiInfoId(apiInfo.getId());
    }

    public List<ViolationRecord> getViolationsByRequestId(String requestId) {
        ApiInfo apiInfo = apiInfoRepository.findByRequestId(requestId)
                .orElseThrow(() -> new IllegalArgumentException("API 不存在: " + requestId));
        return violationRecordRepository.findByApiInfoId(apiInfo.getId());
    }

    @Transactional
    public ApiInfo advanceStatus(String requestId) {
        ApiInfo apiInfo = apiInfoRepository.findByRequestId(requestId)
                .orElseThrow(() -> new IllegalArgumentException("API 不存在: " + requestId));

        ValidationStatus currentStatus = apiInfo.getStatus();
        ValidationStatus nextStatus = switch (currentStatus) {
            case PENDING -> ValidationStatus.VALIDATING;
            case VALIDATING -> ValidationStatus.VALID;
            case INVALID -> ValidationStatus.FIXING;
            case FIXING -> ValidationStatus.FIXED;
            default -> currentStatus;
        };

        if (nextStatus != currentStatus) {
            apiInfo.setStatus(nextStatus);
            apiInfo = apiInfoRepository.save(apiInfo);
        }

        return apiInfo;
    }

    @Transactional
    public ApiInfo revoke(String requestId) {
        ApiInfo apiInfo = apiInfoRepository.findByRequestId(requestId)
                .orElseThrow(() -> new IllegalArgumentException("API 不存在: " + requestId));

        apiInfo.setStatus(ValidationStatus.REVOKED);
        return apiInfoRepository.save(apiInfo);
    }

    @Transactional
    public ViolationRecord resolveViolation(Long violationId) {
        ViolationRecord violation = violationRecordRepository.findById(violationId)
                .orElseThrow(() -> new IllegalArgumentException("违规记录不存在: " + violationId));
        violation.setResolved(true);
        violation = violationRecordRepository.save(violation);

        if (violation.getRepairSuggestion() != null) {
            violation.getRepairSuggestion().setApplied(true);
            repairSuggestionRepository.save(violation.getRepairSuggestion());
        }

        updateApiStatus(violation.getApiInfo());

        return violation;
    }

    public byte[] export(String requestId) {
        ApiInfo apiInfo = apiInfoRepository.findByRequestId(requestId)
                .orElseThrow(() -> new IllegalArgumentException("API 不存在: " + requestId));

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             OutputStreamWriter writer = new OutputStreamWriter(baos, StandardCharsets.UTF_8);
             CSVPrinter csvPrinter = new CSVPrinter(writer, CSVFormat.DEFAULT)) {

            csvPrinter.printRecord("API 信息导出");
            csvPrinter.printRecord("导出时间", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
            csvPrinter.printRecord();

            csvPrinter.printRecord("API 基本信息");
            csvPrinter.printRecord("Request ID", apiInfo.getRequestId());
            csvPrinter.printRecord("API 名称", apiInfo.getApiName());
            csvPrinter.printRecord("API 路径", apiInfo.getApiPath());
            csvPrinter.printRecord("API 方法", apiInfo.getApiMethod());
            csvPrinter.printRecord("服务名称", apiInfo.getServiceName());
            csvPrinter.printRecord("状态", apiInfo.getStatus().name());
            csvPrinter.printRecord();

            csvPrinter.printRecord("标签白名单");
            csvPrinter.printRecord("标签键", "是否必填", "值格式", "允许值", "描述");
            for (TagKey tagKey : tagKeyRepository.findByApiInfoId(apiInfo.getId())) {
                List<String> allowedValues = allowedValueRepository.findByTagKeyId(tagKey.getId())
                        .stream().map(AllowedValue::getValue).toList();
                csvPrinter.printRecord(
                        tagKey.getKeyName(),
                        tagKey.getRequired() ? "是" : "否",
                        tagKey.getValuePattern() != null ? tagKey.getValuePattern() : "",
                        String.join("; ", allowedValues),
                        tagKey.getDescription() != null ? tagKey.getDescription() : ""
                );
            }
            csvPrinter.printRecord();

            csvPrinter.printRecord("违规记录汇总");
            csvPrinter.printRecord("违规类型", "标签键", "标签值", "详情", "出现次数", "是否已解决");
            for (ViolationRecord violation : violationRecordRepository.findByApiInfoId(apiInfo.getId())) {
                csvPrinter.printRecord(
                        violation.getViolationType().name(),
                        violation.getTagKey() != null ? violation.getTagKey() : "",
                        violation.getTagValue() != null ? violation.getTagValue() : "",
                        violation.getDetail() != null ? violation.getDetail() : "",
                        violation.getAggCount(),
                        violation.getResolved() ? "是" : "否"
                );
            }

            csvPrinter.flush();
            return baos.toByteArray();

        } catch (Exception e) {
            log.error("导出失败", e);
            throw new RuntimeException("导出失败: " + e.getMessage());
        }
    }
}
