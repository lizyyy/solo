package com.feiyong.feecalc.service;

import com.alibaba.fastjson.JSON;
import com.feiyong.feecalc.dto.DiagnosisSummary;
import com.feiyong.feecalc.dto.FeeDetailVo;
import com.feiyong.feecalc.entity.*;
import com.feiyong.feecalc.repository.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class DiagnosisService {

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
    private ActionTimelineRepository timelineRepository;

    public DiagnosisSummary generateDiagnosis(String requestNo) {
        log.info("生成问题排查汇总, requestNo={}", requestNo);

        CalculationRequest request = requestRepository.findByRequestNo(requestNo)
                .orElseThrow(() -> new RuntimeException("试算请求不存在: " + requestNo));

        DiagnosisSummary summary = new DiagnosisSummary();
        summary.setRequestNo(request.getRequestNo());
        summary.setBizType(request.getBizType());
        summary.setBizNo(request.getBizNo());
        summary.setUserId(request.getUserId());
        summary.setStatus(request.getStatus().name());
        summary.setStatusDesc(request.getStatus().getDescription());
        summary.setOriginalAmount(request.getOriginalAmount());
        summary.setDiscountAmount(request.getDiscountAmount());
        summary.setFinalAmount(request.getFinalAmount());
        summary.setRuleCode(request.getRuleCode());
        summary.setQuantity(request.getQuantity());
        summary.setCreatedAt(request.getCreatedAt());
        summary.setUpdatedAt(request.getUpdatedAt());
        summary.setErrorMessage(request.getErrorMessage());

        if (request.getExtraParams() != null) {
            try {
                summary.setExtraParams(JSON.parseObject(request.getExtraParams(), Map.class));
            } catch (Exception e) {
                summary.setExtraParams(Map.of("raw", request.getExtraParams()));
            }
        }

        priceRuleRepository.findByRuleCodeAndEnabledTrue(request.getRuleCode())
                .ifPresent(rule -> summary.setRuleName(rule.getRuleName()));

        if (request.getDiscountCodes() != null && !request.getDiscountCodes().isEmpty()) {
            List<String> codes = Arrays.asList(request.getDiscountCodes().split(","));
            summary.setDiscountCodes(codes);

            List<DiagnosisSummary.DiscountDetail> discountDetails = new ArrayList<>();
            for (String code : codes) {
                discountItemRepository.findByDiscountCodeAndEnabledTrue(code).ifPresent(d -> {
                    DiagnosisSummary.DiscountDetail detail = new DiagnosisSummary.DiscountDetail();
                    detail.setDiscountCode(d.getDiscountCode());
                    detail.setDiscountName(d.getDiscountName());
                    detail.setDiscountType(d.getDiscountType().getDescription());
                    discountDetails.add(detail);
                });
            }
            summary.setDiscountDetails(discountDetails);
        }

        List<FeeDetail> feeDetails = feeDetailRepository.findByRequestNoOrderBySortOrder(requestNo);
        summary.setFeeDetails(feeDetails.stream().map(fd -> {
            FeeDetailVo vo = new FeeDetailVo();
            vo.setName(fd.getDetailName());
            vo.setDesc(fd.getDetailDesc());
            vo.setAmount(fd.getAmount());
            return vo;
        }).collect(Collectors.toList()));

        lockCertificateRepository.findByRequestNoAndValidTrue(requestNo).ifPresentOrElse(cert -> {
            summary.setCertificateNo(cert.getCertificateNo());
            summary.setLockedAmount(cert.getLockedAmount());
            summary.setLockedAt(cert.getLockedAt());
            summary.setExpiredAt(cert.getExpiredAt());
            summary.setCertificateValid(cert.getValid());
            summary.setChargedBy(cert.getChargedBy());
            summary.setChargedAt(cert.getChargedAt());
        }, () -> {
            lockCertificateRepository.findAll().stream()
                    .filter(c -> c.getRequestNo().equals(requestNo))
                    .findFirst()
                    .ifPresent(cert -> {
                        summary.setCertificateNo(cert.getCertificateNo());
                        summary.setLockedAmount(cert.getLockedAmount());
                        summary.setLockedAt(cert.getLockedAt());
                        summary.setExpiredAt(cert.getExpiredAt());
                        summary.setCertificateValid(cert.getValid());
                        summary.setChargedBy(cert.getChargedBy());
                        summary.setChargedAt(cert.getChargedAt());
                    });
        });

        List<ActionTimeline> timelines = timelineRepository.findByRequestNoOrderByActionTimeAsc(requestNo);
        summary.setTimeline(timelines.stream().map(t -> {
            DiagnosisSummary.TimelineEvent event = new DiagnosisSummary.TimelineEvent();
            event.setAction(t.getAction());
            event.setActionDesc(t.getActionDesc());
            event.setOperator(t.getOperator());
            event.setActionTime(t.getActionTime());
            event.setBeforeData(t.getBeforeData());
            event.setAfterData(t.getAfterData());
            return event;
        }).collect(Collectors.toList()));

        summary.setSummaryRemark(generateSummaryRemark(summary));

        return summary;
    }

    private String generateSummaryRemark(DiagnosisSummary summary) {
        StringBuilder sb = new StringBuilder();
        sb.append("【问题排查汇总报告】\n");
        sb.append("生成时间: ").append(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))).append("\n");
        sb.append("\n=== 基本信息 ===\n");
        sb.append("请求号: ").append(summary.getRequestNo()).append("\n");
        sb.append("业务单号: ").append(summary.getBizType()).append("/").append(summary.getBizNo()).append("\n");
        sb.append("当前状态: ").append(summary.getStatus()).append(" (").append(summary.getStatusDesc()).append(")\n");
        sb.append("价格规则: ").append(summary.getRuleCode()).append(" - ").append(summary.getRuleName()).append("\n");
        sb.append("数量: ").append(summary.getQuantity()).append("\n");

        sb.append("\n=== 费用明细 ===\n");
        sb.append("原价: ").append(summary.getOriginalAmount()).append(" 元\n");
        sb.append("折扣: ").append(summary.getDiscountAmount()).append(" 元\n");
        sb.append("应付: ").append(summary.getFinalAmount()).append(" 元\n");

        if (summary.getFeeDetails() != null && !summary.getFeeDetails().isEmpty()) {
            sb.append("\n=== 费用构成 ===\n");
            for (FeeDetailVo detail : summary.getFeeDetails()) {
                sb.append("  - ").append(detail.getName()).append(": ").append(detail.getAmount()).append(" 元");
                if (detail.getDesc() != null) {
                    sb.append(" (").append(detail.getDesc()).append(")");
                }
                sb.append("\n");
            }
        }

        if (summary.getCertificateNo() != null) {
            sb.append("\n=== 锁价凭证 ===\n");
            sb.append("凭证号: ").append(summary.getCertificateNo()).append("\n");
            sb.append("锁定金额: ").append(summary.getLockedAmount()).append(" 元\n");
            sb.append("锁定时间: ").append(formatDateTime(summary.getLockedAt())).append("\n");
            sb.append("过期时间: ").append(formatDateTime(summary.getExpiredAt())).append("\n");
            sb.append("凭证状态: ").append(Boolean.TRUE.equals(summary.getCertificateValid()) ? "有效" : "已失效").append("\n");
            if (summary.getChargedBy() != null) {
                sb.append("扣费操作者: ").append(summary.getChargedBy()).append("\n");
                sb.append("扣费时间: ").append(formatDateTime(summary.getChargedAt())).append("\n");
            }
        }

        if (summary.getTimeline() != null && !summary.getTimeline().isEmpty()) {
            sb.append("\n=== 操作时间线 ===\n");
            for (DiagnosisSummary.TimelineEvent event : summary.getTimeline()) {
                sb.append("  [").append(formatDateTime(event.getActionTime())).append("] ");
                sb.append(event.getActionDesc());
                if (event.getOperator() != null) {
                    sb.append(" - 操作者: ").append(event.getOperator());
                }
                sb.append("\n");
            }
        }

        if (summary.getErrorMessage() != null) {
            sb.append("\n=== 错误信息 ===\n");
            sb.append(summary.getErrorMessage()).append("\n");
        }

        sb.append("\n=== 排查建议 ===\n");
        if ("EXPIRED".equals(summary.getStatus())) {
            sb.append("⚠️  锁价已过期，请重新发起试算\n");
        } else if ("FAILED".equals(summary.getStatus())) {
            sb.append("⚠️  试算失败，请检查价格规则配置和输入参数\n");
        } else if ("LOCKED".equals(summary.getStatus())) {
            sb.append("✅  价格已锁定，请在有效期内完成扣费\n");
        } else if ("CHARGED".equals(summary.getStatus())) {
            sb.append("✅  交易已完成，扣费成功\n");
        }

        return sb.toString();
    }

    public String exportAsText(String requestNo) {
        DiagnosisSummary summary = generateDiagnosis(requestNo);
        return summary.getSummaryRemark();
    }

    public String exportAsJson(String requestNo) {
        DiagnosisSummary summary = generateDiagnosis(requestNo);
        return JSON.toJSONString(summary, true);
    }

    private String formatDateTime(LocalDateTime dt) {
        if (dt == null) return "-";
        return dt.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }

    public List<DiagnosisSummary> batchDiagnosisByTime(LocalDateTime startTime, LocalDateTime endTime) {
        List<CalculationRequest> requests = requestRepository.findByCreatedAtBetweenOrderByCreatedAtDesc(startTime, endTime);
        return requests.stream()
                .map(r -> generateDiagnosis(r.getRequestNo()))
                .collect(Collectors.toList());
    }
}
