const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('📊 Adding public contributions table...');

db.run(`
    CREATE TABLE IF NOT EXISTS public_contributions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic TEXT NOT NULL,
        fact_title TEXT NOT NULL,
        fact_content TEXT NOT NULL,
        source TEXT,
        contributor_name TEXT DEFAULT 'Anonymous',
        contributor_email TEXT,
        status TEXT DEFAULT 'pending',
        reviewed_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reviewed_at DATETIME
    )
`, (err) => {
    if (err) console.error('Error:', err);
    else {
        console.log('✅ Table: public_contributions');
        db.close();
    }
});
