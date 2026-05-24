package com.ski.rental.service;

import com.ski.rental.model.BindingSpec;
import com.ski.rental.model.Customer;
import com.ski.rental.model.Snowboard;
import com.ski.rental.repository.CustomerRepository;
import com.ski.rental.repository.SnowboardRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
public class DataInitializer implements CommandLineRunner {
    private final SnowboardRepository snowboardRepository;
    private final CustomerRepository customerRepository;

    public DataInitializer(SnowboardRepository snowboardRepository, CustomerRepository customerRepository) {
        this.snowboardRepository = snowboardRepository;
        this.customerRepository = customerRepository;
    }

    @Override
    public void run(String... args) {
        if (snowboardRepository.count() == 0) {
            initSnowboards();
        }
        if (customerRepository.count() == 0) {
            initCustomers();
        }
    }

    private void initSnowboards() {
        List<Snowboard> snowboards = new ArrayList<>();

        for (int i = 1; i <= 5; i++) {
            BindingSpec binding = new BindingSpec();
            binding.setBindingModel("Marker-Griffon-" + i);
            binding.setMinReleaseValue(new BigDecimal("4.0"));
            binding.setMaxReleaseValue(new BigDecimal("12.0"));
            binding.setMinBootSize(25);
            binding.setMaxBootSize(32);
            binding.setRecommendedHeightMin(new BigDecimal("160"));
            binding.setRecommendedHeightMax(new BigDecimal("190"));
            binding.setRecommendedWeightMin(new BigDecimal("60"));
            binding.setRecommendedWeightMax(new BigDecimal("100"));

            Snowboard board = new Snowboard();
            board.setBoardCode("BOARD-" + String.format("%03d", i));
            board.setBrand(i % 2 == 0 ? "Burton" : "K2");
            board.setModel("Model-" + i);
            board.setLengthCm(150 + i * 5);
            board.setBoardType(i % 3 == 0 ? "Freestyle" : i % 3 == 1 ? "All-Mountain" : "Carving");
            board.setIsAvailable(true);
            board.setBindingSpec(binding);

            snowboards.add(board);
        }

        snowboardRepository.saveAll(snowboards);
        System.out.println("初始化 " + snowboards.size() + " 块雪板数据完成");
    }

    private void initCustomers() {
        List<Customer> customers = new ArrayList<>();

        for (int i = 1; i <= 5; i++) {
            Customer customer = new Customer();
            customer.setCustomerId("CUST-" + String.format("%03d", i));
            customer.setName("租客" + i);
            customer.setPhone("138" + String.format("%08d", 10000000 + i));
            customer.setIdCard("110101199" + (i % 10) + "0101" + String.format("%04d", i));
            customer.setHeightCm(new BigDecimal("17" + i));
            customer.setWeightKg(new BigDecimal("7" + i));
            customer.setBootSize(26 + (i % 3));
            customer.setSkillLevel(i % 4 + 1);
            customer.setPreferredReleaseValue(new BigDecimal("6.0"));

            customers.add(customer);
        }

        customerRepository.saveAll(customers);
        System.out.println("初始化 " + customers.size() + " 个租客数据完成");
    }

    public void resetData() {
        snowboardRepository.deleteAll();
        customerRepository.deleteAll();
        initSnowboards();
        initCustomers();
    }
}
