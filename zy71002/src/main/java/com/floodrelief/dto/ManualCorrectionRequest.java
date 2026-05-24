package com.floodrelief.dto;

import lombok.Data;

@Data
public class ManualCorrectionRequest {
    private String correctedBy;
    private String reason;
    private Integer newQuantity;
}
