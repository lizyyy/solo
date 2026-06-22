class Parser {
  constructor(s) {
    this.s = String(s ?? "");
    this.pos = 0;
  }
  peek() {
    return this.s[this.pos];
  }
  skipWs() {
    while (this.pos < this.s.length && /\s/.test(this.s[this.pos])) this.pos++;
  }
  parse() {
    this.skipWs();
    const node = this.parseExpr();
    this.skipWs();
    if (this.pos < this.s.length) {
      throw new Error(`表达式存在意外字符: “${this.s[this.pos]}”`);
    }
    return node;
  }
  parseExpr() {
    let left = this.parseTerm();
    for (;;) {
      this.skipWs();
      const c = this.peek();
      if (c === "+" || c === "-") {
        this.pos++;
        const right = this.parseTerm();
        left = { type: "bin", op: c, left, right };
      } else break;
    }
    return left;
  }
  parseTerm() {
    let left = this.parseFactor();
    for (;;) {
      this.skipWs();
      const c = this.peek();
      if (c === "*" || c === "/") {
        this.pos++;
        const right = this.parseFactor();
        left = { type: "bin", op: c, left, right };
      } else break;
    }
    return left;
  }
  parseFactor() {
    this.skipWs();
    const c = this.peek();
    if (c === "-") {
      this.pos++;
      return { type: "neg", operand: this.parseFactor() };
    }
    if (c === "(") {
      this.pos++;
      const e = this.parseExpr();
      this.skipWs();
      if (this.peek() !== ")") throw new Error("缺少右括号 “)”");
      this.pos++;
      return e;
    }
    if (c >= "0" && c <= "9") return this.parseNumber();
    if (this.s.startsWith("a1", this.pos)) {
      this.pos += 2;
      return { type: "var", name: "a1" };
    }
    if (this.s.startsWith("a2", this.pos)) {
      this.pos += 2;
      return { type: "var", name: "a2" };
    }
    throw new Error(`无法解析的表达式片段: “${c ?? "结尾"}”`);
  }
  parseNumber() {
    let str = "";
    while (this.pos < this.s.length && /[0-9.]/.test(this.s[this.pos])) {
      str += this.s[this.pos++];
    }
    return { type: "num", value: parseFloat(str) };
  }
}

function parseExpr(input) {
  return new Parser(input).parse();
}

function evalExpr(ast, env) {
  switch (ast.type) {
    case "num":
      return { ok: true, value: ast.value };
    case "var":
      return { ok: true, value: env[ast.name] };
    case "neg": {
      const r = evalExpr(ast.operand, env);
      return r.ok ? { ok: true, value: -r.value } : r;
    }
    case "bin": {
      const l = evalExpr(ast.left, env);
      if (!l.ok) return l;
      const r = evalExpr(ast.right, env);
      if (!r.ok) return r;
      switch (ast.op) {
        case "+":
          return { ok: true, value: l.value + r.value };
        case "-":
          return { ok: true, value: l.value - r.value };
        case "*":
          return { ok: true, value: l.value * r.value };
        case "/":
          if (r.value === 0) return { ok: false, divByZero: true };
          return { ok: true, value: l.value / r.value };
      }
    }
  }
}

function isBin(ast) {
  return ast.type === "bin";
}

function fmt(n) {
  if (!isFinite(n)) return "—";
  const r = Math.round(n * 1e4) / 1e4;
  return String(r);
}

function renderAst(ast, env) {
  switch (ast.type) {
    case "num":
      return fmt(ast.value);
    case "var":
      return fmt(env[ast.name]);
    case "neg":
      return `-(${renderAst(ast.operand, env)})`;
    case "bin":
      return `${renderAst(ast.left, env)} ${ast.op} ${renderAst(ast.right, env)}`;
  }
}

module.exports = { parseExpr, evalExpr, isBin, renderAst };
