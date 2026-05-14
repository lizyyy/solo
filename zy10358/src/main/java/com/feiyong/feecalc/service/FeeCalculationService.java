package com.feiyong.feecalc.service;

import cn.hutool.core.util.IdUtil;
import com.alibaba.fastjson.JSON;
import com.feiyong.feecalc.dto.CalculateRequest;
import com.feiyong.feecalc.dto.CalculateResult;
import com.feiyong.feecalc.entity.*;
import com.feiyong.feecalc.enums.CalculationStatus;
import com.feiyong.feecalc.enums.DiscountType;
import com.feiyong.feecalc.repository.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class FeeCalculationService {

    @Autowired
    private CalculationRequestRepository requestRepository;

    @Autowired
    private PriceRuleRepository priceRuleRepository;

    @Autowired
    private DiscountItemRepository discountItemRepository;

    @Autowired
    private FeeDetailRepository feeDetailRepository;

    @Autowired
    private PriceLockCertificateRepository lockCertificateRepository;

    @Autowired
    private ExpirationStrategyRepository expirationStrategyRepository;

    @Autowired
    private TimelineService timelineService;

    @Transactional
    public CalculateResult createCalculation(CalculateRequest request) {
        String requestNo = generateRequestNo();
        log.info("创建费用试算请求, requestNo={}, bizType={}, bizNo={}", requestNo, request.getBizType(), request.getBizNo());

        if (requestRepository.existsByBizTypeAndBizNo(request.getBizType(), request.getBizNo())) {
            CalculationRequest existRequest = requestRepository.findByBizTypeAndBizNo(request.getBizType(), request.getBizNo()).get();
            log.warn("业务单号已存在, 返回已有的试算结果, requestNo={}", existRequest.getRequestNo());
            return buildResult(existRequest);
        }

        CalculationRequest calculationRequest = new CalculationRequest();
        calculationRequest.setRequestNo(requestNo);
        calculationRequest.setBizType(request.getBizType());
        calculationRequest.setBizNo(request.getBizNo());
        calculationRequest.setUserId(request.getUserId());
        calculationRequest.setRuleCode(request.getRuleCode());
        calculationRequest.setQuantity(request.getQuantity());
        calculationRequest.setDiscountCodes(request.getDiscountCodes() != null ? String.join(",", request.getDiscountCodes()) : null);
        calculationRequest.setExtraParams(request.getExtraParams() != null ? JSON.toJSONString(request.getExtraParams()) : null);

        ExpirationStrategy strategy = expirationStrategyRepository.findByStrategyCodeAndEnabledTrue(request.getExpirationStrategyCode())
                .orElseGet(() -> getDefaultStrategy());
        calculationRequest.setExpiredAt(LocalDateTime.now().plusMinutes(strategy.getTtlMinutes()));

        calculationRequest.setStatus(CalculationStatus.CREATED);
        requestRepository.save(calculationRequest);

        timelineService.recordAction(requestNo, "CREATE", "创建试算请求", null, calculationRequest, request.getOperator());

        return executeCalculation(calculationRequest, request.getOperator());
    }

    @Transactional
    public CalculateResult executeCalculation(CalculationRequest request, String operator) {
        log.info("执行费用试算, requestNo={}", request.getRequestNo());

        try {
            request.setStatus(CalculationStatus.CALCULATING);
            requestRepository.save(request);
            timelineService.recordAction(request.getRequestNo(), "CALCULATE_START", "开始试算", null, request, operator);

            PriceRule rule = priceRuleRepository.findByRuleCodeAndEnabledTrue(request.getRuleCode())
                    .orElseThrow(() -> new RuntimeException("价格规则不存在或已禁用: " + request.getRuleCode()));

            BigDecimal originalAmount = calculateOriginalAmount(rule, request.getQuantity());
            request.setOriginalAmount(originalAmount);

            List<FeeDetail> details = new ArrayList<>();
            FeeDetail baseDetail = new FeeDetail();
            baseDetail.setRequestNo(request.getRequestNo());
            baseDetail.setDetailName(rule.getRuleName());
            baseDetail.setDetailDesc("基础费用, 单价: " + rule.getUnitPrice() + " " + rule.getUnit());
            baseDetail.setAmount(originalAmount);
            baseDetail.setQuantity(request.getQuantity());
            baseDetail.setUnitPrice(rule.getUnitPrice());
            baseDetail.setRuleCode(rule.getRuleCode());
            baseDetail.setSortOrder(1);
            details.add(baseDetail);

            BigDecimal totalDiscount = BigDecimal.ZERO;
            if (request.getDiscountCodes() != null && !request.getDiscountCodes().isEmpty()) {
                List<String> discountCodes = Arrays.asList(request.getDiscountCodes().split(","));
                List<DiscountItem> discounts = discountItemRepository.findByDiscountCodeInAndEnabledTrue(discountCodes);
                discounts.sort(Comparator.comparing(DiscountItem::getPriority).reversed());

                int sortOrder = 2;
                for (DiscountItem discount : discounts) {
                    BigDecimal discountAmount = calculateDiscount(discount, originalAmount);
                    if (discountAmount.compareTo(BigDecimal.ZERO) > 0) {
                        totalDiscount = totalDiscount.add(discountAmount);
                        FeeDetail discountDetail = new FeeDetail();
                        discountDetail.setRequestNo(request.getRequestNo());
                        discountDetail.setDetailName(discount.getDiscountName());
                        discountDetail.setDetailDesc("折扣减免: " + discount.getDiscountType().getDescription());
                        discountDetail.setAmount(discountAmount.negate());
                        discountDetail.setDiscountCode(discount.getDiscountCode());
                        discountDetail.setSortOrder(sortOrder++);
                        details.add(discountDetail);
                    }
                }
            }

            request.setDiscountAmount(totalDiscount);
            request.setFinalAmount(originalAmount.subtract(totalDiscount).max(BigDecimal.ZERO));
            request.setStatus(CalculationStatus.SUCCESS);
            requestRepository.save(request);

            feeDetailRepository.deleteByRequestNo(request.getRequestNo());
            feeDetailRepository.saveAll(details);

            timelineService.recordAction(request.getRequestNo(), "CALCULATE_SUCCESS", "试算成功", null, request, operator);

            return buildResult(request);

        } catch (Exception e) {
            log.error("试算失败, requestNo={}", request.getRequestNo(), e);
            request.setStatus(CalculationStatus.FAILED);
            request.setErrorMessage(e.getMessage());
            requestRepository.save(request);
            timelineService.recordAction(request.getRequestNo(), "CALCULATE_FAILED", "试算失败", null, e.getMessage(), operator);
            throw new RuntimeException("试算失败: " + e.getMessage(), e);
        }
    }

    private BigDecimal calculateOriginalAmount(PriceRule rule, BigDecimal quantity) {
        BigDecimal basePrice = rule.getBasePrice() != null ? rule.getBasePrice() : BigDecimal.ZERO;
        BigDecimal unitPrice = rule.getUnitPrice() != null ? rule.getUnitPrice() : BigDecimal.ZERO;
        return basePrice.add(unitPrice.multiply(quantity)).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateDiscount(DiscountItem discount, BigDecimal baseAmount) {
        if (discount.getMinAmount() != null && baseAmount.compareTo(discount.getMinAmount()) < 0) {
            return BigDecimal.ZERO;
        }

        BigDecimal discountAmount = BigDecimal.ZERO;
        if (discount.getDiscountType() == DiscountType.PERCENTAGE && discount.getPercentage() != null) {
            discountAmount = baseAmount.multiply(discount.getPercentage()).divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
        } else if (discount.getDiscountType() == DiscountType.FIXED_AMOUNT && discount.getFixedAmount() != null) {
            discountAmount = discount.getFixedAmount();
        }

        if (discount.getMaxDiscount() != null && discountAmount.compareTo(discount.getMaxDiscount()) > 0) {
            discountAmount = discount.getMaxDiscount();
        }

        return discountAmount;
    }

    @Transactional
    public PriceLockCertificate lockPrice(String requestNo, String operator) {
        log.info("锁价, requestNo={}", requestNo);

        CalculationRequest request = requestRepository.findByRequestNo(requestNo)
                .orElseThrow(() -> new RuntimeException("试算请求不存在: " + requestNo));

        if (request.getStatus() != CalculationStatus.SUCCESS) {
            throw new RuntimeException("只有试算成功的请求才能锁价, 当前状态: " + request.getStatus());
        }

        if (lockCertificateRepository.existsByRequestNoAndValidTrue(requestNo)) {
            log.warn("该请求已有有效锁价凭证, requestNo={}", requestNo);
            return lockCertificateRepository.findByRequestNoAndValidTrue(requestNo).get();
        }

        PriceLockCertificate certificate = new PriceLockCertificate();
        certificate.setCertificateNo(generateCertificateNo());
        certificate.setRequestNo(requestNo);
        certificate.setLockedAmount(request.getFinalAmount());
        certificate.setLockedAt(LocalDateTime.now());
        certificate.setExpiredAt(request.getExpiredAt());
        lockCertificateRepository.save(certificate);

        request.setStatus(CalculationStatus.LOCKED);
        requestRepository.save(request);

        timelineService.recordAction(requestNo, "LOCK_PRICE", "价格锁定", null, certificate, operator);

        return certificate;
    }

    @Transactional
    public boolean validateCertificate(String certificateNo) {
        log.info("校验锁价凭证, certificateNo={}", certificateNo);

        PriceLockCertificate certificate = lockCertificateRepository.findByCertificateNo(certificateNo)
                .orElseThrow(() -> new RuntimeException("锁价凭证不存在: " + certificateNo));

        if (!certificate.getValid()) {
            log.warn("锁价凭证已失效, certificateNo={}", certificateNo);
            return false;
        }

        if (certificate.getExpiredAt().isBefore(LocalDateTime.now())) {
            log.warn("锁价凭证已过期, certificateNo={}, expiredAt={}", certificateNo, certificate.getExpiredAt());
            certificate.setValid(false);
            lockCertificateRepository.save(certificate);

            CalculationRequest request = requestRepository.findByRequestNo(certificate.getRequestNo()).orElse(null);
            if (request != null) {
                request.setStatus(CalculationStatus.EXPIRED);
                requestRepository.save(request);
            }
            return false;
        }

        return true;
    }

    @Transactional
    public void charge(String certificateNo, String operator) {
        log.info("扣费, certificateNo={}", certificateNo);

        if (!validateCertificate(certificateNo)) {
            throw new RuntimeException("锁价凭证无效或已过期");
        }

        PriceLockCertificate certificate = lockCertificateRepository.findByCertificateNo(certificateNo).get();
        certificate.setValid(false);
        certificate.setChargedBy(operator);
        certificate.setChargedAt(LocalDateTime.now());
        lockCertificateRepository.save(certificate);

        CalculationRequest request = requestRepository.findByRequestNo(certificate.getRequestNo()).get();
        request.setStatus(CalculationStatus.CHARGED);
        requestRepository.save(request);

        timelineService.recordAction(certificate.getRequestNo(), "CHARGE", "扣费完成", null, certificate, operator);
    }

    public CalculateResult getResult(String requestNo) {
        CalculationRequest request = requestRepository.findByRequestNo(requestNo)
                .orElseThrow(() -> new RuntimeException("试算请求不存在: " + requestNo));
        return buildResult(request);
    }

    private CalculateResult buildResult(CalculationRequest request) {
        CalculateResult result = new CalculateResult();
        result.setRequestNo(request.getRequestNo());
        result.setStatus(request.getStatus().name());
        result.setStatusDesc(request.getStatus().getDescription());
        result.setOriginalAmount(request.getOriginalAmount());
        result.setDiscountAmount(request.getDiscountAmount());
        result.setFinalAmount(request.getFinalAmount());
        result.setExpiredAt(request.getExpiredAt());
        result.setErrorMessage(request.getErrorMessage());

        if (request.getStatus() == CalculationStatus.LOCKED || request.getStatus() == CalculationStatus.CHARGED) {
            lockCertificateRepository.findByRequestNoAndValidTrue(request.getRequestNo())
                    .ifPresent(cert -> result.setCertificateNo(cert.getCertificateNo()));
        }

        if (request.getStatus() == CalculationStatus.SUCCESS || request.getStatus() == CalculationStatus.LOCKED || request.getStatus() == CalculationStatus.CHARGED) {
            List<FeeDetail> details = feeDetailRepository.findByRequestNoOrderBySortOrder(request.getRequestNo());
            result.setDetails(details.stream().map(d -> {
                com.feiyong.feecalc.dto.FeeDetailVo vo = new com.feiyong.feecalc.dto.FeeDetailVo();
                vo.setName(d.getDetailName());
                vo.setDesc(d.getDetailDesc());
                vo.setAmount(d.getAmount());
                return vo;
            }).collect(Collectors.toList()));
        }

        return result;
    }

    private ExpirationStrategy getDefaultStrategy() {
        ExpirationStrategy strategy = new ExpirationStrategy();
        strategy.setTtlMinutes(30);
        return strategy;
    }

    private String generateRequestNo() {
        return "FEE" + IdUtil.getSnowflakeNextIdStr();
    }

    private String generateCertificateNo() {
        return "LOCK" + IdUtil.getSnowflakeNextIdStr();
    }
}
