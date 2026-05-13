package com.api.inspection.service;

import com.api.inspection.dto.*;
import com.api.inspection.entity.*;
import com.api.inspection.enums.TransactionStatus;
import com.api.inspection.exception.BusinessException;
import com.api.inspection.repository.TransactionTemplateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TransactionTemplateService {
    private final TransactionTemplateRepository templateRepository;

    @Transactional
    public TransactionTemplate createTemplate(CreateTemplateRequest request) {
        if (templateRepository.existsByTemplateCode(request.getTemplateCode())) {
            throw new BusinessException("模板编码已存在: " + request.getTemplateCode());
        }

        TransactionTemplate template = new TransactionTemplate();
        template.setTemplateCode(request.getTemplateCode());
        template.setTemplateName(request.getTemplateName());
        template.setDescription(request.getDescription());
        template.setCreatedBy(request.getCreatedBy());
        template.setStatus(TransactionStatus.DRAFT);

        List<TransactionStep> steps = request.getSteps().stream()
                .map(stepRequest -> convertToStep(stepRequest, template))
                .collect(Collectors.toList());
        template.setSteps(steps);

        return templateRepository.save(template);
    }

    private TransactionStep convertToStep(StepRequest request, TransactionTemplate template) {
        TransactionStep step = new TransactionStep();
        step.setTemplate(template);
        step.setStepOrder(request.getStepOrder());
        step.setStepName(request.getStepName());
        step.setHttpMethod(request.getHttpMethod());
        step.setUrl(request.getUrl());
        step.setHeaders(request.getHeaders());
        step.setBody(request.getBody());
        step.setTimeout(request.getTimeout() != null ? request.getTimeout() : 30000);

        if (request.getVariableExtracts() != null) {
            List<VariableExtract> extracts = request.getVariableExtracts().stream()
                    .map(extractRequest -> convertToVariableExtract(extractRequest, step))
                    .collect(Collectors.toList());
            step.setVariableExtracts(extracts);
        }

        if (request.getAssertions() != null) {
            List<AssertionRule> assertions = request.getAssertions().stream()
                    .map(assertionRequest -> convertToAssertion(assertionRequest, step))
                    .collect(Collectors.toList());
            step.setAssertions(assertions);
        }

        return step;
    }

    private VariableExtract convertToVariableExtract(VariableExtractRequest request, TransactionStep step) {
        VariableExtract extract = new VariableExtract();
        extract.setStep(step);
        extract.setVariableName(request.getVariableName());
        extract.setExtractExpression(request.getExtractExpression());
        extract.setSourceType(request.getSourceType());
        return extract;
    }

    private AssertionRule convertToAssertion(AssertionRequest request, TransactionStep step) {
        AssertionRule assertion = new AssertionRule();
        assertion.setStep(step);
        assertion.setAssertionType(request.getAssertionType());
        assertion.setExpectedValue(request.getExpectedValue());
        assertion.setExpression(request.getExpression());
        assertion.setEnabled(request.getEnabled() != null ? request.getEnabled() : true);
        return assertion;
    }

    public TransactionTemplate getTemplate(Long id) {
        return templateRepository.findById(id)
                .orElseThrow(() -> new BusinessException("模板不存在: " + id));
    }

    public TransactionTemplate getTemplateByCode(String templateCode) {
        return templateRepository.findByTemplateCode(templateCode)
                .orElseThrow(() -> new BusinessException("模板不存在: " + templateCode));
    }

    public List<TransactionTemplate> getAllTemplates() {
        return templateRepository.findAll();
    }

    @Transactional
    public TransactionTemplate validateTemplate(Long id) {
        TransactionTemplate template = getTemplate(id);
        
        if (template.getStatus() != TransactionStatus.DRAFT) {
            throw new BusinessException("只有草稿状态的模板可以校验");
        }

        if (template.getSteps().isEmpty()) {
            throw new BusinessException("模板步骤不能为空");
        }

        for (TransactionStep step : template.getSteps()) {
            if (step.getStepOrder() == null || step.getStepName() == null 
                    || step.getHttpMethod() == null || step.getUrl() == null) {
                throw new BusinessException("步骤参数不完整: " + step.getStepName());
            }
        }

        template.setStatus(TransactionStatus.VALIDATED);
        return templateRepository.save(template);
    }

    @Transactional
    public TransactionTemplate updateStatus(Long id, TransactionStatus targetStatus) {
        TransactionTemplate template = getTemplate(id);
        TransactionStatus currentStatus = template.getStatus();

        if (!currentStatus.canTransitionTo(targetStatus)) {
            throw new BusinessException(String.format("状态不允许跳转: %s -> %s", 
                    currentStatus.getDescription(), targetStatus.getDescription()));
        }

        template.setStatus(targetStatus);
        return templateRepository.save(template);
    }

    @Transactional
    public TransactionTemplate cancelTemplate(Long id) {
        return updateStatus(id, TransactionStatus.CANCELLED);
    }
}
