"""Generate bad (anomaly) sample data for testing."""

from pathlib import Path
from datetime import datetime
import random


def generate_bad_samples(output_dir: str, issue_type: str = 'all', count: int = 1):
    """Generate performance anomaly sample files.
    
    Args:
        output_dir: Directory to output files
        issue_type: Type of issue to generate: cpu_spike, io_wait, network_block, syscall_block, or all
        count: Number of sample sets to generate
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    for i in range(count):
        suffix = f"_{i+1}" if count > 1 else ""
        
        if issue_type == 'cpu_spike' or issue_type == 'all':
            generate_top_cpu_spike(output_path / f"top_cpu_spike{suffix}.txt")
            generate_perf_script_hotspot(output_path / f"perf_hotspot{suffix}.txt")
            generate_flame_graph_hotspot(output_path / f"flame_hotspot{suffix}.txt")
        
        if issue_type == 'io_wait' or issue_type == 'all':
            generate_iostat_high_iowait(output_path / f"iostat_high_iowait{suffix}.txt")
            generate_vmstat_io_block(output_path / f"vmstat_io_block{suffix}.txt")
        
        if issue_type == 'network_block' or issue_type == 'all':
            generate_netstat_high_connections(output_path / f"netstat_high_conn{suffix}.txt")
        
        if issue_type == 'syscall_block' or issue_type == 'all':
            generate_strace_slow_syscalls(output_path / f"strace_slow{suffix}.txt")


def generate_top_cpu_spike(output_path: Path):
    """Generate a top output sample with CPU spike."""
    current_time = datetime.now().strftime("%H:%M:%S")
    
    content = f"""top - {current_time} up 10 days,  2:15,  3 users,  load average: 8.12, 5.08, 3.05
Tasks: 128 total,   3 running, 124 sleeping,   0 stopped,   1 zombie
%Cpu(s):  85.2 us,  10.5 sy,  0.0 ni,  3.0 id,  1.0 wa,  0.0 hi,  0.3 si,  0.0 st
MiB Mem :  15867.3 total,   1234.5 free,  12521.3 used,   2111.5 buff/cache
MiB Swap:   8192.0 total,   6192.0 free,   2000.0 used.   2560.2 avail Mem

    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND
   9999 root      20   0  567890 345678  12345 R  95.2  22.0  12:34.56 malicious_process
   8888 root      20   0  234567 123456  45678 R  80.0   8.0   5:43.21 cpu_hog
   7777 www-data  20   0  345678  89012  34567 S  15.0   0.6   0:45.67 nginx
   6666 postgres  20   0  345678 123456  67890 S   5.0   0.8   1:23.45 postgres
   5555 redis     20   0   56789  12345   6789 S   2.0   0.1   0:05.67 redis-server
"""
    
    with open(output_path, 'w') as f:
        f.write(content)


def generate_iostat_high_iowait(output_path: Path):
    """Generate an iostat output sample with high IO wait."""
    content = """Linux 5.4.0-42-generic (server)  05/05/2026  _x86_64_    (8 CPU)

avg-cpu:  %user   %nice %system %iowait  %steal   %idle
           5.30    0.00    3.50   45.20    0.00   46.00

Device             tps    kB_read/s    kB_wrtn/s    kB_read    kB_wrtn
sda              850.00      5000.00    150000.00     100000    3000000
sdb                0.00         0.00         0.00          0          0
"""
    
    with open(output_path, 'w') as f:
        f.write(content)


def generate_vmstat_io_block(output_path: Path):
    """Generate a vmstat output sample with IO blocking."""
    content = """procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
 0  5      0 123456 204388 4205632    0    0  5000 150000 2000 4000  5  3 46 46  0
 1  6      0 123168 204388 4205640    0    0  6000 160000 2100 4200  6  4 44 46  0
 2  7      0 122560 204388 4205648    0    0  5500 155000 2050 4100  5  3 45 47  0
 1  5      0 123072 204388 4205656    0    0  4800 145000 1950 3900  4  3 47 46  0
 0  4      0 123400 204388 4205664    0    0  5200 152000 2020 4040  5  3 46 46  0
"""
    
    with open(output_path, 'w') as f:
        f.write(content)


def generate_netstat_high_connections(output_path: Path):
    """Generate a netstat output sample with high connection count."""
    lines = [
        "Active Internet connections (servers and established)",
        "Proto Recv-Q Send-Q Local Address           Foreign Address         State",
        "tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN",
        "tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN",
        "tcp        0      0 0.0.0.0:443             0.0.0.0:*               LISTEN",
    ]
    
    for i in range(100):
        port = 50000 + i
        lines.append(f"tcp        0      0 192.168.1.100:443       10.0.0.{i%255}:{port}          ESTABLISHED")
    
    for i in range(600):
        port = 51000 + i
        lines.append(f"tcp        0      0 192.168.1.100:80        10.0.1.{i%255}:{port}          TIME_WAIT")
    
    lines.append("tcp      500      0 192.168.1.100:443       10.0.2.1:12345          ESTABLISHED")
    lines.append("tcp      300      0 192.168.1.100:443       10.0.2.2:12346          ESTABLISHED")
    lines.append("tcp        0    800 192.168.1.100:443       10.0.2.3:12347          ESTABLISHED")
    
    content = "\n".join(lines)
    
    with open(output_path, 'w') as f:
        f.write(content)


def generate_strace_slow_syscalls(output_path: Path):
    """Generate a strace output sample with slow syscalls."""
    content = """10:30:15 open("/var/log/big.log", O_RDONLY) = 3
