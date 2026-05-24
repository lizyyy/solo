package com.hotel.lostfound.dto.response;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class MailRecordVO {

    private Long id;

    private String receiverName;

    private String receiverPhone;

    private String receiverAddress;

    private String courierCompany;

    private String trackingNumber;

    private BigDecimal postage;

    private boolean postagePaid;

    private String itemProofImageUrls;

    private String shippingProofImageUrls;

    private String handledBy;

    private LocalDateTime shippedAt;

    private LocalDateTime deliveredAt;

    private boolean signedReceived;

    private String remark;
}
