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
     * Search Library of Congress for historical media (images, audio, video)
     * Always credits Library of Congress as the source
     */
    async searchLibraryOfCongress(query, maxResults = 10) {
        try {
            const allMedia = [];
            
            // Search for images
            const imageSearchUrl = `https://www.loc.gov/pictures/search/?q=${encodeURIComponent(query)}&fo=json`;
            try {
                const imageResponse = await axios.get(imageSearchUrl);
                if (imageResponse.data && imageResponse.data.results) {
                    for (const item of imageResponse.data.results.slice(0, maxResults)) {
                        // For images, use the full image URL
                        if (item.image && item.image.full) {
                            allMedia.push({
                                title: item.title || query,
                                url: item.image.full,
                                source: 'Library of Congress - Images',
                                type: 'image',
                                reproduction_number: item.reproduction_number
                            });
                        }
                    }
                }
            } catch (imgError) {
                console.error('Error searching LOC images:', imgError.message);
            }
            
            // Search for audio recordings
            const audioSearchUrl = `https://www.loc.gov/audio/?q=${encodeURIComponent(query)}&fo=json`;
            try {
                const audioResponse = await axios.get(audioSearchUrl);
                if (audioResponse.data && audioResponse.data.results) {
                    for (const item of audioResponse.data.results.slice(0, Math.floor(maxResults/2))) {
                        // For audio, check resources for media files
                        if (item.resources) {
                            // Look for audio resources more broadly
                            const audioResource = item.resources.find(r => {
                                if (!r.url) return false;
                                // Check for common audio indicators
                                const isAudio = r.mime_type && (
                                    r.mime_type.includes('audio') || 
                                    r.mime_type.includes('mp3') || 
                                    r.mime_type.includes('wav') ||
                                    r.mime_type.includes('aiff') ||
                                    r.mime_type.includes('flac')
                                );
                                // Or check URL for audio file extensions
                                const hasAudioExtension = r.url.match(/\.(mp3|wav|aiff|flac|aac|m4a|ogg)$/i);
                                return isAudio || hasAudioExtension;
                            });
                            
                            if (audioResource && audioResource.url) {
                                allMedia.push({
                                    title: item.title || query,
                                    url: audioResource.url,
                                    source: 'Library of Congress - Audio',
                                    type: 'audio',
                                    reproduction_number: item.reproduction_number
                                });
                            } else if (item.resources.length > 0 && item.resources[0].url) {
                                // Fallback: use first resource if it exists
                                const firstResource = item.resources[0];
                                if (firstResource.url.match(/\.(mp3|wav|aiff|flac|aac|m4a|ogg)$/i)) {
                                    allMedia.push({
                                        title: item.title || query,
                                        url: firstResource.url,
                                        source: 'Library of Congress - Audio',
                                        type: 'audio',
                                        reproduction_number: item.reproduction_number
                                    });
                                }
                            }
                        }
                    }
                }
            } catch (audioError) {
                console.error('Error searching LOC audio:', audioError.message);
            }
            
            // Search for video recordings
            const videoSearchUrl = `https://www.loc.gov/film/?q=${encodeURIComponent(query)}&fo=json`;
            try {
                const videoResponse = await axios.get(videoSearchUrl);
                if (videoResponse.data && videoResponse.data.results) {
                    for (const item of videoResponse.data.results.slice(0, Math.floor(maxResults/2))) {
                        // For video, check resources for media files
                        if (item.resources) {
                            // Look for video resources more broadly
                            const videoResource = item.resources.find(r => {
                                if (!r.url) return false;
                                // Check for common video indicators
                                const isVideo = r.mime_type && (
                                    r.mime_type.includes('video') || 
                                    r.mime_type.includes('mp4') || 
                                    r.mime_type.includes('mov') ||
                                    r.mime_type.includes('avi') ||
                                    r.mime_type.includes('wmv') ||
                                    r.mime_type.includes('flv')
                                );
                                // Or check URL for video file extensions
                                const hasVideoExtension = r.url.match(/\.(mp4|mov|avi|wmv|flv|mkv|m4v)$/i);
                                return isVideo || hasVideoExtension;
                            });
                            
                            if (videoResource && videoResource.url) {
                                allMedia.push({
                                    title: item.title || query,
                                    url: videoResource.url,
                                    source: 'Library of Congress - Video',
                                    type: 'video',
                                    reproduction_number: item.reproduction_number
                                });
                            } else if (item.resources.length > 0 && item.resources[0].url) {
                                // Fallback: use first resource if it exists
                                const firstResource = item.resources[0];
                                if (firstResource.url.match(/\.(mp4|mov|avi|wmv|flv|mkv|m4v)$/i)) {
                                    allMedia.push({
                                        title: item.title || query,
                                        url: firstResource.url,
                                        source: 'Library of Congress - Video',
                                        type: 'video',
                                        reproduction_number: item.reproduction_number
                                    });
                                }
                            }
                        }
                    }
                }
            } catch (videoError) {
                console.error('Error searching LOC video:', videoError.message);
            }

            return allMedia.slice(0, maxResults);
        } catch (error) {
            console.error('Error searching LOC:', error.message);
            return [];
        }
    }

    /**
     * Download media from URL (handles images, audio, video)
     * Always preserves source attribution in filename
     */
    async downloadMedia(url, filename, mediaType) {
        try {
            if (!url || !filename) {
                throw new Error('URL and filename are required');
            }
            
            // Determine file extension based on media type
            let extension = '.jpg';
            if (mediaType === 'audio') {
                extension = '.mp3';
            } else if (mediaType === 'video') {
                extension = '.mp4';
            }
            
            // Ensure filename has correct extension
            if (!filename.endsWith(extension)) {
                filename = filename.replace(/\.[^/.]+$/, "") + extension;
            }
            
            const response = await axios.get(url, { 
                responseType: 'arraybuffer',
                timeout: 30000, // 30 second timeout
                validateStatus: (status) => status === 200
            });
            
            if (!response.data || response.data.length === 0) {
                throw new Error('Empty response from media URL');
            }
            
            const filepath = path.join(this.imageDir, filename);
            fs.writeFileSync(filepath, response.data);
            console.log(`✅ Downloaded: ${filename}`);
            return filepath;
        } catch (error) {
            console.error(`❌ Failed to download ${filename}:`, error.message);
            if (error.code === 'ECONNABORTED') {
                console.error('   Request timed out');
            } else if (error.response) {
                console.error(`   HTTP ${error.response.status}: ${error.response.statusText}`);
            }
            return null;
        }
    }

    /**
     * Collect media for a topic (images, audio, video)
     * Always credits sources and preserves media type information
     */
    async collectMediaForTopic(topic, keywords = []) {
        console.log(`\n📸 Media Agent: Collecting media for "${topic}"`);
        
        // Build search query
        const searchQuery = [topic, ...keywords, 'Texas history'].join(' ');
        
        // Search for all media types
        const mediaItems = await this.searchLibraryOfCongress(searchQuery);
        
        const downloadedMedia = [];
        
        for (const media of mediaItems) {
            // Create filename that preserves source information
            const cleanTitle = media.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30);
            const timestamp = Date.now();
            const filename = `${topic.toLowerCase().replace(/\s+/g, '-')}-${cleanTitle}-${timestamp}`;
            
            const filepath = await this.downloadMedia(media.url, filename, media.type);
            
            if (filepath) {
                downloadedMedia.push({
                    filepath: `/images/historical/${filename}.${media.type === 'audio' ? 'mp3' : media.type === 'video' ? 'mp4' : 'jpg'}`,
                    title: media.title,
                    source: media.source, // Always preserve source attribution
                    type: media.type,
                    topic: topic,
                    reproduction_number: media.reproduction_number
                });
            }
        }
        
        console.log(`✅ Collected ${downloadedMedia.length} media items for "${topic}" (${mediaItems.length} searched)`);
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
     * @param {string} topic - The topic to research
     * @param {array} keywords - Keywords for the search
     * @param {number} existingTopicId - Optional: If provided, enhances existing topic instead of creating new one
     */
    async researchAndCollect(topic, keywords = [], existingTopicId = null) {
        console.log(`\n🔬 Starting research workflow for: "${topic}"`);

        let topicId = existingTopicId;
        
        if (!existingTopicId) {
            // 1. Store researched topic (only if not enhancing existing)
            topicId = await this.storeResearchedTopic(topic, keywords);
            console.log(`✅ Stored topic research (ID: ${topicId})`);
        } else {
            console.log(`🔄 Enhancing existing topic (ID: ${topicId})`);
        }

        // 2. Collect media
        const media = await this.collectMediaForTopic(topic, keywords);

        // 3. Link media to topic
        let factsAdded = 0;
        for (const item of media) {
            await this.linkMediaToTopic(topicId, item.filepath, item.title, item.source);
            factsAdded++;
        }

        return {
            topicId,
            topic,
            mediaCount: media.length,
            media,
            factsAdded
        };
    }

    close() {
        this.db.close();
    }
}

module.exports = { MediaAgent };
