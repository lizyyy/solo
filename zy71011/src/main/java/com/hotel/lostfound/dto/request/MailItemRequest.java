package com.hotel.lostfound.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class MailItemRequest {

    @NotBlank(message = "请求ID不能为空")
    private String requestId;

    @NotNull(message = "物品ID不能为空")
    private Long itemId;

    @NotBlank(message = "收件人姓名不能为空")
    private String receiverName;

    @NotBlank(message = "收件人电话不能为空")
    private String receiverPhone;

    @NotBlank(message = "收件地址不能为空")
    private String receiverAddress;

    @NotBlank(message = "快递公司不能为空")
    private String courierCompany;

    @NotBlank(message = "快递单号不能为空")
    private String trackingNumber;

    private BigDecimal postage;

    private boolean postagePaid;

    private String itemProofImageUrls;

    private String shippingProofImageUrls;

    @NotBlank(message = "处理人不能为空")
    private String handledBy;

    @NotNull(message = "寄出时间不能为空")
    private LocalDateTime shippedAt;

    private String remark;
}
