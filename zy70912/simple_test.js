const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const csv = require("csv-parser");
const { v4: uuidv4 } = require("uuid");
const moment = require("moment");

const dbPath = path.join(__dirname, "./data/demo.db");
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
const db = new sqlite3.Database(dbPath);

console.log("Hello World!");
console.log("Dependencies loaded successfully!");
