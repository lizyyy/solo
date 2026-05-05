package samples

const (
	normalTopSample = `top - 14:32:01 up  2:15,  1 user,  load average: 0.12, 0.08, 0.05
Tasks: 198 total,   1 running, 197 sleeping,   0 stopped,   0 zombie
%Cpu(s):  2.3 us,  0.8 sy,  0.0 ni, 96.5 id,  0.2 wa,  0.0 hi,  0.2 si,  0.0 st
MiB Mem :  15875.7 total,  11234.5 free,   1892.3 used,   2748.9 buff/cache
MiB Swap:   2048.0 total,   2048.0 free,      0.0 used.  13234.7 avail Mem

    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND
   1432 root      20   0 4292528 287488 139136 S   5.3   1.8   0:45.23 gnome-shell
   2134 user      20   0 1258828 123456  78904 S   2.7   0.8   0:12.34 firefox
   1024 root      20   0  168328  45678  23456 S   1.3   0.3   0:02.12 Xorg
      1 root      20   0  169548  12345   8232 S   0.0   0.1   0:01.23 systemd
      2 root      20   0       0      0      0 S   0.0   0.0   0:00.00 kthreadd

top - 14:32:02 up  2:15,  1 user,  load average: 0.11, 0.08, 0.05
Tasks: 198 total,   1 running, 197 sleeping,   0 stopped,   0 zombie
%Cpu(s):  1.8 us,  0.6 sy,  0.0 ni, 97.2 id,  0.1 wa,  0.0 hi,  0.3 si,  0.0 st
MiB Mem :  15875.7 total,  11245.2 free,   1887.6 used,   2742.9 buff/cache
MiB Swap:   2048.0 total,   2048.0 free,      0.0 used.  13245.2 avail Mem

    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND
   1432 root      20   0 4292528 287600 139200 S   3.0   1.8   0:45.26 gnome-shell
   2134 user      20   0 1258828 123500  78932 S   1.5   0.8   0:12.35 firefox
   1024 root      20   0  168328  45690  23470 S   1.0   0.3   0:02.13 Xorg
`

	normalVmstatSample = `procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
 0  0      0 1148828 21548 2835424    0    0     0    12  101  234  2  1 96  1  0
 0  0      0 1149828 21548 2835424    0    0     0     0   98  215  1  0 98  1  0
 1  0      0 1147828 21552 2835920    0    0     0    48  125  289  3  1 95  1  0
 0  0      0 1149328 21552 2835920    0    0     0     0  105  256  2  1 96  1  0
 0  0      0 1149328 21552 2835920    0    0     0     0   92  198  1  0 98  1  0
`

	normalIostatSample = `Linux 5.15.0-91-generic (test-host) 	01/15/2024 	_x86_64_	(8 CPU)

avg-cpu:  %user   %nice %system %iowait  %steal   %idle
           2.32    0.00    0.85    0.25    0.00   96.58

Device            r/s     w/s     rkB/s     wkB/s   rrqm/s   wrqm/s  %rrqm  %wrqm r_await w_await aqu-sz rareq-sz wareq-sz  svctm  %util
sda               0.12    0.25     12.34     45.67     0.01     0.05   7.69  16.67    2.50    3.20   0.01   102.83   182.68   1.25   0.05
sdb               0.00    0.00      0.00      0.00     0.00     0.00   0.00   0.00    0.00    0.00   0.00     0.00     0.00   0.00   0.00
`

	normalSsSample = `Netid State      Recv-Q      Send-Q           Local Address:Port           Peer Address:Port  Process
tcp   LISTEN     0           128                    0.0.0.0:22                  0.0.0.0:*      ino:16438 sk:1 <->
tcp   LISTEN     0           4096                 127.0.0.1:631                 0.0.0.0:*      ino:19526 sk:2 <->
tcp   ESTAB      0           0              192.168.1.100:45678         104.16.132.229:443    users:(("firefox",pid=2134,fd=123))
tcp   ESTAB      0           0              192.168.1.100:34567          140.82.112.3:443    users:(("git",pid=5678,fd=45))
tcp   TIME-WAIT  0           0              192.168.1.100:52341         151.101.1.69:443    
`

	normalStraceSample = `1234 0.000000 epoll_wait(5, [], 256, 0) = 0 <0.000012>
1234 0.000035 futex(0x555555789abc, FUTEX_WAIT_BITSET_PRIVATE|FUTEX_CLOCK_REALTIME, 0, {tv_sec=1705329121, tv_nsec=999983000}, FUTEX_BITSET_MATCH_ANY) = 0 <0.001456>
1234 0.001527 epoll_wait(5, [{events=EPOLLIN, data={u32=34, u64=34}}], 256, -1) = 1 <0.000123>
1234 0.001689 read(34, "\x01\x00\x00\x00\x00\x00\x00\x00", 16) = 8 <0.000045>
1234 0.001768 futex(0x555555789def, FUTEX_WAKE_PRIVATE, 1) = 1 <0.000021>
1234 0.001823 epoll_wait(5, [], 256, 0) = 0 <0.000015>
1234 0.001865 futex(0x555555789abc, FUTEX_WAIT_BITSET_PRIVATE|FUTEX_CLOCK_REALTIME, 0, {tv_sec=1705329131, tv_nsec=999983000}, FUTEX_BITSET_MATCH_ANY) = 0 <0.009876>
`

	normalPerfSample = `gnome-shell  1432 [001] 12345.678901:     100000 cycles:
            55555567890a unknown (/usr/bin/gnome-shell)
            7ffff1234567 unknown (/usr/lib/x86_64-linux-gnu/libmutter-10.so.0.0.0)
            7ffff1234890 unknown (/usr/lib/x86_64-linux-gnu/libmutter-10.so.0.0.0)
            7ffff0abcdef g_main_context_dispatch (/usr/lib/x86_64-linux-gnu/libglib-2.0.so.0.7200.4)

firefox      2134 [002] 12345.678910:     100000 cycles:
            7ffff2345678 unknown (/usr/lib/firefox/libxul.so)
            7ffff2345901 unknown (/usr/lib/firefox/libxul.so)
            7ffff2345b23 JS::CallInterpreted (/usr/lib/firefox/libxul.so)
            7ffff2345d45 JS::Call (/usr/lib/firefox/libxul.so)
`

	normalFoldedSample = `gnome-shell;g_main_context_dispatch;mutter_clock_get_time;poll 50
gnome-shell;g_main_context_dispatch;g_main_context_iterate 30
firefox;JS::Call;JS::CallInterpreted;js::Interpret 120
firefox;JS::Call;js::RunScript 45
Xorg;WaitForSomething;poll 25
`
)

