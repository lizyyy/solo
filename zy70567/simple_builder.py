
with open("index.js", "w") as f:
    f.write("""/#!/usr/bin/env node

const fs = require("fs");
const { Command } = require("commander");

function ipToBigint(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    throw new Error("Invalid IP: " + ip);
  }
  return (BigInt(parts[0]) << 24n) | (BigInt(parts[1]) << 16n) | (BigInt(parts[2]) << 8n) | BigInt(parts[3]);
}

function bigintToIp(n) {
  return [
    Number((n >> 24n) & 0xffn),
    Number((n >> 16n) & 0xffn),
    Number((n >> 8n) & 0xffn),
    Number(n & 0xffn)
  ].join(".");
}
/""".strip("/"))

