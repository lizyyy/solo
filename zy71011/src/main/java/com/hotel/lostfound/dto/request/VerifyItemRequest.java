package com.hotel.lostfound.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class VerifyItemRequest {

    @NotBlank(message = "请求ID不能为空")
    private String requestId;

    @NotNull(message = "物品ID不能为空")
    private Long itemId;

    private boolean isVerified;

    private String verifyRemark;

    private String ownerName;

    private String ownerPhone;

    @NotBlank(message = "审核人不能为空")
    private String verifier;
}
