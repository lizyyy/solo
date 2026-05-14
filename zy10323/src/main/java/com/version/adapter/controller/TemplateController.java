package com.version.adapter.controller;

import com.version.adapter.entity.*;
import com.version.adapter.service.TemplateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/templates")
@RequiredArgsConstructor
@Slf4j
public class TemplateController {

    private final TemplateService templateService;

    @PostMapping
    public ResponseEntity<ResponseTemplate> createTemplate(
            @RequestBody ResponseTemplate template,
            @RequestHeader(value = "X-Operator", defaultValue = "system") String operator) {
        ResponseTemplate created = templateService.createTemplate(template, operator);
        return ResponseEntity.ok(created);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ResponseTemplate> getTemplateById(@PathVariable Long id) {
        ResponseTemplate template = templateService.getTemplateById(id);
        return ResponseEntity.ok(template);
    }

    @GetMapping
    public ResponseEntity<List<ResponseTemplate>> getAllTemplates() {
        List<ResponseTemplate> templates = templateService.getAllTemplates();
        return ResponseEntity.ok(templates);
    }

    @GetMapping("/active")
    public ResponseEntity<List<ResponseTemplate>> getActiveTemplates() {
        List<ResponseTemplate> templates = templateService.getActiveTemplates();
        return ResponseEntity.ok(templates);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ResponseTemplate> updateTemplate(
            @PathVariable Long id,
            @RequestBody ResponseTemplate updateRequest,
            @RequestHeader(value = "X-Operator", defaultValue = "system") String operator) {
        ResponseTemplate updated = templateService.updateTemplate(id, updateRequest, operator);
        return ResponseEntity.ok(updated);
    }

    @PutMapping("/{id}/deactivate")
    public ResponseEntity<ResponseTemplate> deactivateTemplate(
            @PathVariable Long id,
            @RequestHeader(value = "X-Operator", defaultValue = "system") String operator) {
        ResponseTemplate updated = templateService.deactivateTemplate(id, operator);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/mappings")
    public ResponseEntity<VersionTemplateMapping> createMapping(
            @RequestParam Long versionId,
            @RequestParam Long templateId,
            @RequestHeader(value = "X-Operator", defaultValue = "system") String operator) {
        VersionTemplateMapping mapping = templateService.createMapping(versionId, templateId, operator);
        return ResponseEntity.ok(mapping);
    }

    @GetMapping("/mappings/version/{versionId}")
    public ResponseEntity<List<VersionTemplateMapping>> getMappingsByVersion(@PathVariable Long versionId) {
        List<VersionTemplateMapping> mappings = templateService.getMappingsByVersion(versionId);
        return ResponseEntity.ok(mappings);
    }

    @PostMapping("/fields")
    public ResponseEntity<FieldMapping> createFieldMapping(
            @RequestBody FieldMapping fieldMapping,
            @RequestHeader(value = "X-Operator", defaultValue = "system") String operator) {
        FieldMapping created = templateService.createFieldMapping(fieldMapping, operator);
        return ResponseEntity.ok(created);
    }

    @GetMapping("/{templateId}/fields")
    public ResponseEntity<List<FieldMapping>> getFieldMappingsByTemplate(@PathVariable Long templateId) {
        List<FieldMapping> mappings = templateService.getFieldMappingsByTemplate(templateId);
        return ResponseEntity.ok(mappings);
    }

    @PostMapping("/default-values")
    public ResponseEntity<DefaultValue> createDefaultValue(
            @RequestBody DefaultValue defaultValue,
            @RequestHeader(value = "X-Operator", defaultValue = "system") String operator) {
        DefaultValue created = templateService.createDefaultValue(defaultValue, operator);
        return ResponseEntity.ok(created);
    }
}
