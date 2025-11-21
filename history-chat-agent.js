const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs');
const os = require('os');

// Check for Ollama config file where authentication is stored after `ollama login`
const ollamaConfigPath = path.join(os.homedir(), '.ollama', 'config.json');
let ollamaConfig = {};

try {
    if (fs.existsSync(ollamaConfigPath)) {
        ollamaConfig = JSON.parse(fs.readFileSync(ollamaConfigPath, 'utf8'));
    }
} catch (err) {
    console.log('⚠️  No Ollama config found. Run `ollama login` to authenticate.');
}

const OLLAMA_URL = process.env.OLLAMA_URL || ollamaConfig.api_url || 'http://localhost:11434';
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || ollamaConfig.api_key || null;
const MODEL = process.env.OLLAMA_MODEL || 'gpt-oss:20b-cloud';

console.log(`🔧 Ollama Configuration:`);
console.log(`   URL: ${OLLAMA_URL}`);
console.log(`   Model: ${MODEL}`);
console.log(`   Using local Ollama server (authenticated via ollama signin)`);

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

/**
 * Southeast Texas History Chat Agent
 * Uses Ollama LLM with local historical database context
 */
class HistoryChatAgent {
    constructor() {
        this.conversationHistory = [];
        this.conversationId = null;
    }

    /**
     * Get relevant historical context from database
     */
    async getHistoricalContext(userQuery) {
        return new Promise((resolve, reject) => {
            // Extract keywords for search
            const keywords = userQuery.toLowerCase();

            // Build comprehensive context from database
            const context = {
                facts: [],
                cities: [],
                topics: [],
                periods: []
            };

            // Get relevant facts
            db.all(`
                SELECT
                    hf.title,
                    hf.content,
                    hf.event_year,
                    hc.name as city_name,
                    ht.name as topic_name
                FROM historical_facts hf
                LEFT JOIN historical_cities hc ON hf.city_id = hc.id
                LEFT JOIN historical_topics ht ON hf.topic_id = ht.id
                WHERE
                    hf.is_verified = 1 AND (
                        LOWER(hf.title) LIKE ? OR
                        LOWER(hf.content) LIKE ? OR
                        LOWER(hc.name) LIKE ? OR
                        LOWER(ht.name) LIKE ?
                    )
                ORDER BY hf.importance DESC, hf.event_year DESC
                LIMIT 10
            `, [`%${keywords}%`, `%${keywords}%`, `%${keywords}%`, `%${keywords}%`], (err, facts) => {
                if (err) {
                    console.error('Error fetching facts:', err);
                    context.facts = [];
                } else {
                    context.facts = facts || [];
                }

                // Get all cities for general knowledge
                db.all('SELECT * FROM historical_cities', [], (err, cities) => {
                    context.cities = cities || [];

                    // Get all topics
                    db.all('SELECT * FROM historical_topics', [], (err, topics) => {
                        context.topics = topics || [];

                        // Get relevant periods
                        db.all('SELECT * FROM historical_periods ORDER BY start_year ASC', [], (err, periods) => {
                            context.periods = periods || [];
                            resolve(context);
                        });
                    });
                });
            });
        });
    }

    /**
     * Build system prompt with historical context
     */
    buildSystemPrompt(context) {
        let prompt = `You are the Southeast Texas Local History Agent, an expert on the history, culture, and heritage of Southeast Texas, particularly the Golden Triangle region (Beaumont, Port Arthur, and Orange).

Your knowledge includes:

CITIES AND TOWNS:
${context.cities.map(c => `- ${c.name} (${c.county} County, founded ${c.founded_year}): ${c.founding_story}`).join('\n')}

HISTORICAL TOPICS:
${context.topics.map(t => `- ${t.name}: ${t.description}`).join('\n')}

HISTORICAL PERIODS:
${context.periods.map(p => `- ${p.name} (${p.start_year}-${p.end_year}): ${p.description}`).join('\n')}

`;

        if (context.facts && context.facts.length > 0) {
            prompt += `\nRELEVANT HISTORICAL FACTS:\n`;
            context.facts.forEach(fact => {
                prompt += `\n[${fact.event_year}] ${fact.title}\n`;
                prompt += `${fact.content}\n`;
                if (fact.city_name) prompt += `City: ${fact.city_name}\n`;
                if (fact.topic_name) prompt += `Topic: ${fact.topic_name}\n`;
            });
        }

        prompt += `\n
GUIDELINES:
- Provide accurate, detailed answers about Southeast Texas history
- Use the historical facts provided in your context when relevant
- If you mention a specific event or fact, cite the year when possible
- Be conversational and engaging, like a knowledgeable local historian
- If asked about something you're uncertain about, acknowledge the limitation but provide related information you do know
- Connect historical events to their significance for the region today
- Share interesting details and stories that bring history to life
- When users share new historical information or stories, acknowledge them warmly

Remember: You're helping people discover and appreciate Southeast Texas heritage!`;

        return prompt;
    }