10:30:15 read(3, "data...", 4096) = 4096 <0.500000>
10:30:15 read(3, "more data...", 4096) = 4096 <0.450000>
10:30:15 read(3, "even more...", 4096) = 4096 <0.520000>
10:30:15 close(3) = 0
10:30:15 socket(AF_INET, SOCK_STREAM, IPPROTO_TCP) = 4
10:30:15 connect(4, {sa_family=AF_INET, sin_port=htons(80), ...}, 16) = 0 <0.300000>
10:30:15 poll([{fd=4, events=POLLIN}], 1, 5000) = 0 (Timeout) <5.000000>
10:30:15 futex(0x7f8a1b2c3d40, FUTEX_WAIT, 0, NULL) = 0 <2.500000>
10:30:15 futex(0x7f8a1b2c3d40, FUTEX_WAIT, 0, NULL) = 0 <3.200000>
10:30:15 futex(0x7f8a1b2c3d40, FUTEX_WAIT, 0, NULL) = 0 <1.800000>
10:30:15 futex(0x7f8a1b2c3d40, FUTEX_WAIT, 0, NULL) = 0 <4.100000>
10:30:15 futex(0x7f8a1b2c3d40, FUTEX_WAKE, 1) = 1
10:30:15 open("/nonexistent", O_RDONLY) = -1 ENOENT (No such file or directory)
10:30:15 open("/etc/shadow", O_RDONLY) = -1 EACCES (Permission denied)
10:30:15 close(-1) = -1 EBADF (Bad file descriptor)
"""
    
    with open(output_path, 'w') as f:
        f.write(content)


def generate_perf_script_hotspot(output_path: Path):
    """Generate a perf script output sample with hotspots."""
    content = """python3  9999 [001] 1234567.890123: cpu-clock:
        0x7f8a1b2c3d4e /lib64/libc.so.6+0x12345
        0x55c9a1b2c3d4 /usr/bin/python3+0x98765
        0x55c9a1b2c3d5 /usr/bin/python3+0x98766
        compute_intensive

python3  9999 [001] 1234567.890124: cpu-clock:
        0x7f8a1b2c3d4e /lib64/libc.so.6+0x12345
        0x55c9a1b2c3d4 /usr/bin/python3+0x98765
        compute_intensive

python3  9999 [001] 1234567.890125: cpu-clock:
        0x7f8a1b2c3d4e /lib64/libc.so.6+0x12345
        0x55c9a1b2c3d4 /usr/bin/python3+0x98765
        0x55c9a1b2c3d5 /usr/bin/python3+0x98766
        compute_intensive
        nested_loop

python3  9999 [001] 1234567.890126: cpu-clock:
        0x7f8a1b2c3d4e /lib64/libc.so.6+0x12345
        0x55c9a1b2c3d4 /usr/bin/python3+0x98765
        compute_intensive

python3  9999 [002] 1234567.890127: cpu-clock:
        0x7f8a1b2c3d4e /lib64/libc.so.6+0x12345
        0x55c9a1b2c3d4 /usr/bin/python3+0x98765
        0x55c9a1b2c3d5 /usr/bin/python3+0x98766
        compute_intensive
        nested_loop
        inner_math
"""
    
    with open(output_path, 'w') as f:
        f.write(content)


def generate_flame_graph_hotspot(output_path: Path):
    """Generate a flame graph folded stack sample with hotspots."""
    content = """_start;main;compute_intensive;nested_loop;inner_math 850
_start;main;compute_intensive;nested_loop 650
_start;main;compute_intensive 400
_start;main;io_read;pread64 200
_start;main;io_write;pwrite64 150
_start;main;network_connect;connect 100
_start;main;network_read;recv 80
_start;main;network_write;send 70
_start;main;memory_alloc;malloc 50
_start;main;memory_free;free 40
_start;main;lock_acquire;futex 200
_start;main;lock_release;futex 180
_start;main;parse_json;json_decode 120
_start;main;parse_json;string_process 80
_start;main;hash_compute;sha256_transform 300
_start;main;hash_compute;md5_transform 100
_start;main;compression;zlib_deflate 250
_start;main;compression;zlib_inflate 150
"""
    
    with open(output_path, 'w') as f:
        f.write(content)
