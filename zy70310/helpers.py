import sys
import json

def print_quota_remaining(service_id=1):
    d = json.load(sys.stdin)
    for x in d:
        if x['service_id'] == service_id:
            print(f"服务: {x['service_name']}, 基础剩余: {x['quota']['base']['remaining']}")

def print_quota_used(service_id=1):
    d = json.load(sys.stdin)
    for x in d:
        if x['service_id'] == service_id:
            print(f"服务: {x['service_name']}, 基础已用: {x['quota']['base']['used']}")

def print_total_available(service_id=1):
    d = json.load(sys.stdin)
    for x in d:
        if x['service_id'] == service_id:
            print(f"服务: {x['service_name']}, 剩余总额度: {x['quota']['total_available']}")

def print_frozen_calls(service_id=1):
    d = json.load(sys.stdin)
    for x in d:
        if x['service_id'] == service_id:
            print(f"冻结调用: {x['frozen_calls']}")

def print_quota_status(service_id=1):
    d = json.load(sys.stdin)
    for x in d:
        if x['service_id'] == service_id:
            print(f"服务: {x['service_name']}, 剩余: {x['quota']['total_available']}, 已用(含风险): {x['quota']['total_used']}")

def print_expansion_status(service_id=2):
    d = json.load(sys.stdin)
    for x in d:
        if x['service_id'] == service_id:
            print(f"服务: {x['service_name']}, 基础: {x['quota']['base']['remaining']}, 扩容: {x['quota']['expansion']['remaining']}")

def print_base_remaining(service_id=1):
    d = json.load(sys.stdin)
    for x in d:
        if x['service_id'] == service_id:
            print(f"  统一认证服务 - 基础剩余: {x['quota']['base']['remaining']}")

def print_borrow_usage():
    d = json.load(sys.stdin)
    for b in d['borrowed']:
        print(f"  借用ID:{b['id']}, 总额:{b['amount']}, 已用:{b['used_amount']}, 剩余:{b['remaining']}")

def print_recon_expansion():
    d = json.load(sys.stdin)
    for x in d:
        print(f"服务:{x['service_name']}, 扩容:{x['expansion']}, 总额度:{x['total']}")

def print_recon_borrowed():
    d = json.load(sys.stdin)
    for x in d:
        print(f"服务:{x['service_name']}, 借入:{x['borrowed']}")

def print_recon_lent():
    d = json.load(sys.stdin)
    for x in d:
        print(f"服务:{x['service_name']}, 借出:{x['lent']}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python helpers.py <function_name> [args...]")
        sys.exit(1)
    
    func_name = sys.argv[1]
    args = sys.argv[2:]
    
    func = globals().get(func_name)
    if func:
        if args:
            func(*[int(a) if a.isdigit() else a for a in args])
        else:
            func()
    else:
        print(f"Unknown function: {func_name}")
        sys.exit(1)