const (
	abnormalTopSample = `top - 14:45:01 up  2:28,  1 user,  load average: 15.23, 12.45, 8.90
Tasks: 345 total,  12 running, 330 sleeping,   2 stopped,   1 zombie
%Cpu(s): 89.5 us,  8.2 sy,  0.0 ni,  0.5 id,  1.2 wa,  0.3 hi,  0.3 si,  0.0 st
MiB Mem :  15875.7 total,    123.4 free,  14567.8 used,   1184.5 buff/cache
MiB Swap:   2048.0 total,    234.5 free,   1813.5 used.     89.3 avail Mem

    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND
   9876 user      20   0 8523456 789012  45678 R  125.6   4.9  15:23.45 malicious.sh
   8765 user      20   0 4321098 654321  34567 R   98.7   4.1   8:45.12 miner
   7654 root      20   0  234567  98765  12345 D   45.3   0.6   2:34.56 kjournald2
   6543 user      20   0  123456  56789  23456 S   12.1   0.4   0:45.23 firefox
   5432 root      20   0   87654  34567  12345 S    5.4   0.2   0:12.34 sshd
`

	abnormalVmstatSample = `procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
12  3 1857024  126412   2345  123456 1234 5678  8901 23456 4567 9876 89  8  1  2  0
15  4 1857524  125912   2340  123956 2345 6789 12345 34567 5678 12345 90  7  1  2  0
18  5 1858024  125412   2335  124456 3456 7890 15678 45678 6789 15678 91  6  1  2  0
20  6 1858524  124912   2330  124956 4567 8901 18901 56789 7890 18901 92  5  1  2  0
17  5 1859024  124412   2325  125456 5678 9012 22134 67890 8901 22134 93  4  1  2  0
`

	abnormalIostatSample = `Linux 5.15.0-91-generic (test-host) 	01/15/2024 	_x86_64_	(8 CPU)

avg-cpu:  %user   %nice %system %iowait  %steal   %idle
          89.23    0.00    7.45    2.34    0.00    0.98

Device            r/s     w/s     rkB/s     wkB/s   rrqm/s   wrqm/s  %rrqm  %wrqm r_await w_await aqu-sz rareq-sz wareq-sz  svctm  %util
sda             234.56  567.89  12345.67  45678.90    12.34    56.78   5.01  9.08   45.23   67.89  23.45    52.63    80.45   2.34  95.67
sdb               0.00    0.00      0.00      0.00     0.00     0.00   0.00   0.00    0.00    0.00   0.00     0.00     0.00   0.00   0.00
`

	abnormalSsSample = `Netid State      Recv-Q      Send-Q           Local Address:Port           Peer Address:Port  Process
tcp   LISTEN     0           128                    0.0.0.0:22                  0.0.0.0:*      ino:16438 sk:1 <->
tcp   LISTEN     0           4096                 127.0.0.1:631                 0.0.0.0:*      ino:19526 sk:2 <->
tcp   SYN-SENT   0           1              192.168.1.100:45678         192.168.1.200:8080   
tcp   SYN-SENT   0           1              192.168.1.100:45679         192.168.1.200:8080   
tcp   SYN-SENT   0           1              192.168.1.100:45680         192.168.1.200:8080   
tcp   SYN-RECV   0           0              192.168.1.100:22          10.0.0.50:12345   
tcp   SYN-RECV   0           0              192.168.1.100:22          10.0.0.51:23456   
tcp   TIME-WAIT  0           0              192.168.1.100:52341         151.101.1.69:443    
tcp   TIME-WAIT  0           0              192.168.1.100:52342         151.101.1.69:443    
tcp   TIME-WAIT  0           0              192.168.1.100:52343         151.101.1.69:443    
tcp   TIME-WAIT  0           0              192.168.1.100:52344         151.101.1.69:443    
tcp   TIME-WAIT  0           0              192.168.1.100:52345         151.101.1.69:443    
... (5000+ more TIME_WAIT connections)
`

	abnormalStraceSample = `9876 0.000000 clone(child_stack=0x7ffff1234567, flags=CLONE_VM|CLONE_FS|CLONE_FILES|CLONE_SIGHAND|CLONE_THREAD|CLONE_SYSVSEM|CLONE_SETTLS|CLONE_PARENT_SETTID|CLONE_CHILD_CLEARTID, parent_tidptr=0x7ffff12349a0, tls=0x7ffff1234700, child_tidptr=0x7ffff12349a0) = 9877 <0.000123>
9876 0.000156 nanosleep({tv_sec=0, tv_nsec=100000}, 0x7ffff1234580) = 0 <0.000100>
9876 0.000278 open("/dev/null", O_RDWR) = 123 <0.000034>
9876 0.000325 write(123, "A", 1) = 1 <2.345678>
9876 2.346012 close(123) = 0 <0.000023>
9876 2.346052 clone(child_stack=0x7ffff1234567, flags=CLONE_VM|CLONE_FS|CLONE_FILES|CLONE_SIGHAND|CLONE_THREAD|CLONE_SYSVSEM|CLONE_SETTLS|CLONE_PARENT_SETTID|CLONE_CHILD_CLEARTID, parent_tidptr=0x7ffff12349a0, tls=0x7ffff1234700, child_tidptr=0x7ffff12349a0) = 9878 <0.000112>
9876 2.346180 nanosleep({tv_sec=0, tv_nsec=100000}, 0x7ffff1234580) = 0 <0.000098>
9876 2.346296 open("/dev/null", O_RDWR) = 123 <0.000028>
9876 2.346334 write(123, "A", 1) = 1 <3.456789>
9876 5.803145 close(123) = 0 <0.000021>
9876 5.803184 futex(0x555555789abc, FUTEX_WAIT_PRIVATE, 0, NULL) = -1 EAGAIN (Resource temporarily unavailable) <0.000015>
9876 5.803212 futex(0x555555789def, FUTEX_WAIT_PRIVATE, 0, NULL) = -1 EAGAIN (Resource temporarily unavailable) <0.000012>
`

	abnormalPerfSample = `malicious.s  9876 [000] 12345.678901:     100000 cycles:
            55555567890a malicious_loop (/home/user/malicious.sh)
            555555678950 do_work (/home/user/malicious.sh)
            555555678990 main (/home/user/malicious.sh)

miner        8765 [001] 12345.678910:     100000 cycles:
            7ffff2345678 sha256_transform (/usr/lib/libcrypto.so.1.1)
            7ffff2345901 SHA256_Update (/usr/lib/libcrypto.so.1.1)
            7ffff2345b23 mine_hash (/home/user/miner)
            7ffff2345d45 worker_thread (/home/user/miner)

kjournald2    7654 [002] 12345.678920:     100000 cycles:
            7ffff0abcdef io_schedule (/boot/vmlinuz-5.15.0-91-generic)
            7ffff0ab1234 wait_on_page_bit (/boot/vmlinuz-5.15.0-91-generic)
            7ffff0ab5678 __lock_page (/boot/vmlinuz-5.15.0-91-generic)
            7ffff0ab9abc find_get_page (/boot/vmlinuz-5.15.0-91-generic)
`

	abnormalFoldedSample = `malicious.sh;main;do_work;malicious_loop 5000
miner;worker_thread;mine_hash;SHA256_Update;sha256_transform 3500
kjournald2;find_get_page;__lock_page;wait_on_page_bit;io_schedule 2000
firefox;JS::Call;JS::CallInterpreted 50
`
)

func GetNormalSample() (map[string]string, error) {
	return map[string]string{
		"top.txt":         normalTopSample,
		"vmstat.txt":      normalVmstatSample,
		"iostat.txt":      normalIostatSample,
		"ss.txt":          normalSsSample,
		"strace.txt":      normalStraceSample,
		"perf_script.txt": normalPerfSample,
		"folded.txt":      normalFoldedSample,
	}, nil
}

func GetAbnormalSample() (map[string]string, error) {
	return map[string]string{
		"top.txt":         abnormalTopSample,
		"vmstat.txt":      abnormalVmstatSample,
		"iostat.txt":      abnormalIostatSample,
		"ss.txt":          abnormalSsSample,
		"strace.txt":      abnormalStraceSample,
		"perf_script.txt": abnormalPerfSample,
		"folded.txt":      abnormalFoldedSample,
	}, nil
}