    /**
     * Chat with the AI agent
     */
    async chat(userMessage, conversationId = null) {
        try {
            this.conversationId = conversationId;

            // Get relevant context from database
            const context = await this.getHistoricalContext(userMessage);

            // Build system prompt with context
            const systemPrompt = this.buildSystemPrompt(context);

            // Prepare messages for Ollama
            const messages = [
                {
                    role: 'system',
                    content: systemPrompt
                },
                ...this.conversationHistory.slice(-6), // Keep last 6 messages for context
                {
                    role: 'user',
                    content: userMessage
                }
            ];

            // Prepare headers
            const headers = {
                'Content-Type': 'application/json'
            };

            // Add API key if provided (for Ollama cloud)
            if (OLLAMA_API_KEY) {
                headers['Authorization'] = `Bearer ${OLLAMA_API_KEY}`;
            }

            // Configure proxy if needed
            const axiosConfig = { headers };

            if (process.env.HTTPS_PROXY || process.env.https_proxy) {
                const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
                axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
                axiosConfig.proxy = false; // Disable axios default proxy handling
            }

            // Call Ollama API
            const response = await axios.post(`${OLLAMA_URL}/api/chat`, {
                model: MODEL,
                messages: messages,
                stream: false,
                options: {
                    temperature: 0.7,
                    top_p: 0.9
                }
            }, axiosConfig);

            const aiResponse = response.data.message.content;

            // Update conversation history
            this.conversationHistory.push({
                role: 'user',
                content: userMessage
            });
            this.conversationHistory.push({
                role: 'assistant',
                content: aiResponse
            });

            // Keep conversation history manageable (last 10 messages)
            if (this.conversationHistory.length > 10) {
                this.conversationHistory = this.conversationHistory.slice(-10);
            }

            return {
                response: aiResponse,
                context_used: context.facts.length,
                success: true
            };

        } catch (error) {
            console.error('Error in chat agent:', error.message);

            // Fallback response if Ollama is not available
            if (error.code === 'ECONNREFUSED') {
                return {
                    response: "I apologize, but I'm currently unable to connect to my knowledge base. Please make sure Ollama is running (`ollama serve`). In the meantime, you can browse the historical facts in the database directly.",
                    error: 'Ollama not available',
                    success: false
                };
            }

            return {
                response: "I encountered an error processing your question. Please try again.",
                error: error.message,
                success: false
            };
        }
    }

    /**
     * Extract potential new insights from conversation
     */
    async extractInsights(userMessage, aiResponse) {
        // Simple heuristic: if user provides new information (contains years, specific details)
        const hasYear = /\b(18|19|20)\d{2}\b/.test(userMessage);
        const isLongMessage = userMessage.length > 100;
        const hasDetailWords = /\b(remember|told|grandfather|grandmother|story|heard|happened|recalled|family|ancestor|witnessed)\b/i.test(userMessage);
        const hasLocationWords = /\b(beaumont|port arthur|orange|nederland|groves|vidor|bridge city|texas|golden triangle)\b/i.test(userMessage);

        if ((hasYear || hasDetailWords) && isLongMessage && hasLocationWords) {
            // Try to extract city mentioned
            let cityId = null;
            const cityMatches = userMessage.match(/\b(beaumont|port arthur|orange|nederland|groves|vidor|bridge city)\b/i);

            if (cityMatches) {
                const cityName = cityMatches[0];
                // Get city ID from database
                await new Promise((resolve) => {
                    db.get('SELECT id FROM historical_cities WHERE LOWER(name) = LOWER(?)', [cityName], (err, row) => {
                        if (row) cityId = row.id;
                        resolve();
                    });
                });
            }

            return {
                shouldSave: true,
                insight: userMessage,
                confidence: 'low', // Needs verification
                cityId: cityId
            };
        }

        return {
            shouldSave: false
        };
    }

    /**
     * Save insight to database
     */
    async saveInsight(insight, cityId = null, topicId = null) {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO learned_insights (conversation_id, insight, city_id, topic_id)
                 VALUES (?, ?, ?, ?)`,
                [this.conversationId, insight, cityId, topicId],
                function(err) {
                    if (err) {
                        console.error('Error saving insight:', err);
                        reject(err);
                    } else {
                        console.log(`💡 New insight learned (ID: ${this.lastID})`);
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    /**
     * Clear conversation history
     */
    clearHistory() {
        this.conversationHistory = [];
    }
}

/**
 * API endpoint integration
 */
async function chatWithAgent(userMessage, conversationId = null) {
    const agent = new HistoryChatAgent();
    return await agent.chat(userMessage, conversationId);
}

module.exports = {
    HistoryChatAgent,
    chatWithAgent
};

// Test if run directly
if (require.main === module) {
    (async () => {
        console.log('🤖 Southeast Texas History Chat Agent\n');
        console.log('Testing agent...\n');

        const agent = new HistoryChatAgent();

        // Test questions
        const testQuestions = [
            "Tell me about the Spindletop oil discovery",
            "What was Orange, Texas known for?",
            "How did Port Arthur get its name?"
        ];

        for (const question of testQuestions) {
            console.log(`❓ Question: ${question}`);
            const result = await agent.chat(question);
            console.log(`🤖 Answer: ${result.response}\n`);
            console.log(`📊 Context facts used: ${result.context_used}\n`);
            console.log('---\n');
        }

        db.close();
    })();
}
