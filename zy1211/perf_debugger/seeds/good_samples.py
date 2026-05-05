"""Generate good (normal) sample data for testing."""

from pathlib import Path
from datetime import datetime
import random


def generate_good_samples(output_dir: str, count: int = 1):
    """Generate normal performance sample files.
    
    Args:
        output_dir: Directory to output files
        count: Number of sample sets to generate
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    for i in range(count):
        suffix = f"_{i+1}" if count > 1 else ""
        
        generate_top_normal(output_path / f"top_normal{suffix}.txt")
        generate_vmstat_normal(output_path / f"vmstat_normal{suffix}.txt")
        generate_iostat_normal(output_path / f"iostat_normal{suffix}.txt")
        generate_netstat_normal(output_path / f"netstat_normal{suffix}.txt")
        generate_strace_normal(output_path / f"strace_normal{suffix}.txt")


def generate_top_normal(output_path: Path):
    """Generate a normal top output sample."""
    current_time = datetime.now().strftime("%H:%M:%S")
    
    content = f"""top - {current_time} up 10 days,  2:15,  3 users,  load average: 0.12, 0.08, 0.05
Tasks: 128 total,   1 running, 127 sleeping,   0 stopped,   0 zombie
%Cpu(s):  2.5 us,  1.2 sy,  0.0 ni, 95.8 id,  0.3 wa,  0.0 hi,  0.2 si,  0.0 st
MiB Mem :  15867.3 total,   8234.5 free,   3521.3 used,   4111.5 buff/cache
MiB Swap:   8192.0 total,   8192.0 free,      0.0 used.  11560.2 avail Mem

    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND
   1234 root      20   0  123456  45678  23456 S   3.2   0.3   0:12.34 python3
   2345 www-data  20   0  234567  89012  45678 S   1.5   0.6   0:45.67 nginx
   3456 postgres  20   0  345678 123456  67890 S   0.8   0.8   1:23.45 postgres
   4567 redis     20   0   56789  12345   6789 S   0.5   0.1   0:05.67 redis-server
   5678 root      20   0  987654  34567  23456 S   0.3   0.2   0:01.23 systemd
"""
    
    with open(output_path, 'w') as f:
        f.write(content)


def generate_vmstat_normal(output_path: Path):
    """Generate a normal vmstat output sample."""
    content = """procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
 0  0      0 8432640 204388 4205632    0    0     0    12  105  210  2  1 96  1  0
 0  0      0 8431616 204388 4205640    0    0     0     0  110  220  3  1 95  1  0
 1  0      0 8429568 204388 4205648    0    0     0     8  108  215  2  2 95  1  0
 0  0      0 8430592 204388 4205656    0    0     0     0  102  205  1  1 97  1  0
 0  0      0 8431616 204388 4205664    0    0     0     4  106  212  2  1 96  1  0
"""
    
    with open(output_path, 'w') as f:
        f.write(content)


def generate_iostat_normal(output_path: Path):
    """Generate a normal iostat output sample."""
    content = """Linux 5.4.0-42-generic (server)  05/05/2026  _x86_64_    (8 CPU)

avg-cpu:  %user   %nice %system %iowait  %steal   %idle
           2.30    0.00    1.50    1.20    0.00   95.00

Device             tps    kB_read/s    kB_wrtn/s    kB_read    kB_wrtn
sda               10.00        50.00       100.00       1000       2000
sdb                0.00         0.00         0.00          0          0
"""
    
    with open(output_path, 'w') as f:
        f.write(content)


def generate_netstat_normal(output_path: Path):
    """Generate a normal netstat output sample."""
    content = """Active Internet connections (servers and established)
Proto Recv-Q Send-Q Local Address           Foreign Address         State
tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN
tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN
tcp        0      0 0.0.0.0:443             0.0.0.0:*               LISTEN
tcp        0      0 192.168.1.100:22        10.0.0.1:54321          ESTABLISHED
tcp        0      0 192.168.1.100:80        10.0.0.2:12345          TIME_WAIT
tcp        0      0 192.168.1.100:443       10.0.0.3:56789          ESTABLISHED
udp        0      0 0.0.0.0:53              0.0.0.0:*
"""
    
    with open(output_path, 'w') as f:
        f.write(content)


def generate_strace_normal(output_path: Path):
    """Generate a normal strace output sample."""
    content = """10:30:15 open("/etc/passwd", O_RDONLY) = 3
10:30:15 read(3, "root:x:0:0:root:/root:/bin/bash\n", 4096) = 52
10:30:15 close(3) = 0
10:30:15 socket(AF_INET, SOCK_STREAM, IPPROTO_TCP) = 4
10:30:15 connect(4, {sa_family=AF_INET, sin_port=htons(80), sin_addr=inet_addr("192.168.1.1")}, 16) = 0
10:30:15 write(4, "GET / HTTP/1.1\r\n", 16) = 16
10:30:15 read(4, "HTTP/1.1 200 OK\r\n", 4096) = 17
10:30:15 close(4) = 0
10:30:15 futex(0x7f8a1b2c3d40, FUTEX_WAIT, 0, NULL) = 0
10:30:15 futex(0x7f8a1b2c3d40, FUTEX_WAKE, 1) = 1
"""
    
    with open(output_path, 'w') as f:
        f.write(content)
