package com.livestock.transfer.controller;

import com.livestock.transfer.common.Result;
import com.livestock.transfer.entity.*;
import com.livestock.transfer.repository.*;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/master")
public class MasterDataController {
    private final FarmRepository farmRepository;
    private final EarTagRepository earTagRepository;
    private final QuarantineCertificateRepository certificateRepository;
    private final TransportVehicleRepository vehicleRepository;

    public MasterDataController(FarmRepository farmRepository,
            EarTagRepository earTagRepository,
            QuarantineCertificateRepository certificateRepository,
            TransportVehicleRepository vehicleRepository) {
        this.farmRepository = farmRepository;
        this.earTagRepository = earTagRepository;
        this.certificateRepository = certificateRepository;
        this.vehicleRepository = vehicleRepository;
    }

    @GetMapping("/farms")
    public Result<List<Farm>> getAllFarms() {
        return Result.success(farmRepository.findAll());
    }

    @PostMapping("/farms")
    public Result<Farm> createFarm(@RequestBody Farm farm) {
        return Result.success(farmRepository.save(farm));
    }

    @GetMapping("/ear-tags")
    public Result<List<EarTag>> getAllEarTags() {
        return Result.success(earTagRepository.findAll());
    }

    @PostMapping("/ear-tags")
    public Result<EarTag> createEarTag(@RequestBody EarTag earTag) {
        return Result.success(earTagRepository.save(earTag));
    }

    @GetMapping("/certificates")
    public Result<List<QuarantineCertificate>> getAllCertificates() {
        return Result.success(certificateRepository.findAll());
    }

    @PostMapping("/certificates")
    public Result<QuarantineCertificate> createCertificate(@RequestBody QuarantineCertificate cert) {
        return Result.success(certificateRepository.save(cert));
    }

    @GetMapping("/vehicles")
    public Result<List<TransportVehicle>> getAllVehicles() {
        return Result.success(vehicleRepository.findAll());
    }

    @PostMapping("/vehicles")
    public Result<TransportVehicle> createVehicle(@RequestBody TransportVehicle vehicle) {
        return Result.success(vehicleRepository.save(vehicle));
    }
}
