package com.object.lifecycle.service;

import com.object.lifecycle.dto.CreatePrefixRequest;
import com.object.lifecycle.entity.ObjectPrefix;
import com.object.lifecycle.exception.BusinessException;
import com.object.lifecycle.repository.ObjectPrefixRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ObjectPrefixService {

    private final ObjectPrefixRepository prefixRepository;
    private final AuditLogService auditLogService;

    @Transactional
    public ObjectPrefix createPrefix(CreatePrefixRequest request) {
        if (prefixRepository.findByPrefixAndBucketName(request.getPrefix(), request.getBucketName()).isPresent()) {
            throw new BusinessException(400, "该桶下已存在相同前缀");
        }

        ObjectPrefix prefix = new ObjectPrefix();
        prefix.setPrefix(request.getPrefix());
        prefix.setBucketName(request.getBucketName());
        prefix.setDescription(request.getDescription());
        prefix.setEnabled(true);

        ObjectPrefix saved = prefixRepository.save(prefix);
        auditLogService.logAction("ObjectPrefix", saved.getId().toString(), "CREATE", null, null);
        log.info("创建对象前缀: id={}, prefix={}, bucket={}", saved.getId(), saved.getPrefix(), saved.getBucketName());
        return saved;
    }

    public ObjectPrefix getPrefixById(Long id) {
        return prefixRepository.findById(id)
                .orElseThrow(() -> new BusinessException(404, "对象前缀不存在"));
    }

    public List<ObjectPrefix> getAllPrefixes() {
        return prefixRepository.findAll();
    }

    public List<ObjectPrefix> getEnabledPrefixes() {
        return prefixRepository.findByEnabledTrue();
    }

    @Transactional
    public ObjectPrefix updatePrefix(Long id, CreatePrefixRequest request) {
        ObjectPrefix prefix = getPrefixById(id);
        
        if (!prefix.getPrefix().equals(request.getPrefix()) || !prefix.getBucketName().equals(request.getBucketName())) {
            if (prefixRepository.findByPrefixAndBucketName(request.getPrefix(), request.getBucketName()).isPresent()) {
                throw new BusinessException(400, "该桶下已存在相同前缀");
            }
        }

        String oldPrefix = prefix.getPrefix();
        String oldBucket = prefix.getBucketName();
        
        prefix.setPrefix(request.getPrefix());
        prefix.setBucketName(request.getBucketName());
        prefix.setDescription(request.getDescription());

        ObjectPrefix saved = prefixRepository.save(prefix);
        auditLogService.logAction("ObjectPrefix", saved.getId().toString(), "UPDATE",
                "prefix,bucketName", oldPrefix + "," + oldBucket, request.getPrefix() + "," + request.getBucketName());
        return saved;
    }

    @Transactional
    public ObjectPrefix togglePrefix(Long id, boolean enabled) {
        ObjectPrefix prefix = getPrefixById(id);
        boolean oldEnabled = prefix.getEnabled();
        prefix.setEnabled(enabled);
        ObjectPrefix saved = prefixRepository.save(prefix);
        auditLogService.logAction("ObjectPrefix", saved.getId().toString(), "TOGGLE",
                "enabled", String.valueOf(oldEnabled), String.valueOf(enabled));
        return saved;
    }

    @Transactional
    public void deletePrefix(Long id) {
        ObjectPrefix prefix = getPrefixById(id);
        prefixRepository.delete(prefix);
        auditLogService.logAction("ObjectPrefix", id.toString(), "DELETE", null, null);
        log.info("删除对象前缀: id={}", id);
    }
}
