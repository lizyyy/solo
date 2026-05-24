package com.ortho.rework.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateReworkRequest {
    @NotBlank(message = "Batch number is required")
    private String batchNumber;

    @NotBlank(message = "Patient ID is required")
    private String patientId;

    private String patientName;

    private String patientPhone;

    private String reworkReason;
}
