package com.feiyong.feecalc.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
public class DiagnosisSummary {
    private String requestNo;
    private String bizType;
    private String bizNo;
    private String userId;
    private String status;
    private String statusDesc;
    private BigDecimal originalAmount;
    private BigDecimal discountAmount;
    private BigDecimal finalAmount;
    private String ruleCode;
    private String ruleName;
    private BigDecimal quantity;
    private List<String> discountCodes;
    private List<DiscountDetail> discountDetails;
    private List<FeeDetailVo> feeDetails;
    private String certificateNo;
    private BigDecimal lockedAmount;
    private LocalDateTime lockedAt;
    private LocalDateTime expiredAt;
    private Boolean certificateValid;
    private String chargedBy;
    private LocalDateTime chargedAt;
    private List<TimelineEvent> timeline;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String errorMessage;
    private Map<String, Object> extraParams;
    private String summaryRemark;

    @Data
    public static class DiscountDetail {
        private String discountCode;
        private String discountName;
        private String discountType;
        private BigDecimal discountAmount;
    }

    @Data
    public static class TimelineEvent {
        private String action;
        private String actionDesc;
        private String operator;
        private LocalDateTime actionTime;
        private String beforeData;
        private String afterData;
    }
}
