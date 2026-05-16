package com.certificate.health.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManualFixRequest {

    private String fixNotes;

    private String fixedBy;

    private String correctedCertificateData;
}
