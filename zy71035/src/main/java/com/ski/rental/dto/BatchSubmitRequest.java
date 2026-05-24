package com.ski.rental.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public class BatchSubmitRequest {
    private String batchNo;
    private String operator;

    @NotEmpty(message = "租赁单列表不能为空")
    @Valid
    private List<RentalSubmitRequest> rentals;

    public String getBatchNo() {
        return batchNo;
    }

    public void setBatchNo(String batchNo) {
        this.batchNo = batchNo;
    }

    public String getOperator() {
        return operator;
    }

    public void setOperator(String operator) {
        this.operator = operator;
    }

    public List<RentalSubmitRequest> getRentals() {
        return rentals;
    }

    public void setRentals(List<RentalSubmitRequest> rentals) {
        this.rentals = rentals;
    }
}
