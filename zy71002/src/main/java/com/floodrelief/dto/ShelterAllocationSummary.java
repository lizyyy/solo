package com.floodrelief.dto;

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

    public Long getShelterId() { return shelterId; }
    public void setShelterId(Long shelterId) { this.shelterId = shelterId; }
    public String getShelterName() { return shelterName; }
    public void setShelterName(String shelterName) { this.shelterName = shelterName; }
    public Integer getTotalPeople() { return totalPeople; }
    public void setTotalPeople(Integer totalPeople) { this.totalPeople = totalPeople; }
    public Integer getElderlyCount() { return elderlyCount; }
    public void setElderlyCount(Integer elderlyCount) { this.elderlyCount = elderlyCount; }
    public Integer getChildrenCount() { return childrenCount; }
    public void setChildrenCount(Integer childrenCount) { this.childrenCount = childrenCount; }
    public Integer getDisabledCount() { return disabledCount; }
    public void setDisabledCount(Integer disabledCount) { this.disabledCount = disabledCount; }
    public Double getFoodRatio() { return foodRatio; }
    public void setFoodRatio(Double foodRatio) { this.foodRatio = foodRatio; }
    public Double getMedicineRatio() { return medicineRatio; }
    public void setMedicineRatio(Double medicineRatio) { this.medicineRatio = medicineRatio; }
    public String getRatioStatus() { return ratioStatus; }
    public void setRatioStatus(String ratioStatus) { this.ratioStatus = ratioStatus; }
}
