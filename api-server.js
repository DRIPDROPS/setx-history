require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const { chatWithAgent } = require('./history-chat-agent');
const { ResearchWorkflow } = require('./research-workflow');
const { PageConsolidationAgent } = require('./page-consolidation-agent');
const { initializeAllTables } = require('./history-database');

const app = express();
const PORT = 3002;  // Different port from events app

// Initialize database tables
initializeAllTables().catch(error => {
    console.error('❌ Failed to initialize database tables:', error);
    process.exit(1);
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'history.html'));
});

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

// Enhance existing page with new research
app.post('/api/enhance-page', async (req, res) => {
    const { topicId, topicName, query } = req.body;
    
    if (!topicId || !query) {
        return res.status(400).json({ 
            success: false, 
            error: 'Missing topicId or query' 
        });
    }
    
    console.log(`🔬 Enhancing page for topic "${topicName}" with query: "${query}"`);
    
    try {
        const workflow = new ResearchWorkflow(dbPath);
        
        // Construct contextual query
        const contextualQuery = `${query} (related to ${topicName} in Southeast Texas history)`;
        
        // Process the enhancement query
        const result = await workflow.processUserQuery(contextualQuery, topicId);
        workflow.close();
        
        if (result && result.factsAdded > 0) {
            // Regenerate the presentation with new content
            const { PresentationBuilder } = require('./presentation-builder');
            const builder = new PresentationBuilder(dbPath);
            await builder.generatePresentation(topicId);
            builder.close();
            
            console.log(`✅ Page enhanced with ${result.factsAdded} new facts`);
            
            res.json({
                success: true,
                message: `Added ${result.factsAdded} new facts to the page`,
                factsAdded: result.factsAdded,
                topicId: result.topicId
            });
        } else {
            res.json({
                success: false,
                error: 'No new content found for this query. Try rephrasing or asking about a different aspect.'
            });
        }
    } catch (error) {
        console.error('❌ Page enhancement error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to enhance page'
        });
    }
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
    
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'Invalid city ID' });
    }
    
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
    
    // Validate limit
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 500) {
        return res.status(400).json({ error: 'Limit must be between 1 and 500' });
    }

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
    params.push(limitNum);

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
                [conversation_id, 'user', message],
                (err) => {
                    if (err) {
                        console.error('Error saving user message:', err);
                    }
                }
            );

            db.run(
                'INSERT INTO chat_messages (conversation_id, role, content) VALUES (?, ?, ?)',
                [conversation_id, 'assistant', result.response],
                (err) => {
                    if (err) {
                        console.error('Error saving assistant message:', err);
                    }
                }
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

// Create conversation handler function
function createConversationHandler(req, res) {
    const { session_id } = req.body;

    if (!session_id) {
        return res.status(400).json({ error: 'session_id is required' });
    }

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
}

// Create conversation endpoints (support both paths for consistency)
app.post('/api/conversation', createConversationHandler);
app.post('/api/chat/conversation', createConversationHandler);

// Check if consolidation should be triggered after research
function checkAndTriggerConsolidation(topic) {
    // Map topics to their main categories
    const topicToCategory = {
        'spindletop': 'Oil & Energy',
        'oil': 'Oil & Energy',
        'drilling': 'Oil & Energy',
        'refinery': 'Oil & Energy',
        'lumber': 'Lumber Industry',
        'sawmill': 'Lumber Industry',
        'shipbuilding': 'Shipbuilding',
        'shipyard': 'Shipbuilding'
    };
    
    // Find the main category for this topic
    const lowerTopic = topic.toLowerCase();
    let mainCategory = null;
    
    for (const [key, category] of Object.entries(topicToCategory)) {
        if (lowerTopic.includes(key)) {
            mainCategory = category;
            break;
        }
    }
    
    // If we found a category, trigger consolidation (but don't wait for it)
    if (mainCategory) {
        console.log(`🔄 Scheduling consolidation for category: ${mainCategory}`);
        setTimeout(() => {
            const consolidator = new PageConsolidationAgent(dbPath);
            consolidator.consolidateTopicCategory(mainCategory)
                .then(result => {
                    if (result) {
                        console.log(`✅ Consolidation completed for ${mainCategory}`);
                    }
                })
                .catch(error => {
                    console.error(`❌ Consolidation failed for ${mainCategory}:`, error.message);
                })
                .finally(() => {
                    consolidator.close();
                });
        }, 5000); // Wait 5 seconds to allow any pending database operations
    }
}

// Trigger research workflow for a topic
app.post('/api/research', async (req, res) => {
    const { topic, message } = req.body;

    if (!topic && !message) {
        return res.status(400).json({ error: 'Topic or message required' });
    }

    // Use the research workflow to properly extract the topic
    const workflow = new ResearchWorkflow(dbPath);
    const searchTopic = topic || workflow.extractTopic(message) || (message ? message.replace(/^tell me about /i, '').replace(/\?$/, '') : null);
    workflow.close();

    if (!searchTopic) {
        return res.status(400).json({ error: 'Could not determine topic from request' });
    }

    try {
        // First, check if a presentation for this topic already exists.
        db.get(`
            SELECT p.html_path
            FROM presentations p
            JOIN topics_researched t ON p.topic_id = t.id
            WHERE LOWER(t.topic) LIKE LOWER(?)
            ORDER BY p.created_at DESC
            LIMIT 1
        `, [`%${searchTopic.trim()}%`], async (err, existingPresentation) => {
            if (err) {
                console.error('Database error checking for presentation:', err);
                // Fallback to generation if there's an error
            }

            if (existingPresentation) {
                const filename = path.basename(existingPresentation.html_path);
                console.log(`✅ Page already exists for "${searchTopic}".`);
                
                // After serving existing page, check if we should trigger consolidation
                checkAndTriggerConsolidation(searchTopic);
                
                return res.json({
                    success: true,
                    topic: searchTopic,
                    pageUrl: `/presentations/${filename}`,
                    message: `Page already exists for ${searchTopic}.`
                });
            }

            // If no presentation exists, run the full workflow.
            const workflow = new ResearchWorkflow(dbPath);
            const query = message || `Tell me about ${topic}`;

            console.log(`\n🔬 Research triggered: ${query}`);
            const result = await workflow.processUserQuery(query);
            workflow.close();

            if (result) {
                // After creating new presentation, check if we should trigger consolidation
                checkAndTriggerConsolidation(result.topic);
                
                res.json({
                    success: true,
                    topicId: result.topicId,
                    topic: result.topic,
                    mediaCollected: result.mediaCount,
                    pageUrl: result.presentationUrl,
                    message: `Page created! Collected ${result.mediaCount} media items.`
                });
            } else {
                res.json({
                    success: false,
                    message: 'Could not extract topic from query'
                });
            }
        });
    } catch (error) {
        console.error('Research workflow error:', error);
        res.status(500).json({
            error: 'Research workflow failed',
            details: error.message
        });
    }
});

// Manual consolidation endpoint
app.post('/api/consolidate/:category', async (req, res) => {
    const { category } = req.params;
    
    try {
        const consolidator = new PageConsolidationAgent(dbPath);
        const result = await consolidator.consolidateTopicCategory(category);
        consolidator.close();
        
        if (result) {
            res.json({
                success: true,
                message: `Consolidated category: ${category}`,
                file: result.filename,
                url: result.url
            });
        } else {
            res.json({
                success: false,
                message: `No presentations found to consolidate for: ${category}`
            });
        }
    } catch (error) {
        console.error('Consolidation error:', error);
        res.status(500).json({
            error: 'Consolidation failed',
            details: error.message
        });
    }
});

// Full consolidation endpoint
app.post('/api/consolidate-all', async (req, res) => {
    try {
        const consolidator = new PageConsolidationAgent(dbPath);
        const results = await consolidator.consolidateAllCategories();
        consolidator.close();
        
        res.json({
            success: true,
            message: `Consolidated ${results.length} categories`,
            results: results
        });
    } catch (error) {
        console.error('Full consolidation error:', error);
        res.status(500).json({
            error: 'Full consolidation failed',
            details: error.message
        });
    }
});

// Serve presentation pages (these ARE the permanent web pages)
app.use('/presentations', express.static(path.join(__dirname, 'public/presentations')));

// Get presentation URL for a topic
app.get('/api/topic/:topicName/presentation', (req, res) => {
    const { topicName } = req.params;
    
    db.get(`
        SELECT p.html_path
        FROM presentations p
        JOIN topics_researched t ON p.topic_id = t.id
        WHERE LOWER(t.topic) LIKE LOWER(?)
        ORDER BY p.created_at DESC
        LIMIT 1
    `, [`%${topicName}%`], (err, presentation) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (presentation) {
            const filename = path.basename(presentation.html_path);
            res.json({ 
                url: `/presentations/${filename}`,
                exists: true 
            });
        } else {
            res.json({ exists: false });
        }
    });
});

// Public contribution endpoint
app.post('/api/contribute', (req, res) => {
    const { topic, fact_title, fact_content, source, contributor_name } = req.body;

    if (!topic || !fact_title || !fact_content) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Store contribution for review
    db.run(`
        INSERT INTO public_contributions (topic, fact_title, fact_content, source, contributor_name, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
    `, [topic, fact_title, fact_content, source || 'Public contribution', contributor_name || 'Anonymous'], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.status(201).json({
                success: true,
                id: this.lastID,
                message: 'Thank you for your contribution! It will be reviewed and added to the archive.'
            });
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('✅ SETX History API running');
    console.log(`   Local:  http://localhost:${PORT}`);
    console.log('========================================');
});

// Graceful shutdown handlers
function gracefulShutdown() {
    console.log('\n🛑 Shutting down gracefully...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('✅ Database closed');
        }
        process.exit(0);
    });
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);