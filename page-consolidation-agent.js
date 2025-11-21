const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

/**
 * Page Consolidation Agent
 * Combines related research presentations into comprehensive category pages with tabbed navigation
 * 
 * This agent runs periodically or after significant research to organize content hierarchically:
 * - Combines related topics into master pages
 * - Creates tabbed navigation for subcategories
 * - Maintains all source attribution and media
 * - Preserves individual pages while creating consolidated views
 */

class PageConsolidationAgent {
    constructor(dbPath) {
        this.db = new sqlite3.Database(dbPath);
        this.presentationsDir = path.join(__dirname, 'public/presentations');
    }

    /**
     * Define topic hierarchies and consolidation rules
     */
    getTopicHierarchies() {
        return {
            'Oil & Energy': {
                displayName: 'Oil & Energy in Southeast Texas',
                icon: '⚡',
                description: 'The petroleum industry that transformed Southeast Texas from rural to industrial',
                subtopics: [
                    'Spindletop',
                    'Oil drilling methods',
                    'Refineries',
                    'Major oil companies'
                ],
                relatedTopics: ['Port Arthur', 'Beaumont']
            },
            'Lumber Industry': {
                displayName: 'Lumber Industry in Southeast Texas',
                icon: '🌲',
                description: 'The sawmill and timber era that built the region from 1880-1930',
                subtopics: [
                    'Sawmills',
                    'Logging techniques',
                    'Major lumber companies',
                    'Forest management'
                ],
                relatedTopics: ['Orange', 'Vidor']
            },
            'Shipbuilding': {
                displayName: 'Shipbuilding in Southeast Texas',
                icon: '🚢',
                description: 'Naval and commercial shipbuilding, especially during WWII',
                subtopics: [
                    'WWII shipyards',
                    'Construction techniques',
                    'Major shipbuilding companies',
                    'Types of vessels'
                ],
                relatedTopics: ['Orange', 'Port Arthur']
            }
        };
    }

    /**
     * Find existing presentations for a topic category
     */
    async findRelatedPresentations(mainTopic) {
        return new Promise((resolve, reject) => {
            const hierarchy = this.getTopicHierarchies()[mainTopic];
            if (!hierarchy) {
                resolve({ mainTopic, presentations: [], subtopics: [] });
                return;
            }

            // Find presentations that match the main topic or related topics
            const topicPatterns = [
                mainTopic,
                ...hierarchy.relatedTopics || [],
                ...hierarchy.subtopics || []
            ].map(t => `%${t}%`);

            const placeholders = topicPatterns.map(() => 'LOWER(t.topic) LIKE LOWER(?)').join(' OR ');
            
            const query = `
                SELECT p.*, t.topic as research_topic, t.keywords
                FROM presentations p
                JOIN topics_researched t ON p.topic_id = t.id
                WHERE ${placeholders}
                ORDER BY p.created_at DESC
            `;

            this.db.all(query, topicPatterns, (err, presentations) => {
                if (err) return reject(err);
                
                resolve({
                    mainTopic,
                    displayName: hierarchy.displayName,
                    icon: hierarchy.icon,
                    description: hierarchy.description,
                    presentations: presentations,
                    subtopics: hierarchy.subtopics
                });
            });
        });
    }

    /**
     * Extract content sections from an HTML presentation
     */
    extractContentSections(htmlContent) {
        // Extract title
        const titleMatch = htmlContent.match(/<h1[^>]*>(.*?)<\/h1>/i);
        const title = titleMatch ? titleMatch[1] : 'Untitled';
        
        // Extract hero section
        const heroMatch = htmlContent.match(/<div class="hero">(.*?)<\/div>/s);
        const heroSection = heroMatch ? heroMatch[1] : '';
        
        // Extract gallery
        const galleryMatch = htmlContent.match(/<div class="gallery">(.*?)<\/div>/s);
        const gallerySection = galleryMatch ? galleryMatch[1] : '';
        
        // Extract content/facts
        const contentMatch = htmlContent.match(/<div class="content">(.*?)<div class="timestamp">/s);
        const contentSection = contentMatch ? contentMatch[1] : '';
        
        return {
            title,
            hero: heroSection,
            gallery: gallerySection,
            content: contentSection
        };
    }

