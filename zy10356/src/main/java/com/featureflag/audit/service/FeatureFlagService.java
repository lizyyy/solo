package com.featureflag.audit.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.featureflag.audit.dto.EvaluateRequest;
import com.featureflag.audit.dto.EvaluateResponse;
import com.featureflag.audit.dto.UserAttributes;
import com.featureflag.audit.entity.*;
import com.featureflag.audit.exception.DuplicateRequestException;
import com.featureflag.audit.exception.ExperimentNotFoundException;
import com.featureflag.audit.repository.AuditRecordRepository;
import com.featureflag.audit.repository.ExperimentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class FeatureFlagService {
    private final ExperimentRepository experimentRepository;
    private final AuditRecordRepository auditRecordRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public EvaluateResponse evaluate(EvaluateRequest request) {
        if (auditRecordRepository.existsByRequestId(request.getRequestId())) {
            AuditRecord existingRecord = auditRecordRepository.findByRequestId(request.getRequestId()).orElseThrow();
            throw new DuplicateRequestException("重复请求: " + request.getRequestId() + "，当前状态: " + existingRecord.getStatus());
        }

        AuditRecord auditRecord = new AuditRecord();
        auditRecord.setRequestId(request.getRequestId());
        auditRecord.setExperimentKey(request.getExperimentKey());
        auditRecord.setUserIdentifier(request.getUserIdentifier());
        auditRecord.setStatus(AuditRecord.AuditStatus.PENDING);

        try {
            String userAttributesJson = objectMapper.writeValueAsString(request.getUserAttributes());
            auditRecord.setUserAttributes(userAttributesJson);
        } catch (JsonProcessingException e) {
            log.warn("序列化用户属性失败", e);
        }

        auditRecord = auditRecordRepository.save(auditRecord);

        try {
            Experiment experiment = experimentRepository.findByExperimentKey(request.getExperimentKey())
                    .orElseThrow(() -> new ExperimentNotFoundException("实验不存在: " + request.getExperimentKey()));

            if (!experiment.getEnabled()) {
                return buildResponse(auditRecord, AuditRecord.HitResult.MISS, "实验未启用", null, null);
            }

            if (experiment.getStatus() != Experiment.ExperimentStatus.RUNNING) {
                return buildResponse(auditRecord, AuditRecord.HitResult.MISS, "实验未运行", null, null);
            }

            Optional<OverrideReason> overrideOpt = checkOverride(experiment, request.getUserIdentifier());
            if (overrideOpt.isPresent()) {
                OverrideReason override = overrideOpt.get();
                auditRecord.setOverrideReason(override.getReason());
                auditRecord.setOverrideType(override.getOverrideType().name());
                return buildResponse(auditRecord, AuditRecord.HitResult.OVERRIDDEN,
                        "命中覆盖规则", override.getForcedBucketKey(), getBucketValue(experiment, override.getForcedBucketKey()));
            }

            if (!isInTraffic(experiment, request.getUserIdentifier())) {
                return buildResponse(auditRecord, AuditRecord.HitResult.NOT_IN_TRAFFIC, "不在流量范围内", null, null);
            }

            List<HitRule> matchedRules = matchRules(experiment, request.getUserAttributes());
            if (matchedRules.isEmpty()) {
                return buildResponse(auditRecord, AuditRecord.HitResult.MISS, "未命中任何规则", null, null);
            }
            auditRecord.setMatchedRules(matchedRules.stream()
                    .map(r -> r.getAttributeName() + ":" + r.getOperator())
                    .collect(Collectors.joining(",")));

            String bucketKey = calculateBucket(experiment, request.getUserIdentifier());
            String bucketValue = getBucketValue(experiment, bucketKey);
            auditRecord.setBucketKey(bucketKey);
            auditRecord.setBucketValue(bucketValue);

            return buildResponse(auditRecord, AuditRecord.HitResult.HIT, "命中成功", bucketKey, bucketValue);

        } catch (ExperimentNotFoundException e) {
            return buildErrorResponse(auditRecord, e.getMessage());
        } catch (Exception e) {
            log.error("评估特征开关失败", e);
            return buildErrorResponse(auditRecord, "系统内部错误: " + e.getMessage());
        }
    }

    private Optional<OverrideReason> checkOverride(Experiment experiment, String userIdentifier) {
        return experiment.getOverrides().stream()
                .filter(o -> o.getEnabled())
                .filter(o -> o.getUserIdentifier().equals(userIdentifier))
                .filter(o -> o.getExpireTime() == null || o.getExpireTime().isAfter(LocalDateTime.now()))
                .findFirst();
    }

    private boolean isInTraffic(Experiment experiment, String userIdentifier) {
        int hash = Math.abs((userIdentifier + experiment.getSalt()).hashCode());
        int bucket = hash % 100;
        return bucket < experiment.getTrafficPercentage();
    }

    private List<HitRule> matchRules(Experiment experiment, UserAttributes userAttributes) {
        Map<String, String> attrMap = buildAttributeMap(userAttributes);
        return experiment.getRules().stream()
                .filter(HitRule::getEnabled)
                .filter(rule -> evaluateRule(rule, attrMap))
                .sorted(Comparator.comparing(HitRule::getPriority).reversed())
                .collect(Collectors.toList());
    }

    private Map<String, String> buildAttributeMap(UserAttributes userAttributes) {
        Map<String, String> map = new HashMap<>();
        map.put("userId", userAttributes.getUserId());
        map.put("deviceId", userAttributes.getDeviceId());
        map.put("sessionId", userAttributes.getSessionId());
        map.put("country", userAttributes.getCountry());
        map.put("region", userAttributes.getRegion());
        map.put("city", userAttributes.getCity());
        map.put("os", userAttributes.getOs());
        map.put("appVersion", userAttributes.getAppVersion());
        map.put("userSegment", userAttributes.getUserSegment());
        map.put("age", userAttributes.getAge() != null ? String.valueOf(userAttributes.getAge()) : null);
        map.put("gender", userAttributes.getGender());
        if (userAttributes.getCustomAttributes() != null) {
            map.putAll(userAttributes.getCustomAttributes());
        }
        return map;
    }

    private boolean evaluateRule(HitRule rule, Map<String, String> userAttributes) {
        String attributeValue = userAttributes.get(rule.getAttributeName());
        if (attributeValue == null) {
            return false;
        }

        String ruleValue = rule.getAttributeValue();
        HitRule.Operator operator = rule.getOperator();

        return switch (operator) {
            case EQUALS -> attributeValue.equals(ruleValue);
            case NOT_EQUALS -> !attributeValue.equals(ruleValue);
            case CONTAINS -> attributeValue.contains(ruleValue);
            case NOT_CONTAINS -> !attributeValue.contains(ruleValue);
            case GREATER_THAN -> compareNumeric(attributeValue, ruleValue) > 0;
            case LESS_THAN -> compareNumeric(attributeValue, ruleValue) < 0;
            case GREATER_THAN_OR_EQUAL -> compareNumeric(attributeValue, ruleValue) >= 0;
            case LESS_THAN_OR_EQUAL -> compareNumeric(attributeValue, ruleValue) <= 0;
            case IN -> Arrays.asList(ruleValue.split(",")).contains(attributeValue);
            case NOT_IN -> !Arrays.asList(ruleValue.split(",")).contains(attributeValue);
            case REGEX -> attributeValue.matches(ruleValue);
        };
    }

    private int compareNumeric(String attrValue, String ruleValue) {
        try {
            double attrNum = Double.parseDouble(attrValue);
            double ruleNum = Double.parseDouble(ruleValue);
            return Double.compare(attrNum, ruleNum);
        } catch (NumberFormatException e) {
            return attrValue.compareTo(ruleValue);
        }
    }

    private String calculateBucket(Experiment experiment, String userIdentifier) {
        try {
            String input = userIdentifier + experiment.getSalt();
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            long hash = 0;
            for (int i = 0; i < 8; i++) {
                hash = (hash << 8) | (digest[i] & 0xff);
            }
            hash = Math.abs(hash);

            int totalWeight = experiment.getBuckets().stream()
                    .filter(BucketValue::getEnabled)
                    .mapToInt(BucketValue::getWeight)
                    .sum();

            long bucketPosition = hash % totalWeight;
            long currentWeight = 0;

            for (BucketValue bucket : experiment.getBuckets()) {
                if (!bucket.getEnabled()) continue;
                currentWeight += bucket.getWeight();
                if (bucketPosition < currentWeight) {
                    return bucket.getBucketKey();
                }
            }

            return experiment.getBuckets().stream()
                    .filter(BucketValue::getEnabled)
                    .findFirst()
                    .map(BucketValue::getBucketKey)
                    .orElse("default");

        } catch (NoSuchAlgorithmException e) {
            log.error("分桶算法错误", e);
            return "default";
        }
    }

    private String getBucketValue(Experiment experiment, String bucketKey) {
        return experiment.getBuckets().stream()
                .filter(b -> b.getBucketKey().equals(bucketKey))
                .findFirst()
                .map(BucketValue::getValue)
                .orElse(null);
    }

    private EvaluateResponse buildResponse(AuditRecord auditRecord, AuditRecord.HitResult hitResult,
                                           String message, String bucketKey, String bucketValue) {
        auditRecord.setHitResult(hitResult);
        auditRecord.setBucketKey(bucketKey);
        auditRecord.setBucketValue(bucketValue);
        auditRecord.setStatus(AuditRecord.AuditStatus.SUCCESS);
        auditRecordRepository.save(auditRecord);

        EvaluateResponse response = new EvaluateResponse();
        response.setRequestId(auditRecord.getRequestId());
        response.setExperimentKey(auditRecord.getExperimentKey());
        response.setUserIdentifier(auditRecord.getUserIdentifier());
        response.setBucketKey(bucketKey);
        response.setBucketValue(bucketValue);
        response.setHitResult(hitResult.name());
        response.setOverrideReason(auditRecord.getOverrideReason());
        response.setOverrideType(auditRecord.getOverrideType());
        response.setSuccess(true);
        response.setMessage(message);
        return response;
    }

    private EvaluateResponse buildErrorResponse(AuditRecord auditRecord, String errorMessage) {
        auditRecord.setHitResult(AuditRecord.HitResult.ERROR);
        auditRecord.setStatus(AuditRecord.AuditStatus.FAILED);
        auditRecord.setErrorMessage(errorMessage);
        auditRecordRepository.save(auditRecord);

        EvaluateResponse response = new EvaluateResponse();
        response.setRequestId(auditRecord.getRequestId());
        response.setExperimentKey(auditRecord.getExperimentKey());
        response.setUserIdentifier(auditRecord.getUserIdentifier());
        response.setHitResult(AuditRecord.HitResult.ERROR.name());
        response.setSuccess(false);
        response.setMessage(errorMessage);
        return response;
    }

    @Transactional
    public AuditRecord compensate(Long auditId, String compensatedBy) {
        AuditRecord record = auditRecordRepository.findById(auditId)
                .orElseThrow(() -> new IllegalArgumentException("审计记录不存在: " + auditId));

        if (record.getStatus() == AuditRecord.AuditStatus.COMPENSATED) {
            throw new IllegalStateException("该记录已补偿");
        }

        record.setStatus(AuditRecord.AuditStatus.COMPENSATED);
        record.setCompensatedAt(LocalDateTime.now());
        record.setCompensatedBy(compensatedBy);
        return auditRecordRepository.save(record);
    }

    public List<AuditRecord> getFailedRecords() {
        return auditRecordRepository.findByStatusAndCreatedAtBefore(
                AuditRecord.AuditStatus.FAILED, LocalDateTime.now());
    }
}
