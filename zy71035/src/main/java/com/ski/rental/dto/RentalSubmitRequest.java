package com.ski.rental.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public class RentalSubmitRequest {
    private String batchNo;

    @NotBlank(message = "租客ID不能为空")
    private String customerId;

    @NotBlank(message = "雪板编号不能为空")
    private String boardCode;

    @NotNull(message = "实际释放值不能为空")
    private BigDecimal actualReleaseValue;

    private LocalDateTime expectedReturnTime;
    private BigDecimal rentalFee;
    private String operator;

    public String getBatchNo() {
        return batchNo;
    }

    public void setBatchNo(String batchNo) {
        this.batchNo = batchNo;
    }

    public String getCustomerId() {
        return customerId;
    }

    public void setCustomerId(String customerId) {
        this.customerId = customerId;
    }

    public String getBoardCode() {
        return boardCode;
    }

    public void setBoardCode(String boardCode) {
        this.boardCode = boardCode;
    }

    public BigDecimal getActualReleaseValue() {
        return actualReleaseValue;
    }

    public void setActualReleaseValue(BigDecimal actualReleaseValue) {
        this.actualReleaseValue = actualReleaseValue;
    }

    public LocalDateTime getExpectedReturnTime() {
        return expectedReturnTime;
    }

    public void setExpectedReturnTime(LocalDateTime expectedReturnTime) {
        this.expectedReturnTime = expectedReturnTime;
    }

    public BigDecimal getRentalFee() {
        return rentalFee;
    }

    public void setRentalFee(BigDecimal rentalFee) {
        this.rentalFee = rentalFee;
    }

    public String getOperator() {
        return operator;
    }

    public void setOperator(String operator) {
        this.operator = operator;
    }
}
