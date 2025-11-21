#!/usr/bin/env node

/**
 * Populate all topics with research data
 * Triggers research workflow for all historical topics to populate the website with data
 * Note: Presentations are internal processing artifacts, not user-facing features
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { ResearchWorkflow } = require('./research-workflow');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

/**
 * Get all topics from database
 */
function getAllTopics() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM historical_topics ORDER BY name ASC', [], (err, topics) => {
            if (err) {
                reject(err);
            } else {
                resolve(topics || []);
            }
        });
    });
}

/**
 * Check if data has already been populated for a topic (internal check)
 */
function hasPresentation(topicName) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT p.id
            FROM presentations p
            JOIN topics_researched t ON p.topic_id = t.id
            WHERE LOWER(t.topic) = LOWER(?)
            LIMIT 1
        `, [topicName], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(!!row);
            }
        });
    });
}

/**
 * Process a single topic through research workflow
 */
async function processTopic(topic, index, total) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📚 Processing topic ${index + 1}/${total}: ${topic.name} ${topic.icon}`);
    console.log(`${'='.repeat(60)}`);

    try {
        // Check if data has already been populated
        const exists = await hasPresentation(topic.name);
        if (exists) {
            console.log(`⏭️  Data already populated for "${topic.name}", skipping...`);
            return { topic: topic.name, status: 'skipped', reason: 'already exists' };
        }

        // Create research workflow
        const workflow = new ResearchWorkflow(dbPath);
        
        // Build query message
        const query = `Tell me about ${topic.name} in Southeast Texas history`;
        console.log(`🔬 Research query: "${query}"`);

        // Process the query
        const result = await workflow.processUserQuery(query);
        workflow.close();

        if (result) {
            console.log(`✅ Successfully populated data for "${topic.name}"`);
            console.log(`   - Topic ID: ${result.topicId}`);
            console.log(`   - Media collected: ${result.mediaCount}`);
            
            return {
                topic: topic.name,
                status: 'success',
                topicId: result.topicId,
                mediaCount: result.mediaCount
            };
        } else {
            console.log(`⚠️  Could not extract or process topic "${topic.name}"`);
            return { topic: topic.name, status: 'failed', reason: 'could not extract topic' };
        }
    } catch (error) {
        console.error(`❌ Error processing "${topic.name}":`, error.message);
        return { topic: topic.name, status: 'error', error: error.message };
    }
}

/**
 * Main function to populate all topics
 */
async function populateAllTopics() {
    console.log('🚀 Starting population of all topics...\n');

    try {
        // Get all topics
        const topics = await getAllTopics();
        
        if (topics.length === 0) {
            console.log('⚠️  No topics found in database. Run `npm run init` first.');
            db.close();
            process.exit(1);
        }

        console.log(`📋 Found ${topics.length} topics to process:\n`);
        topics.forEach((topic, i) => {
            console.log(`   ${i + 1}. ${topic.icon} ${topic.name}`);
        });

        console.log(`\n⏳ Processing all topics...\n`);

        // Process each topic sequentially to avoid overwhelming the system
        const results = [];
        for (let i = 0; i < topics.length; i++) {
            const result = await processTopic(topics[i], i, topics.length);
            results.push(result);
            
            // Small delay between topics to be respectful to external APIs
            if (i < topics.length - 1) {
                console.log('\n⏸️  Waiting 2 seconds before next topic...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // Print summary
        console.log(`\n${'='.repeat(60)}`);
        console.log('📊 Population Summary');
        console.log(`${'='.repeat(60)}\n`);

        const successful = results.filter(r => r.status === 'success');
        const skipped = results.filter(r => r.status === 'skipped');
        const failed = results.filter(r => r.status === 'failed' || r.status === 'error');

        console.log(`✅ Successful: ${successful.length}`);
        successful.forEach(r => {
            console.log(`   - ${r.topic} (${r.mediaCount} media items)`);
        });

        if (skipped.length > 0) {
            console.log(`\n⏭️  Skipped: ${skipped.length}`);
            skipped.forEach(r => {
                console.log(`   - ${r.topic} (${r.reason})`);
            });
        }

        if (failed.length > 0) {
            console.log(`\n❌ Failed: ${failed.length}`);
            failed.forEach(r => {
                console.log(`   - ${r.topic}: ${r.reason || r.error}`);
            });
        }

        console.log(`\n🎉 Population complete!`);
        console.log(`   Total topics: ${topics.length}`);
        console.log(`   New data populated: ${successful.length}`);
        console.log(`   Already populated: ${skipped.length}`);
        console.log(`   Failed: ${failed.length}`);

    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    } finally {
        db.close();
    }
}

// Run if executed directly
if (require.main === module) {
    populateAllTopics()
        .then(() => {
            console.log('\n✅ Script completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = { populateAllTopics };

