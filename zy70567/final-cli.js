#!/usr/bin/env node

const fs = require("fs");
const { Command } = require("commander");

function ipToBigint(ip) {
  const parts = ip.split(".").map(Number);
  return (BigInt(parts[0]) << 24n) | (BigInt(parts[1]) << 16n) | (BigInt(parts[2]) << 8n) | BigInt(parts[3]);
}

function parseCidr(cidr) {
  const [ip, prefixStr] = cidr.split("/");
  const prefix = parseInt(prefixStr || "32", 10);
  const ipNum = ipToBigint(ip);
  const mask = prefix === 0 ? 0n : (0xffffffffn << BigInt(32 - prefix));
  return { start: ipNum & mask, end: (ipNum & mask) | (~mask & 0xffffffffn) };
}
