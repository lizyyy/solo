def is_wildcard_domain(domain):
    return domain.startswith("*.")

def domain_matches(pattern, domain):
    if pattern == domain:
        return True
    if is_wildcard_domain(pattern):
        pattern_suffix = pattern[2:]
        if domain == pattern_suffix:
            return True
        if domain.endswith("." + pattern_suffix):
            return True
    return False

def find_matching_domain(domain, san_list):
    for san in san_list:
        if domain_matches(san, domain):
            return True, san
    return False, ""

def compare_san(expected_domains, actual_san):
    matched = []
    missing = []
    extra = []
    for d in expected_domains:
        m, mb = find_matching_domain(d, actual_san)
        if m:
            matched.append({"domain": d, "matched_by": mb, "is_wildcard_match": is_wildcard_domain(mb)})
        else:
            missing.append(d)
    for s in actual_san:
        f = False
        for d in expected_domains:
            if domain_matches(s, d):
                f = True
                break
        if not f:
            extra.append(s)
    wildcard = [s for s in actual_san if is_wildcard_domain(s)]
    return {
        "expected_count": len(expected_domains),
        "actual_count": len(actual_san),
        "matched_count": len(matched),
        "missing_count": len(missing),
        "extra_count": len(extra),
        "wildcard_count": len(wildcard),
        "matched_domains": matched,
        "missing_domains": missing,
        "extra_san": extra,
        "wildcard_san": wildcard,
        "all_matched": len(missing) == 0,
    }

def check_certificate_expiry(cert_info, warning_days=30):
    days = cert_info.get("days_remaining", 0)
    expired = cert_info.get("is_expired", False)
    status = "expired" if expired else "warning" if days <= warning_days else "valid"
    return {
        "status": status,
        "days_remaining": days,
        "is_expired": expired,
        "warning_days": warning_days,
        "needs_renewal": days <= warning_days,
    }
