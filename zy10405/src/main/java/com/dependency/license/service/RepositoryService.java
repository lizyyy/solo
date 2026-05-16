package com.dependency.license.service;

import com.dependency.license.dto.CreateRepositoryRequest;
import com.dependency.license.exception.BusinessException;
import com.dependency.license.model.Repository;
import com.dependency.license.repository.RepositoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class RepositoryService {
    private final RepositoryRepository repositoryRepository;
    private final AuditService auditService;

    @Transactional
    public Repository createRepository(CreateRepositoryRequest request) {
        if (repositoryRepository.findByName(request.getName()).isPresent()) {
            throw new BusinessException(409, "仓库已存在: " + request.getName());
        }

        Repository repo = new Repository();
        repo.setName(request.getName());
        repo.setUrl(request.getUrl());
        repo.setOwner(request.getOwner());
        repo.setMaintainer(request.getMaintainer());
        repo.setMaintainerEmail(request.getMaintainerEmail());
        repo.setDepartment(request.getDepartment());
        repo.setDescription(request.getDescription());
        repo.setIsActive(request.getIsActive());

        Repository saved = repositoryRepository.save(repo);
        auditService.logSuccess("CREATE_REPOSITORY", "Repository", saved.getId(), request, saved);
        return saved;
    }

    public List<Repository> getAllRepositories() {
        return repositoryRepository.findAll();
    }

    public Repository getRepositoryById(Long id) {
        return repositoryRepository.findById(id)
                .orElseThrow(() -> new BusinessException(404, "仓库不存在: " + id));
    }

    public List<Repository> getActiveRepositories() {
        return repositoryRepository.findByIsActiveTrue();
    }

    @Transactional
    public Repository updateRepository(Long id, CreateRepositoryRequest request) {
        Repository repo = getRepositoryById(id);

        repo.setUrl(request.getUrl());
        repo.setOwner(request.getOwner());
        repo.setMaintainer(request.getMaintainer());
        repo.setMaintainerEmail(request.getMaintainerEmail());
        repo.setDepartment(request.getDepartment());
        repo.setDescription(request.getDescription());
        repo.setIsActive(request.getIsActive());

        Repository saved = repositoryRepository.save(repo);
        auditService.logSuccess("UPDATE_REPOSITORY", "Repository", id, request, saved);
        return saved;
    }
}