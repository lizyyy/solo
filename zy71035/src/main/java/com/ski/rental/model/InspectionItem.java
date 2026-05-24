package com.ski.rental.model;

import com.ski.rental.enums.DamageLevel;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import java.math.BigDecimal;

@Embeddable
public class InspectionItem {
    private String itemName;
    @Enumerated(EnumType.STRING)
    private DamageLevel damageLevel;
    private String description;
    private BigDecimal estimatedFee;

    public String getItemName() {
        return itemName;
    }

    public void setItemName(String itemName) {
        this.itemName = itemName;
    }

    public DamageLevel getDamageLevel() {
        return damageLevel;
    }

    public void setDamageLevel(DamageLevel damageLevel) {
        this.damageLevel = damageLevel;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public BigDecimal getEstimatedFee() {
        return estimatedFee;
    }

    public void setEstimatedFee(BigDecimal estimatedFee) {
        this.estimatedFee = estimatedFee;
    }
}
