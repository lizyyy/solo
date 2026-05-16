package com.dns.preplay.service;

import com.dns.preplay.exception.DuplicatePreplayNameException;
import com.dns.preplay.exception.InvalidStatusTransitionException;
import com.dns.preplay.exception.PreplayNotFoundException;
import com.dns.preplay.model.dto.*;
import com.dns.preplay.model.entity.DiffResult;
import com.dns.preplay.model.entity.DnsPreplay;
import com.dns.preplay.model.entity.DnsRecord;
import com.dns.preplay.model.enums.PreplayStatus;
import com.dns.preplay.model.enums.RiskLevel;
import com.dns.preplay.repository.DiffResultRepository;
import com.dns.preplay.repository.DnsPreplayRepository;
import com.dns.preplay.repository.DnsRecordRepository;
import com.dns.preplay.util.DtoConverter;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DnsPreplayService {

    private final DnsPreplayRepository preplayRepository;
    private final DnsRecordRepository recordRepository;
    private final DiffResultRepository diffResultRepository;
    private final ObjectMapper objectMapper;

    private static final Set<PreplayStatus> VALID_FROM_CREATED = Set.of(
            PreplayStatus.DIFF_CALCULATED, PreplayStatus.FAILED
    );
    private static final Set<PreplayStatus> VALID_FROM_DIFF_CALCULATED = Set.of(
            PreplayStatus.TTL_CHECKED, PreplayStatus.FAILED
    );
    private static final Set<PreplayStatus> VALID_FROM_TTL_CHECKED = Set.of(
            PreplayStatus.READY_FOR_SWITCH, PreplayStatus.FAILED
    );
    private static final Set<PreplayStatus> VALID_FROM_READY_FOR_SWITCH = Set.of(
            PreplayStatus.SWITCH_CONFIRMED, PreplayStatus.FAILED, PreplayStatus.ROLLBACK_RECORDED
    );
    private static final Set<PreplayStatus> VALID_FROM_SWITCH_CONFIRMED = Set.of(
            PreplayStatus.ROLLBACK_RECORDED, PreplayStatus.COMPLETED, PreplayStatus.FAILED
    );
    private static final Set<PreplayStatus> VALID_FROM_ROLLBACK_RECORDED = Set.of(
            PreplayStatus.COMPLETED, PreplayStatus.FAILED
    );

    @Transactional
    public PreplayResponse createPreplay(CreatePreplayRequest request) {
        if (preplayRepository.existsByPreplayName(request.getPreplayName())) {
            throw new DuplicatePreplayNameException(request.getPreplayName());
        }

        String originalRequestJson;
        try {
            originalRequestJson = objectMapper.writeValueAsString(request);
        } catch (JsonProcessingException e) {
            originalRequestJson = request.toString();
        }

        DnsPreplay preplay = DnsPreplay.builder()
                .preplayName(request.getPreplayName())
                .description(request.getDescription())
                .createdBy(request.getCreatedBy())
                .status(PreplayStatus.CREATED)
                .originalRequest(originalRequestJson)
                .build();

        for (DnsRecordDTO recordDTO : request.getRecords()) {
            DnsRecord record = DtoConverter.toRecordEntity(recordDTO);
            if (record.getOriginalInput() == null) {
                try {
                    record.setOriginalInput(objectMapper.writeValueAsString(recordDTO));
                } catch (JsonProcessingException e) {
                    record.setOriginalInput(recordDTO.toString());
                }
            }
            preplay.addRecord(record);
        }

        DnsPreplay saved = preplayRepository.save(preplay);
        log.info("创建DNS预演成功: id={}, name={}", saved.getId(), saved.getPreplayName());
        return DtoConverter.toPreplayResponse(saved);
    }

    @Transactional(readOnly = true)
    public PreplayResponse getPreplay(Long id) {
        DnsPreplay preplay = preplayRepository.findById(id)
                .orElseThrow(() -> new PreplayNotFoundException(id));
        return DtoConverter.toPreplayResponse(preplay);
    }

    @Transactional(readOnly = true)
    public List<PreplayResponse> getAllPreplays() {
        return preplayRepository.findAll().stream()
                .map(DtoConverter::toPreplayResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PreplayResponse getPreplayByName(String name) {
        DnsPreplay preplay = preplayRepository.findByPreplayName(name)
                .orElseThrow(() -> new PreplayNotFoundException(name));
        return DtoConverter.toPreplayResponse(preplay);
    }

    @Transactional
    public PreplayResponse calculateDiff(Long preplayId) {
        DnsPreplay preplay = preplayRepository.findById(preplayId)
                .orElseThrow(() -> new PreplayNotFoundException(preplayId));

        diffResultRepository.deleteByPreplayId(preplayId);
        preplay.getDiffResults().clear();

        for (DnsRecord record : preplay.getRecords()) {
            DiffResult diff = calculateRecordDiff(record);
            preplay.addDiffResult(diff);
        }

        preplay.setStatus(PreplayStatus.DIFF_CALCULATED);
        DnsPreplay saved = preplayRepository.save(preplay);
        log.info("DNS预演差异计算完成: id={}", preplayId);
        return DtoConverter.toPreplayResponse(saved);
    }

    private DiffResult calculateRecordDiff(DnsRecord record) {
        boolean hasDiff = record.getNewTarget() != null
                && !record.getNewTarget().equals(record.getOldTarget());

        String diffDesc = null;
        if (hasDiff) {
            diffDesc = String.format("目标地址不一致: 旧值=%s, 新值=%s",
                    record.getOldTarget(), record.getNewTarget());
        }

        return DiffResult.builder()
                .domainName(record.getDomainName())
                .recordType(record.getRecordType())
                .expectedTarget(record.getNewTarget())
                .actualTarget(record.getOldTarget())
                .hasDifference(hasDiff)
                .differenceDescription(diffDesc)
                .build();
    }

    @Transactional
    public PreplayResponse checkTtlRisk(Long preplayId) {
        DnsPreplay preplay = preplayRepository.findById(preplayId)
                .orElseThrow(() -> new PreplayNotFoundException(preplayId));

        List<DiffResult> diffResults = diffResultRepository.findByPreplayId(preplayId);
        Map<String, DiffResult> diffMap = diffResults.stream()
                .collect(Collectors.toMap(
                        d -> d.getDomainName() + "_" + d.getRecordType(),
                        d -> d
                ));

        RiskLevel overallRisk = RiskLevel.LOW;

        for (DnsRecord record : preplay.getRecords()) {
            String key = record.getDomainName() + "_" + record.getRecordType();
            DiffResult diff = diffMap.get(key);
            if (diff != null) {
                evaluateRecordTtlRisk(record, diff);
                if (diff.getTtlRiskLevel().ordinal() > overallRisk.ordinal()) {
                    overallRisk = diff.getTtlRiskLevel();
                }
            }
        }

        diffResultRepository.saveAll(diffResults);
        preplay.setOverallRiskLevel(overallRisk);
        preplay.setStatus(PreplayStatus.TTL_CHECKED);
        preplay.setConclusion(generateConclusion(overallRisk, diffResults));

        DnsPreplay saved = preplayRepository.save(preplay);
        log.info("DNS预演TTL风险检查完成: id={}, 整体风险={}", preplayId, overallRisk);
        return DtoConverter.toPreplayResponse(saved);
    }

    private void evaluateRecordTtlRisk(DnsRecord record, DiffResult diff) {
        int ttl = record.getTtl();
        int expectedTtl = record.getExpectedTtl() != null ? record.getExpectedTtl() : 300;

        diff.setExpectedTtl(expectedTtl);
        diff.setActualTtl(ttl);

        if (ttl > 3600) {
            diff.setTtlRiskLevel(RiskLevel.HIGH);
            diff.setTtlRiskReason("TTL超过1小时，切换后缓存生效慢");
        } else if (ttl > 600) {
            diff.setTtlRiskLevel(RiskLevel.MEDIUM);
            diff.setTtlRiskReason("TTL超过10分钟，建议降低");
        } else if (ttl > expectedTtl) {
            diff.setTtlRiskLevel(RiskLevel.LOW);
            diff.setTtlRiskReason("TTL高于预期值，建议检查");
        } else {
            diff.setTtlRiskLevel(RiskLevel.LOW);
            diff.setTtlRiskReason("TTL在合理范围内");
        }
    }

    private String generateConclusion(RiskLevel overallRisk, List<DiffResult> diffResults) {
        long diffCount = diffResults.stream().filter(DiffResult::getHasDifference).count();
        long highRiskCount = diffResults.stream()
                .filter(d -> d.getTtlRiskLevel() == RiskLevel.HIGH || d.getTtlRiskLevel() == RiskLevel.CRITICAL)
                .count();

        StringBuilder sb = new StringBuilder();
        sb.append("预演结论: ");

        if (overallRisk == RiskLevel.LOW && diffCount == 0) {
            sb.append("可以安全切换");
        } else if (diffCount > 0) {
            sb.append(String.format("存在%d条记录差异，", diffCount));
        }

        if (highRiskCount > 0) {
            sb.append(String.format("存在%d条高风险TTL记录，建议先降低TTL后再切换", highRiskCount));
        } else if (overallRisk == RiskLevel.MEDIUM) {
            sb.append("存在中等风险，建议确认后切换");
        }

        return sb.toString();
    }

    @Transactional
    public PreplayResponse updateStatus(Long preplayId, StatusUpdateRequest request) {
        DnsPreplay preplay = preplayRepository.findById(preplayId)
                .orElseThrow(() -> new PreplayNotFoundException(preplayId));

        PreplayStatus current = preplay.getStatus();
        PreplayStatus target = request.getTargetStatus();

        validateStatusTransition(current, target);
        preplay.setStatus(target);

        if (target == PreplayStatus.COMPLETED) {
            preplay.setCompletedAt(LocalDateTime.now());
        }

        if (target == PreplayStatus.ROLLBACK_RECORDED) {
            preplay.setRollbackNotes(request.getComment() != null ? request.getComment() : "已记录回滚信息");
        }

        DnsPreplay saved = preplayRepository.save(preplay);
        log.info("DNS预演状态更新: id={}, {} -> {}", preplayId, current, target);
        return DtoConverter.toPreplayResponse(saved);
    }

    private void validateStatusTransition(PreplayStatus current, PreplayStatus target) {
        Set<PreplayStatus> validTargets;
        switch (current) {
            case CREATED:
                validTargets = VALID_FROM_CREATED;
                break;
            case DIFF_CALCULATED:
                validTargets = VALID_FROM_DIFF_CALCULATED;
                break;
            case TTL_CHECKED:
                validTargets = VALID_FROM_TTL_CHECKED;
                break;
            case READY_FOR_SWITCH:
                validTargets = VALID_FROM_READY_FOR_SWITCH;
                break;
            case SWITCH_CONFIRMED:
                validTargets = VALID_FROM_SWITCH_CONFIRMED;
                break;
            case ROLLBACK_RECORDED:
                validTargets = VALID_FROM_ROLLBACK_RECORDED;
                break;
            default:
                validTargets = Set.of();
        }

        if (!validTargets.contains(target)) {
            throw new InvalidStatusTransitionException(current, target);
        }
    }

    @Transactional
    public PreplayResponse applyManualCorrection(Long preplayId, ManualCorrectionRequest request) {
        DnsPreplay preplay = preplayRepository.findById(preplayId)
                .orElseThrow(() -> new PreplayNotFoundException(preplayId));

        Map<String, DnsRecord> existingRecords = preplay.getRecords().stream()
                .collect(Collectors.toMap(
                        r -> r.getDomainName() + "_" + r.getRecordType(),
                        r -> r
                ));

        for (DnsRecordDTO correctedDTO : request.getCorrectedRecords()) {
            String key = correctedDTO.getDomainName() + "_" + correctedDTO.getRecordType();
            DnsRecord existing = existingRecords.get(key);

            if (existing != null) {
                existing.setOldTarget(correctedDTO.getOldTarget());
                existing.setNewTarget(correctedDTO.getNewTarget());
                existing.setTtl(correctedDTO.getTtl());
                existing.setExpectedTtl(correctedDTO.getExpectedTtl());
                existing.setTtlStrategy(correctedDTO.getTtlStrategy());
                existing.setIsManualCorrected(true);
                existing.setComment(request.getCorrectionReason());
            }
        }

        preplay.setStatus(PreplayStatus.CREATED);
        preplay.getDiffResults().clear();

        DnsPreplay saved = preplayRepository.save(preplay);
        log.info("DNS预演人工修正完成，已重置状态: id={}", preplayId);
        return DtoConverter.toPreplayResponse(saved);
    }

    @Transactional(readOnly = true)
    public String exportPreplayReport(Long preplayId) {
        PreplayResponse preplay = getPreplay(preplayId);

        StringBuilder report = new StringBuilder();
        report.append("=".repeat(80)).append("\n");
        report.append("DNS切换预演报告\n");
        report.append("=".repeat(80)).append("\n");
        report.append("预演名称: ").append(preplay.getPreplayName()).append("\n");
        report.append("预演状态: ").append(preplay.getStatus()).append("\n");
        report.append("整体风险: ").append(preplay.getOverallRiskLevel()).append("\n");
        report.append("创建时间: ").append(preplay.getCreatedAt()).append("\n");
        report.append("预演结论: ").append(preplay.getConclusion() != null ? preplay.getConclusion() : "暂无").append("\n");
        report.append("\n").append("-".repeat(80)).append("\n");
        report.append("DNS记录详情:\n");
        report.append("-".repeat(80)).append("\n");

        for (DnsRecordDTO record : preplay.getRecords()) {
            report.append(String.format("域名: %s (%s)\n", record.getDomainName(), record.getRecordType()));
            report.append(String.format("  旧目标: %s\n", record.getOldTarget() != null ? record.getOldTarget() : "无"));
            report.append(String.format("  新目标: %s\n", record.getNewTarget() != null ? record.getNewTarget() : "无"));
            report.append(String.format("  TTL: %d秒\n", record.getTtl()));
            report.append(String.format("  人工修正: %s\n", record.getIsManualCorrected() ? "是" : "否"));
            report.append("\n");
        }

        if (!preplay.getDiffResults().isEmpty()) {
            report.append("-".repeat(80)).append("\n");
            report.append("差异检查结果:\n");
            report.append("-".repeat(80)).append("\n");

            for (DiffResultDTO diff : preplay.getDiffResults()) {
                report.append(String.format("域名: %s (%s)\n", diff.getDomainName(), diff.getRecordType()));
                report.append(String.format("  存在差异: %s\n", diff.getHasDifference() ? "是" : "否"));
                if (diff.getDifferenceDescription() != null) {
                    report.append(String.format("  差异描述: %s\n", diff.getDifferenceDescription()));
                }
                report.append(String.format("  TTL风险等级: %s\n", diff.getTtlRiskLevel()));
                if (diff.getTtlRiskReason() != null) {
                    report.append(String.format("  TTL风险原因: %s\n", diff.getTtlRiskReason()));
                }
                report.append("\n");
            }
        }

        report.append("=".repeat(80)).append("\n");
        report.append("回滚记录: ").append(preplay.getRollbackNotes() != null ? preplay.getRollbackNotes() : "无").append("\n");
        report.append("=".repeat(80)).append("\n");

        return report.toString();
    }

    @Transactional
    public void deletePreplay(Long preplayId) {
        if (!preplayRepository.existsById(preplayId)) {
            throw new PreplayNotFoundException(preplayId);
        }
        preplayRepository.deleteById(preplayId);
        log.info("删除DNS预演: id={}", preplayId);
    }
}
