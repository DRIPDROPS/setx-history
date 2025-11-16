const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

/**
 * Media Collection Agent
 * Automatically searches for and downloads historical images/videos for topics
 */
class MediaAgent {
    constructor(dbPath) {
        this.db = new sqlite3.Database(dbPath);
        this.imageDir = path.join(__dirname, 'public/images/historical');

        // Ensure directory exists
        if (!fs.existsSync(this.imageDir)) {
            fs.mkdirSync(this.imageDir, { recursive: true });
        }
    }

    /**
     * Search Library of Congress for historical images
     */
    async searchLibraryOfCongress(query, maxResults = 5) {
        try {
            // LOC API endpoint
            const searchUrl = `https://www.loc.gov/pictures/search/?q=${encodeURIComponent(query)}&fo=json`;
            const response = await axios.get(searchUrl);

            const results = [];
            if (response.data && response.data.results) {
                for (const item of response.data.results.slice(0, maxResults)) {
                    if (item.image_url) {
                        results.push({
                            title: item.title || query,
                            url: item.image_url[0],
                            source: 'Library of Congress',
                            reproduction_number: item.reproduction_number
                        });
                    }
                }
            }

            return results;
        } catch (error) {
            console.error('Error searching LOC:', error.message);
            return [];
        }
    }

    /**
     * Download image from URL
     */
    async downloadImage(url, filename) {
        try {
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            const filepath = path.join(this.imageDir, filename);
            fs.writeFileSync(filepath, response.data);
            console.log(`✅ Downloaded: ${filename}`);
            return filepath;
        } catch (error) {
            console.error(`❌ Failed to download ${filename}:`, error.message);
            return null;
        }
    }

    /**
     * Collect media for a topic
     */
    async collectMediaForTopic(topic, keywords = []) {
        console.log(`\n📸 Media Agent: Collecting media for "${topic}"`);

        // Build search query
        const searchQuery = [topic, ...keywords, 'Texas history'].join(' ');

        // Search for images
        const images = await this.searchLibraryOfCongress(searchQuery);

        const downloadedMedia = [];

        for (const image of images) {
            const filename = `${topic.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.jpg`;
            const filepath = await this.downloadImage(image.url, filename);

            if (filepath) {
                downloadedMedia.push({
                    filepath: `/images/historical/${filename}`,
                    title: image.title,
                    source: image.source,
                    topic: topic
                });
            }
        }

        console.log(`✅ Collected ${downloadedMedia.length} images for "${topic}"`);
        return downloadedMedia;
    }

    /**
     * Store researched topic in database
     */
    storeResearchedTopic(topic, keywords, userId = 'default') {
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT INTO topics_researched (topic, keywords, user_id, researched_at)
                VALUES (?, ?, ?, datetime('now'))
            `, [topic, JSON.stringify(keywords), userId], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    /**
     * Link media to topic
     */
    linkMediaToTopic(topicId, mediaPath, title, source) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT INTO topic_media (topic_id, media_path, title, source, collected_at)
                VALUES (?, ?, ?, ?, datetime('now'))
            `, [topicId, mediaPath, title, source], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    /**
     * Full workflow: Research topic -> Collect media -> Store everything
     */
    async researchAndCollect(topic, keywords = []) {
        console.log(`\n🔬 Starting research workflow for: "${topic}"`);

        // 1. Store researched topic
        const topicId = await this.storeResearchedTopic(topic, keywords);
        console.log(`✅ Stored topic research (ID: ${topicId})`);

        // 2. Collect media
        const media = await this.collectMediaForTopic(topic, keywords);

        // 3. Link media to topic
        for (const item of media) {
            await this.linkMediaToTopic(topicId, item.filepath, item.title, item.source);
        }

        return {
            topicId,
            topic,
            mediaCount: media.length,
            media
        };
    }

    close() {
        this.db.close();
    }
}

module.exports = { MediaAgent };
