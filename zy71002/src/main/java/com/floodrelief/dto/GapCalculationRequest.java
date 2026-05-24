package com.floodrelief.dto;

import lombok.Data;

@Data
public class GapCalculationRequest {
    private Long shelterId;
    private String materialType;
}
