package com.feiyong.feecalc.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class CalculateResult {

    private String requestNo;

    private String status;

    private String statusDesc;

    private BigDecimal originalAmount;

    private BigDecimal discountAmount;

    private BigDecimal finalAmount;

    private String certificateNo;

    private LocalDateTime expiredAt;

    private List<FeeDetailVo> details;

    private String errorMessage;
}
