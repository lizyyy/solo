package com.hotel.lostfound.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDateTime;

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

    public String getRequestId() {
        return requestId;
    }

    public void setRequestId(String requestId) {
        this.requestId = requestId;
    }

    public Long getItemId() {
        return itemId;
    }

    public void setItemId(Long itemId) {
        this.itemId = itemId;
    }

    public String getReceiverName() {
        return receiverName;
    }

    public void setReceiverName(String receiverName) {
        this.receiverName = receiverName;
    }

    public String getReceiverPhone() {
        return receiverPhone;
    }

    public void setReceiverPhone(String receiverPhone) {
        this.receiverPhone = receiverPhone;
    }

    public String getReceiverAddress() {
        return receiverAddress;
    }

    public void setReceiverAddress(String receiverAddress) {
        this.receiverAddress = receiverAddress;
    }

    public String getCourierCompany() {
        return courierCompany;
    }

    public void setCourierCompany(String courierCompany) {
        this.courierCompany = courierCompany;
    }

    public String getTrackingNumber() {
        return trackingNumber;
    }

    public void setTrackingNumber(String trackingNumber) {
        this.trackingNumber = trackingNumber;
    }

    public BigDecimal getPostage() {
        return postage;
    }

    public void setPostage(BigDecimal postage) {
        this.postage = postage;
    }

    public boolean isPostagePaid() {
        return postagePaid;
    }

    public void setPostagePaid(boolean postagePaid) {
        this.postagePaid = postagePaid;
    }

    public String getItemProofImageUrls() {
        return itemProofImageUrls;
    }

    public void setItemProofImageUrls(String itemProofImageUrls) {
        this.itemProofImageUrls = itemProofImageUrls;
    }

    public String getShippingProofImageUrls() {
        return shippingProofImageUrls;
    }

    public void setShippingProofImageUrls(String shippingProofImageUrls) {
        this.shippingProofImageUrls = shippingProofImageUrls;
    }

    public String getHandledBy() {
        return handledBy;
    }

    public void setHandledBy(String handledBy) {
        this.handledBy = handledBy;
    }

    public LocalDateTime getShippedAt() {
        return shippedAt;
    }

    public void setShippedAt(LocalDateTime shippedAt) {
        this.shippedAt = shippedAt;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }
}
