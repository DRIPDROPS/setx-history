const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('📊 Adding research tracking tables...');

db.serialize(() => {
    // Table to track researched topics
    db.run(`
        CREATE TABLE IF NOT EXISTS topics_researched (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic TEXT NOT NULL,
            keywords TEXT,
            user_id TEXT DEFAULT 'default',
            researched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            presentation_generated INTEGER DEFAULT 0
        )
    `, (err) => {
        if (err) console.error('Error creating topics_researched:', err);
        else console.log('✅ Table: topics_researched');
    });

    // Table to store media collected for topics
    db.run(`
        CREATE TABLE IF NOT EXISTS topic_media (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic_id INTEGER NOT NULL,
            media_path TEXT NOT NULL,
            media_type TEXT DEFAULT 'image',
            title TEXT,
            source TEXT,
            collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (topic_id) REFERENCES topics_researched(id)
        )
    `, (err) => {
        if (err) console.error('Error creating topic_media:', err);
        else console.log('✅ Table: topic_media');
    });

    // Table to track presentations
    db.run(`
        CREATE TABLE IF NOT EXISTS presentations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT,
            html_path TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (topic_id) REFERENCES topics_researched(id)
        )
    `, (err) => {
        if (err) console.error('Error creating presentations:', err);
        else console.log('✅ Table: presentations');
        db.close();
        console.log('\n✅ Research tracking tables added successfully!');
    });
});
