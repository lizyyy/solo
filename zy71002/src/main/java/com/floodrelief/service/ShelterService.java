package com.floodrelief.service;

import com.floodrelief.dto.ApiResponse;
import com.floodrelief.entity.Shelter;
import com.floodrelief.repository.ShelterRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class ShelterService {
    private static final Logger log = LoggerFactory.getLogger(ShelterService.class);
    
    private final ShelterRepository shelterRepository;

    public ShelterService(ShelterRepository shelterRepository) {
        this.shelterRepository = shelterRepository;
    }

    public ApiResponse<List<Shelter>> getAllShelters() {
        List<Shelter> shelters = shelterRepository.findByActiveTrue();
        return ApiResponse.success(shelters);
    }

    public ApiResponse<Shelter> getShelterById(Long id) {
        Optional<Shelter> shelter = shelterRepository.findById(id);
        return shelter.map(ApiResponse::success)
                .orElse(ApiResponse.error("安置点不存在"));
    }

    public ApiResponse<Shelter> createShelter(Shelter shelter) {
        if (shelter.getCode() == null || shelter.getCode().isEmpty()) {
            return ApiResponse.error("安置点编码不能为空");
        }
        if (shelter.getName() == null || shelter.getName().isEmpty()) {
            return ApiResponse.error("安置点名称不能为空");
        }

        Optional<Shelter> existing = shelterRepository.findByCode(shelter.getCode());
        if (existing.isPresent()) {
            return ApiResponse.error("安置点编码已存在");
        }

        shelter = shelterRepository.save(shelter);
        log.info("创建安置点成功: code={}, name={}", shelter.getCode(), shelter.getName());
        return ApiResponse.success("安置点创建成功", shelter);
    }

    public ApiResponse<Shelter> updateShelter(Long id, Shelter shelter) {
        Shelter existing = shelterRepository.findById(id).orElse(null);
        if (existing == null) {
            return ApiResponse.error("安置点不存在");
        }

        existing.setName(shelter.getName());
        existing.setLocation(shelter.getLocation());
        existing.setManager(shelter.getManager());
        existing.setManagerPhone(shelter.getManagerPhone());
        existing.setMaxCapacity(shelter.getMaxCapacity());
        existing.setActive(shelter.getActive());
        existing.setRemark(shelter.getRemark());

        existing = shelterRepository.save(existing);
        log.info("更新安置点成功: id={}", id);
        return ApiResponse.success("安置点更新成功", existing);
    }
}
