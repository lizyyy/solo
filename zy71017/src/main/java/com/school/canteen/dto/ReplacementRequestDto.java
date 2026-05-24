package com.school.canteen.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
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
}
