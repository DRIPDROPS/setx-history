const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const { chatWithAgent } = require('./history-chat-agent');

const app = express();
const PORT = 3002;  // Different port from events app

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'history.html'));
});

// Serve static files (images, etc.)
app.use('/images', express.static(path.join(__dirname, 'public/images')));

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected'
    });
});

// Get all cities
app.get('/api/cities', (req, res) => {
    db.all('SELECT * FROM historical_cities ORDER BY name ASC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// Get city by ID
app.get('/api/cities/:id', (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM historical_cities WHERE id = ?', [id], (err, city) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (!city) {
            res.status(404).json({ error: 'City not found' });
        } else {
            db.all(
                `SELECT hf.*, ht.name as topic_name, ht.icon as topic_icon
                 FROM historical_facts hf
                 LEFT JOIN historical_topics ht ON hf.topic_id = ht.id
                 WHERE hf.city_id = ?
                 ORDER BY hf.event_year DESC`,
                [id],
                (err, facts) => {
                    city.facts = facts || [];
                    res.json(city);
                }
            );
        }
    });
});

// Get all topics
app.get('/api/topics', (req, res) => {
    db.all('SELECT * FROM historical_topics ORDER BY name ASC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// Get historical facts
app.get('/api/facts', (req, res) => {
    const { city_id, topic_id, search, year, limit = 50 } = req.query;

    let query = `
        SELECT
            hf.*,
            hc.name as city_name,
            ht.name as topic_name,
            ht.icon as topic_icon
        FROM historical_facts hf
        LEFT JOIN historical_cities hc ON hf.city_id = hc.id
        LEFT JOIN historical_topics ht ON hf.topic_id = ht.id
        WHERE 1=1
    `;
    const params = [];

    if (city_id) {
        query += ' AND hf.city_id = ?';
        params.push(city_id);
    }
    if (topic_id) {
        query += ' AND hf.topic_id = ?';
        params.push(topic_id);
    }
    if (year) {
        query += ' AND hf.event_year = ?';
        params.push(year);
    }
    if (search) {
        query += ' AND (hf.title LIKE ? OR hf.content LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY hf.event_year DESC, hf.importance DESC LIMIT ?';
    params.push(parseInt(limit));

    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// Chat with AI agent
app.post('/api/chat', async (req, res) => {
    const { message, conversation_id } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        const result = await chatWithAgent(message, conversation_id);

        if (conversation_id) {
            db.run(
                'INSERT INTO chat_messages (conversation_id, role, content) VALUES (?, ?, ?)',
                [conversation_id, 'user', message]
            );

            db.run(
                'INSERT INTO chat_messages (conversation_id, role, content) VALUES (?, ?, ?)',
                [conversation_id, 'assistant', result.response]
            );
        }

        res.json({
            response: result.response,
            success: result.success,
            context_used: result.context_used
        });

    } catch (error) {
        console.error('Error in chat:', error);
        res.status(500).json({
            error: 'Failed to process chat message',
            details: error.message
        });
    }
});

// Create conversation
app.post('/api/conversation', (req, res) => {
    const { session_id } = req.body;

    db.get('SELECT * FROM chat_conversations WHERE session_id = ?', [session_id], (err, conversation) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (conversation) {
            res.json(conversation);
        } else {
            const stmt = db.prepare(`INSERT INTO chat_conversations (session_id, user_ip) VALUES (?, ?)`);
            stmt.run(session_id, 'web_user', function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                } else {
                    res.status(201).json({
                        id: this.lastID,
                        session_id: session_id
                    });
                }
            });
            stmt.finalize();
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('✅ SETX History API running');
    console.log(`   Local:  http://localhost:${PORT}`);
    console.log('========================================');
});

process.on('SIGINT', () => {
    db.close();
    process.exit(0);
});
