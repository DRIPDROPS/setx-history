#!/usr/bin/env node

/**
 * Script to build presentations for all historical topics
 * Ensures all topics have permanent web pages
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { ResearchWorkflow } = require('./research-workflow');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function buildAllPresentations() {
    console.log('🔍 Building presentations for all historical topics...\n');
    
    // Get all historical topics
    db.all('SELECT name FROM historical_topics ORDER BY name', [], async (err, topics) => {
        if (err) {
            console.error('Error fetching topics:', err);
            db.close();
            return;
        }
        
        console.log(`📚 Found ${topics.length} topics to process\n`);
        
        // Process each topic
        for (const topic of topics) {
            try {
                console.log(`\n📍 Processing: ${topic.name}`);
                
                // Check if presentation already exists
                const presentationExists = await new Promise((resolve, reject) => {
                    db.get(`
                        SELECT p.html_path
                        FROM presentations p
                        JOIN topics_researched t ON p.topic_id = t.id
                        WHERE LOWER(t.topic) LIKE LOWER(?)
                        ORDER BY p.created_at DESC
                        LIMIT 1
                    `, [`%${topic.name}%`], (err, existingPresentation) => {
                        if (err) return reject(err);
                        resolve(!!existingPresentation);
                    });
                });
                
                if (presentationExists) {
                    console.log(`✅ Presentation already exists for: ${topic.name}`);
                    continue;
                }
                
                // Build presentation for this topic
                const workflow = new ResearchWorkflow(dbPath);
                const message = `Tell me about ${topic.name} in Southeast Texas history`;
                
                console.log(`🔬 Researching: ${topic.name}`);
                const result = await workflow.processUserQuery(message);
                workflow.close();
                
                if (result) {
                    console.log(`✅ Created presentation for: ${topic.name} (${result.mediaCount} media items)`);
                } else {
                    console.log(`⚠️  Failed to create presentation for: ${topic.name}`);
                }
                
                // Small delay to avoid overwhelming APIs
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`❌ Error processing ${topic.name}:`, error.message);
            }
        }
        
        console.log('\n🎉 Presentation building complete!');
        db.close();
    });
}

// Run if called directly
if (require.main === module) {
    buildAllPresentations();
}

module.exports = { buildAllPresentations };