    /**
     * Create a tabbed interface from multiple presentations
     */
    createTabbedInterface(presentationsData) {
        const { mainTopic, displayName, icon, description, presentations } = presentationsData;
        
        if (presentations.length === 0) {
            return null;
        }

        // Create tabs for each presentation
        const tabs = presentations.map((pres, index) => {
            const content = this.extractContentSections(pres.content || '');
            return {
                id: `tab-${index}`,
                label: content.title.replace(/^[^a-z0-9]+/gi, '').substring(0, 30),
                content: `
                    <div class="tab-content">
                        ${content.hero ? `<div class="hero-section">${content.hero}</div>` : ''}
                        ${content.gallery ? `<div class="gallery-section">${content.gallery}</div>` : ''}
                        <div class="facts-section">${content.content || ''}</div>
                    </div>
                `
            };
        });

        // Create tab navigation
        const tabNavigation = `
            <div class="tab-navigation">
                ${tabs.map((tab, index) => `
                    <button class="tab-button ${index === 0 ? 'active' : ''}" 
                            data-tab="${tab.id}">
                        ${tab.label}
                    </button>
                `).join('')}
            </div>
        `;

        // Create tab content areas
        const tabContents = `
            <div class="tab-contents">
                ${tabs.map((tab, index) => `
                    <div id="${tab.id}" class="tab-pane ${index === 0 ? 'active' : ''}">
                        ${tab.content}
                    </div>
                `).join('')}
            </div>
        `;

        return {
            tabs,
            html: `
                <div class="consolidated-page">
                    <div class="page-header">
                        <h1>${icon} ${displayName}</h1>
                        <p>${description}</p>
                    </div>
                    
                    ${tabNavigation}
                    ${tabContents}
                </div>
            `
        };
    }

    /**
     * Generate consolidated page HTML with tabbed interface
     */
    generateConsolidatedPage(presentationsData) {
        const tabbedInterface = this.createTabbedInterface(presentationsData);
        
        if (!tabbedInterface) {
            return null;
        }

        const { mainTopic, displayName, icon, description } = presentationsData;
        const timestamp = new Date().toLocaleString();

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${displayName} - Southeast Texas History</title>
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
            border-radius: 12px;
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
        
        .consolidated-page {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        
        .page-header {
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            padding: 3rem;
            text-align: center;
        }
        
        .page-header h1 {
            font-size: 2.5rem;
            margin-bottom: 1rem;
        }
        
        .page-header p {
            font-size: 1.2rem;
            opacity: 0.9;
            max-width: 800px;
            margin: 0 auto;
        }
        
        .tab-navigation {
            display: flex;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
            overflow-x: auto;
        }
        
        .tab-button {
            padding: 1rem 2rem;
            background: transparent;
            border: none;
            cursor: pointer;
            font-weight: 600;
            color: #666;
            border-bottom: 3px solid transparent;
            transition: all 0.3s;
            white-space: nowrap;
        }
        
        .tab-button:hover {
            background: #e9ecef;
            color: #2a5298;
        }
        
        .tab-button.active {
            color: #2a5298;
            border-bottom: 3px solid #2a5298;
        }
        
        .tab-contents {
            padding: 2rem;
        }
        
        .tab-pane {
            display: none;
        }
        
        .tab-pane.active {
            display: block;
        }
        
        .hero-section {
            margin-bottom: 2rem;
        }
        
        .gallery-section {
            margin: 2rem 0;
        }
        
        .gallery-section img {
            width: 100%;
            height: 300px;
            object-fit: cover;
            border-radius: 12px;
            margin-bottom: 1rem;
        }
        
        .facts-section {
            margin-top: 2rem;
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
            border-top: 1px solid #eee;
            margin-top: 2rem;
        }
        
        @media (max-width: 768px) {
            .tab-navigation {
                flex-direction: column;
            }
            
            .tab-button {
                text-align: left;
                border-bottom: 1px solid #e9ecef;
                border-right: 3px solid transparent;
            }
            
            .tab-button.active {
                border-bottom: 1px solid #e9ecef;
                border-right: 3px solid #2a5298;
            }
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
    
    ${tabbedInterface.html}
    
    <div class="timestamp">
        Consolidated Page Generated: ${timestamp}<br>
        Contains ${presentationsData.presentations.length} related research presentations
    </div>
    
    <script>
        // Tab switching functionality
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from all buttons and panes
                document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
                
                // Add active class to clicked button
                button.classList.add('active');
                
                // Show corresponding tab pane
                const tabId = button.getAttribute('data-tab');
                document.getElementById(tabId).classList.add('active');
            });
        });
    </script>
