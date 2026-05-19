import random
import uuid
from datetime import datetime, timedelta

def generate_nginx_log(count: int = 100):
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)",
        "curl/7.68.0",
        "python-requests/2.31.0",
        "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Sogou web spider/4.0(+http://www.sogou.com/docs/help/webmasters.htm#07)"
    ]
    paths = [
        "/", "/index.html", "/products", "/api/v1/users", "/api/v1/products",
        "/robots.txt", "/sitemap.xml", "/admin/login", "/wp-admin", "/about",
        "/contact", "/blog/post-1", "/blog/post-2", "/css/main.css", "/js/app.js",
        "/images/logo.png", "/api/v2/data", "/.env", "/.git/config"
    ]
    methods = ["GET", "POST", "HEAD", "OPTIONS", "PUT"]
    statuses = [200, 200, 200, 201, 301, 302, 400, 401, 403, 404, 500]
    crawler_ips = ["192.168.1.100", "10.0.0.50", "172.16.0.10"]
    human_ips = [f"192.168.2.{i}" for i in range(1, 51)]
    logs = []
    base_time = datetime.now() - timedelta(days=1)
    for i in range(count):
        is_crawler = random.random() < 0.4
        if is_crawler:
            ip = random.choice(crawler_ips)
            ua = random.choice(user_agents[3:8])
            path = random.choice(paths[5:])
            method = random.choice(methods[:3])
        else:
            ip = random.choice(human_ips)
            ua = random.choice(user_agents[:3] + user_agents[8:9])
            path = random.choice(paths[:5])
            method = random.choice(methods[:2])
        timestamp = (base_time + timedelta(seconds=i * random.randint(1, 30))).strftime("%d/%b/%Y:%H:%M:%S %z")
        status = random.choice(statuses)
        size = random.randint(100, 50000)
        referer = "-" if random.random() < 0.3 else '"https://example.com"'
        log_line = f'{ip} - - [{timestamp} +0800] "{method} {path} HTTP/1.1" {status} {size} {referer} "{ua}"'
        logs.append(log_line)
    return logs

if __name__ == "__main__":
    logs = generate_nginx_log(200)
    with open("test_access.log", "w") as f:
        f.write("\n".join(logs))
    print(f"Generated {len(logs)} test log entries in test_access.log")
