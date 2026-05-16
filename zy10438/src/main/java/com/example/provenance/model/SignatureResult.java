package com.example.provenance.model;

import javax.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Embeddable
public class SignatureResult {
    private String signatureAlgorithm;
    private String signatureValue;
    private String signerIdentity;
    private String certificateChain;
    private Long signatureTimestamp;
    private String signatureVerified;
    private String verificationMessage;
}
