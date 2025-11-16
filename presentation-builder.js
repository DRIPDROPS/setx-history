const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

/**
 * Presentation Builder
 * Creates visual HTML presentations from researched topics and collected media
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
    async getRelatedFacts(topic) {
        return new Promise((resolve, reject) => {
            const keywords = `%${topic}%`;
            this.db.all(`
                SELECT hf.*, hc.name as city_name, ht.name as topic_name
                FROM historical_facts hf
                LEFT JOIN historical_cities hc ON hf.city_id = hc.id
                LEFT JOIN historical_topics ht ON hf.topic_id = ht.id
                WHERE LOWER(hf.title) LIKE LOWER(?)
                   OR LOWER(hf.content) LIKE LOWER(?)
                ORDER BY hf.importance DESC
                LIMIT 5
            `, [keywords, keywords], (err, facts) => {
                if (err) reject(err);
                else resolve(facts || []);
            });
        });
    }

    /**
     * Generate HTML presentation
     */
    async generatePresentation(topicId) {
        const { topic, media } = await this.getTopicData(topicId);
        const facts = await this.getRelatedFacts(topic.topic);

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
        .timestamp {
            text-align: center;
            padding: 2rem;
            color: #999;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="presentation">
        <div class="hero">
            <h1>🏛️ ${topic.topic}</h1>
            <p>A Visual Journey Through Southeast Texas History</p>
        </div>

        ${media.length > 0 ? `
        <div class="gallery">
            ${media.map(m => `
                <img src="${m.media_path}" alt="${m.title || topic.topic}" title="${m.source}">
            `).join('')}
        </div>
        ` : ''}

        <div class="content">
            <h2>Historical Facts</h2>
            ${facts.map(f => `
                <div class="fact">
                    <h3>${f.title} ${f.event_year ? `(${f.event_year})` : ''}</h3>
                    <p>${f.content}</p>
                    <div class="fact-meta">
                        ${f.city_name ? `📍 ${f.city_name}` : ''}
                        ${f.topic_name ? `• ${f.topic_name}` : ''}
                        ${f.source_name ? `• Source: ${f.source_name}` : ''}
                    </div>
                </div>
            `).join('')}
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
