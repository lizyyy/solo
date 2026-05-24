package com.school.canteen.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public class ReplacementRequestDto {
    @NotNull(message = "用餐日期不能为空")
    private LocalDate mealDate;

    @NotBlank(message = "餐次类型不能为空")
    private String mealType;

    @NotNull(message = "原菜品ID不能为空")
    private Long originalDishId;

    @NotNull(message = "替换菜品ID不能为空")
    private Long replacementDishId;

    private String reason;

    private String createdBy;

    public LocalDate getMealDate() { return mealDate; }
    public void setMealDate(LocalDate mealDate) { this.mealDate = mealDate; }
    public String getMealType() { return mealType; }
    public void setMealType(String mealType) { this.mealType = mealType; }
    public Long getOriginalDishId() { return originalDishId; }
    public void setOriginalDishId(Long originalDishId) { this.originalDishId = originalDishId; }
    public Long getReplacementDishId() { return replacementDishId; }
    public void setReplacementDishId(Long replacementDishId) { this.replacementDishId = replacementDishId; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
}
