const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

/**
 * Presentation Builder
 * Creates permanent web pages for topics.
 * These pages ARE the website - they display historical facts, images, and content for each topic.
 */
class PresentationBuilder {
    constructor(dbPath) {
        this.db = new sqlite3.Database(dbPath);
        this.presentationsDir = path.join(__dirname, 'public/presentations');

        // Ensure directory exists
        if (!fs.existsSync(this.presentationsDir)) {
            fs.mkdirSync(this.presentationsDir, { recursive: true });
        }
    }

    /**
     * Get topic data with media
     */
    async getTopicData(topicId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM topics_researched WHERE id = ?', [topicId], (err, topic) => {
                if (err) return reject(err);

                this.db.all('SELECT * FROM topic_media WHERE topic_id = ?', [topicId], (err, media) => {
                    if (err) return reject(err);
                    resolve({ topic, media });
                });
            });
        });
    }

    /**
     * Get related historical facts
     */
    async getRelatedFacts(topic, topicId = null) {
        return new Promise((resolve, reject) => {
            // Extract the main topic name (remove "in Southeast Texas history" etc.)
            const cleanTopic = topic
                .replace(/\s+in\s+southeast\s+texas\s+history/gi, '')
                .replace(/\s+in\s+texas\s+history/gi, '')
                .trim();
            
            const keywords = `%${cleanTopic}%`;
            
            // First, try to find the matching historical_topic by name
            this.db.get(
                `SELECT id FROM historical_topics WHERE LOWER(name) = LOWER(?)`,
                [cleanTopic],
                (err, historicalTopic) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    // Build query to get facts
                    let query = `
                        SELECT hf.*, hc.name as city_name, ht.name as topic_name
                        FROM historical_facts hf
                        LEFT JOIN historical_cities hc ON hf.city_id = hc.id
                        LEFT JOIN historical_topics ht ON hf.topic_id = ht.id
                        WHERE 1=1
                    `;
                    const params = [];
                    
                    // If we found a matching historical topic, use its ID
                    if (historicalTopic) {
                        query += ` AND hf.topic_id = ?`;
                        params.push(historicalTopic.id);
                    } else {
                        // Otherwise search by topic name in title/content
                        query += ` AND (LOWER(ht.name) LIKE LOWER(?) OR LOWER(hf.title) LIKE LOWER(?) OR LOWER(hf.content) LIKE LOWER(?))`;
                        params.push(keywords, keywords, keywords);
                    }
                    
                    query += ` ORDER BY hf.importance DESC, hf.event_year DESC LIMIT 10`;
                    
                    this.db.all(query, params, (err2, facts) => {
                        if (err2) reject(err2);
                        else resolve(facts || []);
                    });
                }
            );
        });
    }

    /**
     * Generate HTML presentation
     */
    async generatePresentation(topicId) {
        const { topic, media } = await this.getTopicData(topicId);
        
        if (!topic) {
            throw new Error(`Topic with ID ${topicId} not found`);
        }
        
        const facts = await this.getRelatedFacts(topic.topic, topic.id);
        
        // Collect images from facts that have image_url
        const factImages = facts
            .filter(f => f.image_url && f.image_url.trim() !== '')
            .map(f => ({
                media_path: f.image_url,
                title: f.title,
                source: f.source_name || 'Historical Archive'
            }));
        
        // Combine media from topic_media and fact images
        const allMedia = [...media, ...factImages];

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${topic.topic} - Southeast Texas History</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: #333;
            padding: 2rem;
            min-height: 100vh;
        }
        
        nav {
            background: rgba(255, 255, 255, 0.95);
            padding: 1rem 2rem;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
        }
        
        nav ul {
            list-style: none;
            display: flex;
            gap: 2rem;
            align-items: center;
        }
        
        nav a {
            text-decoration: none;
            color: #2a5298;
            font-weight: 600;
            transition: color 0.3s;
        }
        
        nav a:hover {
            color: #1e3c72;
        }
        
        nav .logo {
            font-size: 1.5rem;
            font-weight: 800;
            color: #1e3c72;
        }
        .presentation {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .hero {
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            padding: 4rem 3rem;
            text-align: center;
        }
        .hero h1 {
            font-size: 3rem;
            margin-bottom: 1rem;
        }
        .hero p {
            font-size: 1.2rem;
            opacity: 0.9;
        }
        .gallery {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 0;
        }
        .gallery img {
            width: 100%;
            height: 300px;
            object-fit: cover;
            transition: transform 0.3s;
        }
        .gallery img:hover {
            transform: scale(1.05);
            z-index: 10;
        }
        .content {
            padding: 3rem;
        }
        .fact {
            background: #f8f9fa;
            padding: 2rem;
            margin: 2rem 0;
            border-radius: 12px;
            border-left: 4px solid #2a5298;
        }
        .fact h3 {
            color: #1e3c72;
            margin-bottom: 1rem;
        }
        .fact-meta {
            color: #666;
            font-size: 0.9rem;
            margin-top: 1rem;
        }
        .notes-section {
            margin-top: 3rem;
            padding-top: 2rem;
            border-top: 1px solid #eee;
        }
        .notes-section h2 {
            color: #1e3c72;
            margin-bottom: 1rem;
        }
        .notes-section p {
            margin-bottom: 1.5rem;
            color: #666;
        }
        #personal-notes {
            width: 100%;
            min-height: 200px;
            padding: 1rem;
            border-radius: 8px;
            border: 1px solid #ddd;
            font-family: inherit;
            font-size: 1rem;
            line-height: 1.6;
        }
        #save-notes {
            display: inline-block;
            margin-top: 1rem;
            padding: 0.75rem 1.5rem;
            background: #2a5298;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            transition: background 0.3s;
        }
        #save-notes:hover {
            background: #1e3c72;
        }
        .timestamp {
            text-align: center;
            padding: 2rem;
            color: #999;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <!-- Navigation -->
    <nav>
        <ul>
            <li><span class="logo">🏛️ SETX History</span></li>
            <li><a href="/">History Chat</a></li>
            <li><a href="/contribute.html">🤝 Contribute</a></li>
        </ul>
    </nav>
    
    <div class="presentation">
        <div class="hero">
            <h1>🏛️ ${topic.topic}</h1>
            <p>A Visual Journey Through Southeast Texas History</p>
        </div>

        ${allMedia.length > 0 ? `
        <div class="gallery">
            ${allMedia.map(m => `
                <img src="${m.media_path}" alt="${m.title || topic.topic}" title="${m.source || ''}" onerror="this.style.display='none'">
            `).join('')}
        </div>
        ` : ''}

        <div class="content">
            <h2>Historical Facts</h2>
            ${facts.map(f => `
                <div class="fact">
                    ${f.image_url ? `<img src="${f.image_url}" alt="${f.title}" style="width: 100%; max-width: 600px; height: auto; border-radius: 8px; margin-bottom: 1rem;" onerror="this.style.display='none'">` : ''}
                    <h3>${f.title} ${f.event_year ? `(${f.event_year})` : ''}</h3>
                    <p>${f.content}</p>
                    <div class="fact-meta">
                        ${f.city_name ? `📍 ${f.city_name}` : ''}
                        ${f.topic_name ? `• ${f.topic_name}` : ''}
                        ${f.source_name ? `• Source: ${f.source_name}` : ''}
                    </div>
                </div>
            `).join('')}

            <div class="notes-section">
                <h2>My Notes</h2>
                <p>Add your personal notes and research findings below.</p>
                <textarea id="personal-notes" placeholder="Type your notes here..."></textarea>
                <button id="save-notes">Save Notes</button>
            </div>
        </div>

        <div class="timestamp">
            Generated: ${new Date().toLocaleString()}
        </div>
    </div>
</body>
</html>
        `;

        const filename = `${topic.topic.toLowerCase().replace(/\s+/g, '-')}-${topicId}.html`;
        const filepath = path.join(this.presentationsDir, filename);

        fs.writeFileSync(filepath, html);
        console.log(`✅ Presentation generated: ${filename}`);

        // Store presentation in database
        await this.storePresentation(topicId, topic.topic, html, filepath);

        return {
            filepath: `/presentations/${filename}`,
            filename,
            fullPath: filepath
        };
    }

    /**
     * Store presentation in database
     */
    storePresentation(topicId, title, content, htmlPath) {
        const db = this.db; // Capture reference
        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO presentations (topic_id, title, content, html_path)
                VALUES (?, ?, ?, ?)
            `, [topicId, title, content, htmlPath], function(err) {
                if (err) return reject(err);

                const presentationId = this.lastID;
                // Mark topic as having presentation generated
                db.run('UPDATE topics_researched SET presentation_generated = 1 WHERE id = ?', [topicId], (err) => {
                    if (err) console.error('Warning: Failed to update topic:', err);
                    resolve(presentationId);
                });
            });
        });
    }

    close() {
        this.db.close();
    }
}

module.exports = { PresentationBuilder };
