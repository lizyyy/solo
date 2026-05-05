#ifndef CACHE_LAB_UTILS_H
#define CACHE_LAB_UTILS_H

#include <cstdint>
#include <cstddef>
#include <vector>
#include <random>

namespace cache_lab {
namespace utils {

inline uint64_t rdtsc() {
    uint32_t lo, hi;
    __asm__ __volatile__ (
        "lfence\n\t"
        "rdtsc\n\t"
        : "=a" (lo), "=d" (hi)
    );
    return (static_cast<uint64_t>(hi) << 32) | lo;
}

inline void cpu_relax() {
    __asm__ __volatile__ ("pause" : : : "memory");
}

inline void mfence() {
    __asm__ __volatile__ ("mfence" : : : "memory");
}

class Timer {
public:
    Timer() : start_(std::chrono::high_resolution_clock::now()) {}
    
    void Reset() {
        start_ = std::chrono::high_resolution_clock::now();
    }
    
    double ElapsedMilliseconds() const {
        auto now = std::chrono::high_resolution_clock::now();
        return std::chrono::duration<double, std::milli>(now - start_).count();
    }
    
    double ElapsedNanoseconds() const {
        auto now = std::chrono::high_resolution_clock::now();
        return std::chrono::duration<double, std::nano>(now - start_).count();
    }

private:
    std::chrono::high_resolution_clock::time_point start_;
};

class RandomGenerator {
public:
    explicit RandomGenerator(uint64_t seed) : rng_(seed) {}
    
    uint64_t Next() {
        return rng_();
    }
    
    size_t NextRange(size_t min, size_t max) {
        std::uniform_int_distribution<size_t> dist(min, max);
        return dist(rng_);
    }
    
    void Shuffle(std::vector<size_t>& vec) {
        std::shuffle(vec.begin(), vec.end(), rng_);
    }

private:
    std::mt19937_64 rng_;
};

inline size_t GetCacheLineSize() {
#ifdef _WIN32
    SYSTEM_LOGICAL_PROCESSOR_INFORMATION buffer[1024];
    DWORD returnLength = 0;
    if (GetLogicalProcessorInformation(buffer, &returnLength)) {
        for (DWORD i = 0; i < returnLength / sizeof(SYSTEM_LOGICAL_PROCESSOR_INFORMATION); ++i) {
            if (buffer[i].Relationship == RelationCache && buffer[i].Cache.Level == 1) {
                return buffer[i].Cache.LineSize;
            }
        }
    }
    return 64;
#elif __linux__
    long size = sysconf(_SC_LEVEL1_DCACHE_LINESIZE);
    return (size > 0) ? static_cast<size_t>(size) : 64;
#elif __APPLE__
    size_t lineSize = 0;
    size_t sizeofLineSize = sizeof(lineSize);
    if (sysctlbyname("hw.cachelinesize", &lineSize, &sizeofLineSize, NULL, 0) == 0) {
        return lineSize;
    }
    return 64;
#else
    return 64;
#endif
}

inline size_t RoundUpToAlignment(size_t size, size_t alignment) {
    return (size + alignment - 1) & ~(alignment - 1);
}

}
}

#endif
