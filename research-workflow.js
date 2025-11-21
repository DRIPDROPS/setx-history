const { MediaAgent } = require('./media-agent');
const { PresentationBuilder } = require('./presentation-builder');
const path = require('path');

/**
 * Research Workflow Orchestrator
 * Coordinates topic research -> media collection -> data population
 * Note: Presentations are internal processing artifacts used during data collection, not user-facing
 */
class ResearchWorkflow {
    constructor(dbPath) {
        this.dbPath = dbPath || path.join(__dirname, 'database.sqlite');
        this.mediaAgent = new MediaAgent(this.dbPath);
        this.presentationBuilder = new PresentationBuilder(this.dbPath);
    }

    /**
     * Extract topic from user message
     */
    extractTopic(message) {
        // Simple topic extraction - can be enhanced with NLP
        // Order patterns from most specific to most general
        const patterns = [
            /(spindletop|beaumont|port arthur|orange|lumber|oil|shipbuilding|cajun)/i,
            /tell me about (.*?)(\?|$)/i,
            /what (?:is|was|were) (.*?)(\?|$)/i,
            /how did (.*?)(\?|$)/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                return match[1] ? match[1].trim() : match[0].trim();
            }
        }

        return null;
    }

    /**
     * Extract keywords from message
     */
    extractKeywords(message) {
        const keywords = [];
        const commonWords = ['tell', 'me', 'about', 'what', 'is', 'was', 'were', 'how', 'did', 'the', 'a', 'an'];

        const words = message.toLowerCase().split(/\s+/);
        for (const word of words) {
            if (word.length > 3 && !commonWords.includes(word)) {
                keywords.push(word.replace(/[?!.,]/, ''));
            }
        }

        return keywords.slice(0, 5); // Top 5 keywords
    }

    /**
     * Full research workflow
     * @param {string} userMessage - The user's query
     * @param {number} existingTopicId - Optional: If provided, enhances existing topic instead of creating new one
     */
    async processUserQuery(userMessage, existingTopicId = null) {
        console.log('\n🔬 Research Workflow Starting...');

        const topic = this.extractTopic(userMessage);
        if (!topic) {
            console.log('⚠️  No clear topic found in message');
            return null;
        }

        console.log(`📝 Topic identified: "${topic}"`);

        const keywords = this.extractKeywords(userMessage);
        console.log(`🔑 Keywords: ${keywords.join(', ')}`);

        // Step 1: Research and collect media
        const research = await this.mediaAgent.researchAndCollect(topic, keywords, existingTopicId);

        // Step 2: Generate presentation (internal artifact for data organization)
        const presentation = await this.presentationBuilder.generatePresentation(research.topicId);

        console.log(`✅ Workflow complete!`);
        console.log(`   - Topic ID: ${research.topicId}`);
        console.log(`   - Media collected: ${research.mediaCount}`);
        console.log(`   - Data organized and stored`);

        return {
            topicId: research.topicId,
            topic: research.topic,
            mediaCount: research.mediaCount,
            presentationUrl: presentation.filepath,
            presentationPath: presentation.fullPath
        };
    }

    close() {
        this.mediaAgent.close();
        this.presentationBuilder.close();
    }
}

module.exports = { ResearchWorkflow };

// CLI usage
if (require.main === module) {
    const workflow = new ResearchWorkflow();
    const testMessage = process.argv[2] || 'Tell me about Spindletop oil discovery';

    workflow.processUserQuery(testMessage)
        .then(result => {
            console.log('\n📊 Result:', result);
            workflow.close();
        })
        .catch(err => {
            console.error('Error:', err);
            workflow.close();
        });
}
