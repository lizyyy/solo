const http = require("http");

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: "localhost",
      port: 3001,
      path,
      method,
      headers: { "Content-Type": "application/json" },
    };
    const r = http.request(opts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try { resolve(JSON.parse(d)); } catch { resolve(d); }
      });
    });
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  try {
    console.log("1. health");
    const h = await api("GET", "/api/health");
    console.log("   ", h.ok ? "OK" : "FAIL");

    console.log("2. seed");
    const s = await api("POST", "/api/seed");
    console.log("   seeded:", s.seeded.length);

    console.log("3. materials");
    const mats = await api("GET", "/api/materials");
    console.log("   count:", mats.length);
    for (const m of mats) {
      console.log(`   ${m.type} ${m.version} contributes=${JSON.stringify(m.contributes || "none")}`);
    }

    console.log("4. duplicate test");
    const dup = await api("POST", "/api/materials", {
      type: "后补备注", version: "v2", source: "小岑",
      content: "更正：边界 a_1 应为 2（旧版 a_1=3 会在 n=3 处使分母 a_{n-2}-3 = 0）。",
    });
    console.log("   duplicated:", dup.duplicated);

    const mats2 = await api("GET", "/api/materials");
    console.log("   count after dup:", mats2.length, "(should be 3)");

    console.log("5. review");
    const rev = await api("POST", "/api/review", {});
    const divStep = rev.old.result.find((s) => s.status === "divzero");
    console.log("   old_steps:", rev.old.result.length, "fixed_steps:", rev.fixed.result.length);
    console.log("   divzero at n:", divStep ? divStep.n : "none");
    console.log("   conclusions:", rev.conclusions.map((c) => c.key));

    console.log("6. judgment");
    const jd = await api("POST", "/api/judgment", {
      value: "按后补备注修正，边界安全",
      reason: "已逐项核对到n=6；旧版a1=3在n=3除零，后补备注已修正为a1=2，不再除零。",
      actor: "小岑",
    });
    console.log("   ok:", jd.ok);

    console.log("7. current judgment");
    const cj = await api("GET", "/api/judgment");
    console.log("   value:", cj.value);

    console.log("8. audit");
    const audit = await api("GET", "/api/audit");
    console.log("   entries:", audit.length);
    for (const a of audit) {
      console.log(`   ${a.prevValue} -> ${a.nextValue} (${a.actor}: ${a.reason.slice(0, 40)}...)`);
    }

    console.log("\n=== ALL PASS ===");
  } catch (e) {
    console.error("ERROR:", e.message);
    process.exit(1);
  }
}

main();
