#!/usr/bin/env node

/**
 * Test script for the Page Consolidation Agent
 * Tests combining related research presentations into comprehensive category pages
 */

const { PageConsolidationAgent } = require('./page-consolidation-agent');
const path = require('path');

async function testConsolidationAgent() {
    console.log('🧪 Testing Page Consolidation Agent\n');
    
    const agent = new PageConsolidationAgent('./database.sqlite');
    
    try {
        // Test with Oil & Energy category
        console.log('🔍 Testing consolidation for: Oil & Energy');
        const result = await agent.consolidateTopicCategory('Oil & Energy');
        
        if (result) {
            console.log(`✅ Successfully created consolidated page:`);
            console.log(`   File: ${result.filename}`);
            console.log(`   URL: ${result.url}`);
        } else {
            console.log('⚠️  No consolidated page created (may already exist or no related presentations found)');
        }
        
        // Show available categories
        console.log('\n📚 Available topic categories for consolidation:');
        const hierarchies = agent.getTopicHierarchies();
        Object.entries(hierarchies).forEach(([category, info]) => {
            console.log(`   ${info.icon} ${category}`);
        });
        
        console.log('\n📋 To manually trigger consolidation:');
        console.log('   curl -X POST http://localhost:3002/api/consolidate/"Oil%20%26%20Energy"');
        console.log('   curl -X POST http://localhost:3002/api/consolidate-all');
        
        console.log('\n✅ Page Consolidation Agent test completed!');
        console.log('\n🔄 Consolidation Features:');
        console.log('   • Combines related presentations into master pages');
        console.log('   • Creates tabbed navigation for subcategories');
        console.log('   • Maintains source attribution and media');
        console.log('   • Preserves individual pages while creating consolidated views');
        console.log('   • Automatically triggers after relevant research');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        agent.close();
    }
}

// Run if called directly
if (require.main === module) {
    testConsolidationAgent();
}

module.exports = { testConsolidationAgent };