</body>
</html>
        `;

        return html;
    }

    /**
     * Save consolidated page to file system
     */
    saveConsolidatedPage(mainTopic, htmlContent) {
        const filename = `${mainTopic.toLowerCase().replace(/\s+/g, '-')}-consolidated-${Date.now()}.html`;
        const filepath = path.join(this.presentationsDir, filename);
        
        try {
            fs.writeFileSync(filepath, htmlContent);
            console.log(`✅ Consolidated page created: ${filename}`);
            return {
                filename,
                filepath,
                url: `/presentations/${filename}`
            };
        } catch (error) {
            console.error(`❌ Failed to save consolidated page: ${error.message}`);
            return null;
        }
    }

    /**
     * Store consolidated page reference in database
     */
    storeConsolidatedPage(mainTopic, displayName, htmlPath) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT INTO consolidated_pages (main_topic, display_name, html_path, created_at)
                VALUES (?, ?, ?, datetime('now'))
            `, [mainTopic, displayName, htmlPath], function(err) {
                if (err) return reject(err);
                resolve(this.lastID);
            });
        });
    }

    /**
     * Main consolidation workflow
     */
    async consolidateTopicCategory(mainTopic) {
        console.log(`\n🔄 Consolidating pages for: ${mainTopic}`);
        
        try {
            // Find related presentations
            const presentationsData = await this.findRelatedPresentations(mainTopic);
            console.log(`📊 Found ${presentationsData.presentations.length} related presentations`);
            
            if (presentationsData.presentations.length === 0) {
                console.log(`⚠️  No presentations found for ${mainTopic}`);
                return null;
            }
            
            // Generate consolidated HTML
            const htmlContent = this.generateConsolidatedPage(presentationsData);
            if (!htmlContent) {
                console.log(`⚠️  Failed to generate consolidated page for ${mainTopic}`);
                return null;
            }
            
            // Save to file system
            const savedFile = this.saveConsolidatedPage(mainTopic, htmlContent);
            if (!savedFile) {
                console.log(`⚠️  Failed to save consolidated page for ${mainTopic}`);
                return null;
            }
            
            // Store in database
            try {
                await this.storeConsolidatedPage(
                    mainTopic, 
                    presentationsData.displayName, 
                    savedFile.filepath
                );
                console.log(`✅ Stored consolidated page reference in database`);
            } catch (dbError) {
                console.error(`⚠️  Database storage warning: ${dbError.message}`);
            }
            
            console.log(`✅ Successfully consolidated ${mainTopic} into ${savedFile.filename}`);
            return savedFile;
            
        } catch (error) {
            console.error(`❌ Error consolidating ${mainTopic}: ${error.message}`);
            return null;
        }
    }

    /**
     * Run consolidation for all major topic categories
     */
    async consolidateAllCategories() {
        console.log('🔄 Starting full page consolidation process...');
        
        const hierarchies = this.getTopicHierarchies();
        const results = [];
        
        for (const [mainTopic, hierarchy] of Object.entries(hierarchies)) {
            const result = await this.consolidateTopicCategory(mainTopic);
            if (result) {
                results.push({
                    category: mainTopic,
                    file: result.filename,
                    url: result.url
                });
            }
            // Small delay to avoid overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log(`\n✅ Page consolidation complete! Created ${results.length} consolidated pages.`);
        return results;
    }

    close() {
        this.db.close();
    }
}

module.exports = { PageConsolidationAgent };