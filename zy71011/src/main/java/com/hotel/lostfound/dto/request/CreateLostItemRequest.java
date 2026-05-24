package com.hotel.lostfound.dto.request;

import com.hotel.lostfound.entity.enums.ItemCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class CreateLostItemRequest {

    @NotBlank(message = "请求ID不能为空")
    private String requestId;

    @NotBlank(message = "物品名称不能为空")
    private String itemName;

    private String description;

    @NotNull(message = "物品分类不能为空")
    private ItemCategory category;

    private BigDecimal estimatedValue;

    private String roomNumber;

    private String pickUpLocation;

    @NotBlank(message = "拾取员工不能为空")
    private String pickedByStaff;

    private String storageLocation;

    @NotNull(message = "拾取时间不能为空")
    private LocalDateTime foundTime;

    private String ownerName;

    private String ownerPhone;

    @NotBlank(message = "操作人不能为空")
    private String operator;
}
