package com.ortho.rework.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ShipRequest {
    @NotBlank(message = "Tracking number is required")
    private String trackingNumber;

    private String courier;

    private String sender;

    private String receiver;

    private String operator;
}
