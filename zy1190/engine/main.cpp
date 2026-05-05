#include <iostream>
#include <fstream>
#include <string>
#include <cstdint>
#include <nlohmann/json.hpp>
#include "benchmark.h"
#include "utils.h"

using json = nlohmann::json;
using namespace cache_lab;

void PrintHelp() {
    std::cout << "CacheLab Engine - CPU Cache Performance Benchmark\n"
              << "Usage: cache_bench [OPTIONS]\n\n"
              << "Options:\n"
              << "  --test <name>       Test name: sequential, stride, random, false_sharing, numa\n"
              << "  --array-size <N>    Array size in bytes (default: 67108864 = 64MB)\n"
              << "  --stride <N>        Access stride in elements (default: 1)\n"
              << "  --threads <N>       Number of threads (default: 1)\n"
              << "  --cache-line <N>    Cache line size in bytes (default: 64)\n"
              << "  --iterations <N>    Number of iterations (default: 10)\n"
              << "  --seed <N>          Random seed (default: 42)\n"
              << "  --layout <type>     Struct layout for false_sharing: bad, good, mixed (default: bad)\n"
              << "  --numa-node <N>     NUMA node for numa test (default: 0)\n"
              << "  --config <file>     Read config from JSON file\n"
              << "  --output <file>     Write results to JSON file\n"
              << "  --list-tests        List available tests\n"
              << "  --help              Show this help\n";
}

int main(int argc, char* argv[]) {
    BenchmarkConfig config = {
        .array_size = 67108864,
        .stride = 1,
        .thread_count = 1,
        .cache_line_size = 64,
        .use_numa = false,
        .numa_node = 0,
        .iterations = 10,
        .seed = 42,
        .struct_layout = "bad"
    };
    
    std::string test_name = "sequential";
    std::string config_file;
    std::string output_file;
    bool list_tests = false;
    
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        
        if (arg == "--test" && i + 1 < argc) {
            test_name = argv[++i];
        } else if (arg == "--array-size" && i + 1 < argc) {
            config.array_size = std::stoull(argv[++i]);
        } else if (arg == "--stride" && i + 1 < argc) {
            config.stride = std::stoull(argv[++i]);
        } else if (arg == "--threads" && i + 1 < argc) {
            config.thread_count = std::stoull(argv[++i]);
        } else if (arg == "--cache-line" && i + 1 < argc) {
            config.cache_line_size = std::stoull(argv[++i]);
        } else if (arg == "--iterations" && i + 1 < argc) {
            config.iterations = std::stoi(argv[++i]);
        } else if (arg == "--seed" && i + 1 < argc) {
            config.seed = std::stoull(argv[++i]);
        } else if (arg == "--layout" && i + 1 < argc) {
            config.struct_layout = argv[++i];
        } else if (arg == "--numa-node" && i + 1 < argc) {
            config.numa_node = std::stoi(argv[++i]);
            config.use_numa = true;
        } else if (arg == "--config" && i + 1 < argc) {
            config_file = argv[++i];
        } else if (arg == "--output" && i + 1 < argc) {
            output_file = argv[++i];
        } else if (arg == "--list-tests") {
            list_tests = true;
        } else if (arg == "--help") {
            PrintHelp();
            return 0;
        }
    }
    
    if (list_tests) {
        auto& engine = BenchmarkEngine::Instance();
        std::cout << "Available tests:\n";
        for (const auto& t : engine.GetAvailableTests()) {
            std::cout << "  - " << t << "\n";
        }
        return 0;
    }
    
    if (!config_file.empty()) {
        std::ifstream f(config_file);
        if (f.is_open()) {
            json j;
            f >> j;
            
            if (j.contains("test_name")) test_name = j["test_name"];
            if (j.contains("array_size")) config.array_size = j["array_size"];
            if (j.contains("stride")) config.stride = j["stride"];
            if (j.contains("thread_count")) config.thread_count = j["thread_count"];
            if (j.contains("cache_line_size")) config.cache_line_size = j["cache_line_size"];
            if (j.contains("iterations")) config.iterations = j["iterations"];
            if (j.contains("seed")) config.seed = j["seed"];
            if (j.contains("struct_layout")) config.struct_layout = j["struct_layout"];
            if (j.contains("numa_node")) {
                config.numa_node = j["numa_node"];
                config.use_numa = true;
            }
        }
    }
    
    std::string test_full_name;
    if (test_name == "sequential") test_full_name = "sequential_access";
    else if (test_name == "stride") test_full_name = "stride_access";
    else if (test_name == "random") test_full_name = "random_access";
    else if (test_name == "false_sharing") test_full_name = "false_sharing";
    else if (test_name == "numa") test_full_name = "numa_test";
    else test_full_name = test_name;
    
    try {
        auto& engine = BenchmarkEngine::Instance();
        auto result = engine.RunBenchmark(test_full_name, config);
        
        json output = {
            {"test_name", result.test_name},
            {"total_time_ms", result.total_time_ms},
            {"throughput_mbs", result.throughput_mbs},
            {"avg_latency_ns", result.avg_latency_ns},
            {"cache_hits", result.cache_hits},
            {"cache_misses", result.cache_misses},
            {"latency_timeline", result.latency_timeline},
            {"thread_conflicts", result.thread_conflicts},
            {"metadata", result.metadata},
            {"config", {
                {"array_size", config.array_size},
                {"stride", config.stride},
                {"thread_count", config.thread_count},
                {"cache_line_size", config.cache_line_size},
                {"iterations", config.iterations},
                {"seed", config.seed},
                {"struct_layout", config.struct_layout},
                {"numa_node", config.numa_node}
            }}
        };
        
        if (!output_file.empty()) {
            std::ofstream f(output_file);
            f << output.dump(2);
            std::cout << "Results written to: " << output_file << "\n";
        } else {
            std::cout << output.dump(2) << "\n";
        }
        
        std::cout << "\n=== Summary ===\n"
                  << "Test: " << result.test_name << "\n"
                  << "Time: " << result.total_time_ms << " ms\n"
                  << "Throughput: " << result.throughput_mbs << " MB/s\n"
                  << "Avg Latency: " << result.avg_latency_ns << " ns\n"
                  << "Cache Hits: " << result.cache_hits << "\n"
                  << "Cache Misses: " << result.cache_misses << "\n";
        
        if (result.cache_hits + result.cache_misses > 0) {
            double hit_rate = (static_cast<double>(result.cache_hits) / 
                              (result.cache_hits + result.cache_misses)) * 100.0;
            std::cout << "Hit Rate: " << hit_rate << "%\n";
        }
        
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << "\n";
        return 1;
    }
    
    return 0;
}
