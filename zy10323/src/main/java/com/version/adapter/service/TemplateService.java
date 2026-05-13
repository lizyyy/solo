package com.version.adapter.service;

import com.version.adapter.entity.*;
import com.version.adapter.exception.VersionAdapterException;
import com.version.adapter.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class TemplateService {

    private final ResponseTemplateRepository responseTemplateRepository;
    private final VersionTemplateMappingRepository versionTemplateMappingRepository;
    private final FieldMappingRepository fieldMappingRepository;
    private final DefaultValueRepository defaultValueRepository;
    private final AuditTimelineService auditTimelineService;

    @Transactional
    public ResponseTemplate createTemplate(ResponseTemplate template, String operator) {
        if (responseTemplateRepository.existsByTemplateName(template.getTemplateName())) {
            throw new VersionAdapterException("TEMPLATE_EXISTS", "模板名称已存在: " + template.getTemplateName());
        }

        template.setCreatedBy(operator);
        template.setIsActive(true);
        template.setCreatedAt(LocalDateTime.now());

        ResponseTemplate saved = responseTemplateRepository.save(template);

        auditTimelineService.recordAction(
                "ResponseTemplate", saved.getId(), "CREATE",
                null, saved, operator, "创建响应模板"
        );

        log.info("创建响应模板成功: {}", saved.getTemplateName());
        return saved;
    }

    @Transactional
    public VersionTemplateMapping createMapping(Long versionId, Long templateId, String operator) {
        if (versionTemplateMappingRepository.existsByClientVersionIdAndTemplateIdAndIsActiveTrue(versionId, templateId)) {
            throw new VersionAdapterException("MAPPING_EXISTS", "版本模板映射已存在");
        }

        VersionTemplateMapping mapping = VersionTemplateMapping.builder()
                .clientVersionId(versionId)
                .templateId(templateId)
                .isActive(true)
                .createdBy(operator)
                .createdAt(LocalDateTime.now())
                .build();

        VersionTemplateMapping saved = versionTemplateMappingRepository.save(mapping);

        auditTimelineService.recordAction(
                "VersionTemplateMapping", saved.getId(), "CREATE",
                null, saved, operator, "创建版本模板映射"
        );

        return saved;
    }

    @Transactional
    public FieldMapping createFieldMapping(FieldMapping fieldMapping, String operator) {
        if (fieldMappingRepository.existsByTemplateIdAndSourceFieldAndIsActiveTrue(
                fieldMapping.getTemplateId(), fieldMapping.getSourceField())) {
            throw new VersionAdapterException("FIELD_MAPPING_EXISTS", "该模板下的字段映射已存在: " + fieldMapping.getSourceField());
        }

        fieldMapping.setCreatedBy(operator);
        fieldMapping.setIsActive(true);
        fieldMapping.setCreatedAt(LocalDateTime.now());

        FieldMapping saved = fieldMappingRepository.save(fieldMapping);

        auditTimelineService.recordAction(
                "FieldMapping", saved.getId(), "CREATE",
                null, saved, operator, "创建字段映射"
        );

        return saved;
    }

    @Transactional
    public DefaultValue createDefaultValue(DefaultValue defaultValue, String operator) {
        if (defaultValueRepository.existsByFieldMappingIdAndIsActiveTrue(defaultValue.getFieldMappingId())) {
            throw new VersionAdapterException("DEFAULT_VALUE_EXISTS", "该字段映射已配置默认值");
        }

        defaultValue.setCreatedBy(operator);
        defaultValue.setIsActive(true);
        defaultValue.setCreatedAt(LocalDateTime.now());

        DefaultValue saved = defaultValueRepository.save(defaultValue);

        auditTimelineService.recordAction(
                "DefaultValue", saved.getId(), "CREATE",
                null, saved, operator, "创建字段默认值"
        );

        return saved;
    }

    public ResponseTemplate getTemplateById(Long id) {
        return responseTemplateRepository.findById(id)
                .orElseThrow(() -> new VersionAdapterException("TEMPLATE_NOT_FOUND", "模板不存在: " + id));
    }

    public List<ResponseTemplate> getAllTemplates() {
        return responseTemplateRepository.findAll();
    }

    public List<ResponseTemplate> getActiveTemplates() {
        return responseTemplateRepository.findByIsActiveTrue();
    }

    public List<FieldMapping> getFieldMappingsByTemplate(Long templateId) {
        return fieldMappingRepository.findByTemplateIdAndIsActiveTrueOrderBySortOrder(templateId);
    }

    public List<VersionTemplateMapping> getMappingsByVersion(Long clientVersionId) {
        return versionTemplateMappingRepository.findByClientVersionIdAndIsActiveTrue(clientVersionId);
    }

    @Transactional
    public ResponseTemplate updateTemplate(Long id, ResponseTemplate updateRequest, String operator) {
        ResponseTemplate existing = responseTemplateRepository.findById(id)
                .orElseThrow(() -> new VersionAdapterException("TEMPLATE_NOT_FOUND", "模板不存在: " + id));

        ResponseTemplate previousState = new ResponseTemplate();
        previousState.setDescription(existing.getDescription());
        previousState.setApiEndpoint(existing.getApiEndpoint());
        previousState.setHttpMethod(existing.getHttpMethod());

        if (updateRequest.getDescription() != null) {
            existing.setDescription(updateRequest.getDescription());
        }
        if (updateRequest.getApiEndpoint() != null) {
            existing.setApiEndpoint(updateRequest.getApiEndpoint());
        }
        if (updateRequest.getHttpMethod() != null) {
            existing.setHttpMethod(updateRequest.getHttpMethod());
        }
        if (updateRequest.getTemplateJson() != null) {
            existing.setTemplateJson(updateRequest.getTemplateJson());
        }

        existing.setUpdatedBy(operator);
        existing.setUpdatedAt(LocalDateTime.now());

        ResponseTemplate updated = responseTemplateRepository.save(existing);

        auditTimelineService.recordAction(
                "ResponseTemplate", id, "UPDATE",
                previousState, updated, operator, "更新响应模板"
        );

        return updated;
    }

    @Transactional
    public ResponseTemplate deactivateTemplate(Long id, String operator) {
        ResponseTemplate template = responseTemplateRepository.findById(id)
                .orElseThrow(() -> new VersionAdapterException("TEMPLATE_NOT_FOUND", "模板不存在: " + id));

        ResponseTemplate previousState = new ResponseTemplate();
        previousState.setIsActive(template.getIsActive());

        template.setIsActive(false);
        template.setUpdatedBy(operator);
        template.setUpdatedAt(LocalDateTime.now());

        ResponseTemplate updated = responseTemplateRepository.save(template);

        auditTimelineService.recordAction(
                "ResponseTemplate", id, "DEACTIVATE",
                previousState, updated, operator, "停用响应模板"
        );

        return updated;
    }
}
