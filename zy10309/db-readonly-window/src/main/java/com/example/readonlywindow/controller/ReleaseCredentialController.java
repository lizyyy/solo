package com.example.readonlywindow.controller;

import com.example.readonlywindow.entity.ReleaseCredential;
import com.example.readonlywindow.service.ReleaseCredentialService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/credentials")
@RequiredArgsConstructor
public class ReleaseCredentialController {
    private final ReleaseCredentialService credentialService;

    @PostMapping("/issue")
    public ResponseEntity<ReleaseCredential> issueCredential(
            @RequestParam String windowCode,
            @RequestParam(required = false) String requestCode,
            @RequestParam String issuedTo,
            @RequestParam(required = false) String issuedBy,
            @RequestParam(required = false) String auditNotes) {
        return ResponseEntity.ok(credentialService.issueCredential(windowCode, requestCode, issuedTo, issuedBy, auditNotes));
    }

    @PostMapping("/{credentialCode}/use")
    public ResponseEntity<ReleaseCredential> useCredential(
            @PathVariable String credentialCode,
            @RequestParam(required = false) String usedBy) {
        return ResponseEntity.ok(credentialService.useCredential(credentialCode, usedBy));
    }

    @GetMapping("/{credentialCode}")
    public ResponseEntity<ReleaseCredential> getCredential(@PathVariable String credentialCode) {
        return ResponseEntity.ok(credentialService.getCredentialByCode(credentialCode));
    }

    @GetMapping("/window/{windowCode}")
    public ResponseEntity<List<ReleaseCredential>> getCredentialsByWindow(@PathVariable String windowCode) {
        return ResponseEntity.ok(credentialService.getCredentialsByWindow(windowCode));
    }

    @GetMapping("/window/{windowCode}/unused")
    public ResponseEntity<List<ReleaseCredential>> getUnusedCredentialsByWindow(@PathVariable String windowCode) {
        return ResponseEntity.ok(credentialService.getUnusedCredentialsByWindow(windowCode));
    }

    @GetMapping
    public ResponseEntity<List<ReleaseCredential>> getAllCredentials() {
        return ResponseEntity.ok(credentialService.getAllCredentials());
    }

    @GetMapping("/{credentialCode}/verify")
    public ResponseEntity<Map<String, Object>> verifyCredential(@PathVariable String credentialCode) {
        ReleaseCredential credential = credentialService.getCredentialByCode(credentialCode);
        boolean valid = !credential.isUsed() && credential.getValidUntil().isAfter(java.time.LocalDateTime.now());
        return ResponseEntity.ok(Map.of(
                "valid", valid,
                "used", credential.isUsed(),
                "expired", credential.getValidUntil().isBefore(java.time.LocalDateTime.now())
        ));
    }
}
