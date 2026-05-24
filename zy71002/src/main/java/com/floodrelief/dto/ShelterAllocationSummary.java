package com.floodrelief.dto;

import lombok.Data;

@Data
public class ShelterAllocationSummary {
    private Long shelterId;
    private String shelterName;
    private Integer totalPeople;
    private Integer elderlyCount;
    private Integer childrenCount;
    private Integer disabledCount;
    private Double foodRatio;
    private Double medicineRatio;
    private String ratioStatus;
}
