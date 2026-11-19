const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.SUPERTUTOR_DB_PATH ||
  path.join(__dirname, '..', 'database.sqlite');

const db = new Database(dbPath);

// Omogoči tuje ključe (foreign keys)
db.pragma('foreign_keys = ON');

module.exports = db;