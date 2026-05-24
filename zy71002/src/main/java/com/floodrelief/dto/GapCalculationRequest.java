package com.floodrelief.dto;

public class GapCalculationRequest {
    private Long shelterId;
    private String materialType;

    public Long getShelterId() { return shelterId; }
    public void setShelterId(Long shelterId) { this.shelterId = shelterId; }
    public String getMaterialType() { return materialType; }
    public void setMaterialType(String materialType) { this.materialType = materialType; }
}
