package com.promptversion.service;

import com.alibaba.fastjson.JSON;
import com.promptversion.dto.CreateTemplateRequest;
import com.promptversion.entity.ExceptionLog;
import com.promptversion.entity.PromptTemplate;
import com.promptversion.exception.BusinessException;
import com.promptversion.repository.ExceptionLogRepository;
import com.promptversion.repository.PromptTemplateRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class TemplateService {

    @Autowired
    private PromptTemplateRepository templateRepository;

    @Autowired
    private ExceptionLogRepository exceptionLogRepository;

    @Transactional
    public PromptTemplate createTemplate(CreateTemplateRequest request) {
        try {
            if (templateRepository.existsByTemplateNameAndDeletedFalse(request.getTemplateName())) {
                throw new BusinessException(400, "模板名称已存在", JSON.toJSONString(request));
            }

            PromptTemplate template = new PromptTemplate();
            template.setTemplateName(request.getTemplateName());
            template.setDescription(request.getDescription());
            template.setCreatedBy(request.getCreatedBy());

            return templateRepository.save(template);
        } catch (BusinessException e) {
            saveExceptionLog("CREATE_TEMPLATE", JSON.toJSONString(request), e.getMessage(), request.getCreatedBy(), null);
            throw e;
        } catch (Exception e) {
            saveExceptionLog("CREATE_TEMPLATE", JSON.toJSONString(request), e.getMessage(), request.getCreatedBy(), e);
            throw new BusinessException(500, "创建模板失败: " + e.getMessage());
        }
    }

    public List<PromptTemplate> getAllTemplates() {
        return templateRepository.findByDeletedFalse();
    }

    public PromptTemplate getTemplateById(Long id) {
        return templateRepository.findById(id)
                .orElseThrow(() -> new BusinessException(404, "模板不存在"));
    }

    public PromptTemplate getTemplateByName(String name) {
        return templateRepository.findByTemplateNameAndDeletedFalse(name)
                .orElseThrow(() -> new BusinessException(404, "模板不存在"));
    }

    @Transactional
    public void deleteTemplate(Long id, String operator) {
        PromptTemplate template = getTemplateById(id);
        template.setDeleted(true);
        templateRepository.save(template);
    }

    private void saveExceptionLog(String operationType, String originalInput, String errorMessage, String operator, Exception e) {
        ExceptionLog log = new ExceptionLog();
        log.setOperationType(operationType);
        log.setOriginalInput(originalInput);
        log.setErrorMessage(errorMessage);
        log.setOperator(operator);
        if (e != null) {
            log.setStackTrace(getStackTrace(e));
        }
        log.setConclusion("操作失败，已记录异常日志");
        exceptionLogRepository.save(log);
    }

    private String getStackTrace(Exception e) {
        StringBuilder sb = new StringBuilder();
        for (StackTraceElement element : e.getStackTrace()) {
            sb.append(element.toString()).append("\n");
        }
        return sb.toString();
    }
}