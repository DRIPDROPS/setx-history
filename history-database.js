const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

/**
 * Initialize historical database tables
 * Creates comprehensive schema for Southeast Texas historical data
 */
function initializeHistoricalTables() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Cities and towns table
            db.run(`
                CREATE TABLE IF NOT EXISTS historical_cities (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    county TEXT,
                    founded_year INTEGER,
                    founding_story TEXT,
                    population_current INTEGER,
                    nickname TEXT,
                    notable_features TEXT,
                    coordinates TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) console.error('Error creating historical_cities:', err);
                else console.log('✅ Table: historical_cities');
            });

            // Historical topics/categories
            db.run(`
                CREATE TABLE IF NOT EXISTS historical_topics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    description TEXT,
                    icon TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) console.error('Error creating historical_topics:', err);
                else console.log('✅ Table: historical_topics');
            });

            // Historical periods
            db.run(`
                CREATE TABLE IF NOT EXISTS historical_periods (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    start_year INTEGER,
                    end_year INTEGER,
                    description TEXT,
                    significance TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) console.error('Error creating historical_periods:', err);
                else console.log('✅ Table: historical_periods');
            });

            // Historical facts and events
            db.run(`
                CREATE TABLE IF NOT EXISTS historical_facts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    event_date TEXT,
                    event_year INTEGER,
                    city_id INTEGER REFERENCES historical_cities(id),
                    topic_id INTEGER REFERENCES historical_topics(id),
                    period_id INTEGER REFERENCES historical_periods(id),
                    source_url TEXT,
                    source_name TEXT,
                    image_url TEXT,
                    is_verified INTEGER DEFAULT 0,
                    importance INTEGER DEFAULT 5,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) console.error('Error creating historical_facts:', err);
                else console.log('✅ Table: historical_facts');
            });

            // Notable people
            db.run(`
                CREATE TABLE IF NOT EXISTS historical_people (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    birth_year INTEGER,
                    death_year INTEGER,
                    city_id INTEGER REFERENCES historical_cities(id),
                    biography TEXT,
                    occupation TEXT,
                    significance TEXT,
                    image_url TEXT,
                    source_url TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) console.error('Error creating historical_people:', err);
                else console.log('✅ Table: historical_people');
            });

            // Chat conversations
            db.run(`
                CREATE TABLE IF NOT EXISTS chat_conversations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT UNIQUE,
                    user_ip TEXT,
                    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    ended_at DATETIME,
                    message_count INTEGER DEFAULT 0
                )
            `, (err) => {
                if (err) console.error('Error creating chat_conversations:', err);
                else console.log('✅ Table: chat_conversations');
            });

            // Chat messages
            db.run(`
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id INTEGER REFERENCES chat_conversations(id),
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) console.error('Error creating chat_messages:', err);
                else console.log('✅ Table: chat_messages');
            });

            // Learned insights from conversations
            db.run(`
                CREATE TABLE IF NOT EXISTS learned_insights (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id INTEGER REFERENCES chat_conversations(id),
                    insight TEXT NOT NULL,
                    topic_id INTEGER REFERENCES historical_topics(id),
                    city_id INTEGER REFERENCES historical_cities(id),
                    needs_verification INTEGER DEFAULT 1,
                    verified_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) console.error('Error creating learned_insights:', err);
                else console.log('✅ Table: learned_insights');
                resolve();
            });

            // Create indexes for better performance
            db.run(`CREATE INDEX IF NOT EXISTS idx_facts_city ON historical_facts(city_id)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_facts_topic ON historical_facts(topic_id)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_facts_year ON historical_facts(event_year)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON chat_messages(conversation_id)`);
        });
    });
}

/**
 * Initialize additional tables for page consolidation
 */
function initializeConsolidationTables() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Consolidated pages tracking
            db.run(`
                CREATE TABLE IF NOT EXISTS consolidated_pages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    main_topic TEXT NOT NULL,
                    display_name TEXT NOT NULL,
                    html_path TEXT NOT NULL,
                    presentation_count INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating consolidated_pages:', err);
                    reject(err);
                } else {
                    console.log('✅ Table: consolidated_pages');
                    resolve();
                }
            });
        });
    });
}

/**
 * Seed initial historical data
 */
async function seedHistoricalData() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Insert cities
            const cities = [
                { name: 'Beaumont', county: 'Jefferson', founded: 1838, story: 'Named after Mary Dewburleigh Beaumont, wife of businessman Henry Millard. Transformed by the 1901 Spindletop oil discovery.' },
                { name: 'Port Arthur', county: 'Jefferson', founded: 1895, story: 'Founded by railroad entrepreneur Arthur Stilwell, who named it after himself. Became major refinery center after Spindletop.' },
                { name: 'Orange', county: 'Orange', founded: 1836, story: 'Named for wild orange groves along the Sabine River. Originally called Green\'s Bluff, then Madison, before Orange in 1858.' },
                { name: 'Nederland', county: 'Jefferson', founded: 1897, story: 'Founded by Dutch immigrants, the name means "Netherland" in Dutch. Rice and canal-based farming community.' },
                { name: 'Port Neches', county: 'Jefferson', founded: 1927, story: 'Named after the Neches River. Incorporated as refineries expanded in the Golden Triangle.' },
                { name: 'Groves', county: 'Jefferson', founded: 1933, story: 'Named after local landowner Ella Groves. Developed as oil industry support city.' },
                { name: 'Vidor', county: 'Orange', founded: 1906, story: 'Founded by Charles Vidor, a lumber magnate from Austria-Hungary.' },
                { name: 'Bridge City', county: 'Orange', founded: 1970, story: 'Named for its location near the Rainbow Bridge. Youngest city in the Golden Triangle.' }
            ];

            const cityStmt = db.prepare(`
                INSERT OR IGNORE INTO historical_cities (name, county, founded_year, founding_story)
                VALUES (?, ?, ?, ?)
            `);

            cities.forEach(city => {
                cityStmt.run(city.name, city.county, city.founded, city.story);
            });
            cityStmt.finalize();
            console.log('✅ Seeded cities');

            // Insert topics
            const topics = [
                { name: 'Oil & Energy', desc: 'The petroleum industry that transformed Southeast Texas', icon: '⚡' },
                { name: 'Lumber Industry', desc: 'The sawmill and timber era that built the region', icon: '🌲' },
                { name: 'Shipbuilding', desc: 'Naval and commercial shipbuilding heritage', icon: '🚢' },
                { name: 'Cajun Culture', desc: 'French Acadian cultural influence and heritage', icon: '🎭' },
                { name: 'Native American', desc: 'Indigenous peoples including Atakapa and Karankawa', icon: '🪶' },
                { name: 'Civil War', desc: 'Southeast Texas during the American Civil War', icon: '⚔️' },
                { name: 'Hurricanes', desc: 'Major storms that shaped the region\'s history', icon: '🌪️' },
                { name: 'Railroad', desc: 'Railroad development and transportation', icon: '🚂' },
                { name: 'Education', desc: 'Schools, universities, and educational development', icon: '📚' },
                { name: 'Music & Arts', desc: 'Musical heritage from blues to Cajun music', icon: '🎵' }
            ];

            const topicStmt = db.prepare(`
                INSERT OR IGNORE INTO historical_topics (name, description, icon)
                VALUES (?, ?, ?)
            `);

            topics.forEach(topic => {
                topicStmt.run(topic.name, topic.desc, topic.icon);
            });
            topicStmt.finalize();
            console.log('✅ Seeded topics');

            // Insert historical periods
            const periods = [
                { name: 'Pre-Settlement Era', start: 0, end: 1830, desc: 'Native American period before European settlement', significance: 'Atakapa and other indigenous peoples inhabited the region' },
                { name: 'Early Settlement', start: 1830, end: 1860, desc: 'First European-American settlers arrive', significance: 'Cities founded, agriculture established' },
                { name: 'Civil War Era', start: 1861, end: 1865, desc: 'American Civil War period', significance: 'Battle of Sabine Pass and Confederate Texas' },
                { name: 'Reconstruction', start: 1865, end: 1877, desc: 'Post-war recovery and rebuilding', significance: 'Economic transition, railroad expansion' },
                { name: 'Lumber Boom', start: 1880, end: 1930, desc: 'Peak of lumber industry', significance: 'Orange became major sawmill center, economic prosperity' },
                { name: 'Spindletop Era', start: 1901, end: 1940, desc: 'Oil discovery and early petroleum industry', significance: 'Transformed Texas economy, birth of major oil companies' },
                { name: 'World War II', start: 1941, end: 1945, desc: 'Wartime shipbuilding and industry', significance: 'Orange shipyards built hundreds of vessels, major economic boom' },
                { name: 'Petrochemical Expansion', start: 1945, end: 1980, desc: 'Refineries and chemical plants expand', significance: 'Golden Triangle becomes major refining center' },
                { name: 'Modern Era', start: 1980, end: 2025, desc: 'Diversification and hurricane challenges', significance: 'Economic diversification, major hurricanes (Rita, Ike, Harvey, Laura)' }
            ];

            const periodStmt = db.prepare(`
                INSERT OR IGNORE INTO historical_periods (name, start_year, end_year, description, significance)
                VALUES (?, ?, ?, ?, ?)
            `);

            periods.forEach(period => {
                periodStmt.run(period.name, period.start, period.end, period.desc, period.significance);
            });
            periodStmt.finalize();
            console.log('✅ Seeded periods');

            // Get city and topic IDs for facts (using Promise.all for proper sequencing)
            db.get('SELECT id FROM historical_cities WHERE name = ?', ['Beaumont'], (err, beaumont) => {
                if (err) {
                    console.error('Error fetching Beaumont:', err);
                    return resolve();
                }
                
                db.get('SELECT id FROM historical_cities WHERE name = ?', ['Port Arthur'], (err2, portArthur) => {
                    if (err2) {
                        console.error('Error fetching Port Arthur:', err2);
                        return resolve();
                    }
                    
                    db.get('SELECT id FROM historical_cities WHERE name = ?', ['Orange'], (err3, orange) => {
                        if (err3) {
                            console.error('Error fetching Orange:', err3);
                            return resolve();
                        }
                        
                        db.get('SELECT id FROM historical_topics WHERE name = ?', ['Oil & Energy'], (err4, oilTopic) => {
                            if (err4) {
                                console.error('Error fetching Oil & Energy topic:', err4);
                                return resolve();
                            }
                            
                            db.get('SELECT id FROM historical_topics WHERE name = ?', ['Lumber Industry'], (err5, lumberTopic) => {
                                if (err5) {
                                    console.error('Error fetching Lumber Industry topic:', err5);
                                    return resolve();
                                }
                                
                                db.get('SELECT id FROM historical_topics WHERE name = ?', ['Shipbuilding'], (err6, shipTopic) => {
                                    if (err6) {
                                        console.error('Error fetching Shipbuilding topic:', err6);
                                        return resolve();
                                    }

                                    const facts = [
                                            {
                                                title: 'Spindletop Oil Gusher Erupts',
                                                content: 'On January 10, 1901, at Spindletop Hill near Beaumont, the Lucas Gusher erupted, shooting oil over 100 feet into the air. The well flowed an estimated 100,000 barrels per day for nine days before being capped. This discovery launched the modern petroleum industry and transformed Texas from a rural agricultural state into an industrial powerhouse. Major companies including Texaco, Gulf Oil, and Humble (later Exxon) were born from this strike.',
                                                date: '1901-01-10',
                                                year: 1901,
                                                city_id: beaumont?.id,
                                                topic_id: oilTopic?.id,
                                                source: 'Texas State Historical Association',
                                                importance: 10,
                                                image_url: '/images/historical/spindletop-lucas-gusher-1901.jpg'
                                            },
                                            {
                                                title: 'Beaumont Population Explosion',
                                                content: 'Following the Spindletop discovery, Beaumont\'s population exploded from 10,000 to over 50,000 in just a few months. By the end of 1902, more than 500 oil companies had been formed and 285 wells were in operation around Beaumont.',
                                                date: '1901',
                                                year: 1901,
                                                city_id: beaumont?.id,
                                                topic_id: oilTopic?.id,
                                                source: 'Spindletop Museum',
                                                importance: 8,
                                                image_url: '/images/historical/queen-of-waco-gusher-1901.jpg'
                                            },
                                            {
                                                title: 'Port Arthur Refineries Established',
                                                content: 'Gulf Oil in 1901 and Texaco in 1902 built major refineries at Port Arthur to process crude oil from Spindletop and other fields. By 1916, the Port Arthur refinery was one of the three largest in the United States. By 1950, five refineries in the Port Arthur area employed some 12,000 workers.',
                                                date: '1901',
                                                year: 1901,
                                                city_id: portArthur?.id,
                                                topic_id: oilTopic?.id,
                                                source: 'Texas State Historical Association',
                                                importance: 9,
                                                image_url: '/images/historical/port-arthur-refinery.jpg'
                                            },
                                            {
                                                title: 'Orange Lumber Industry Peak',
                                                content: 'By the 1880s, Orange was recognized as the leader in East Texas sawmill activity with seventeen steam sawmills operating. The lumber industry was responsible for Orange\'s late Victorian "Golden Age." Companies like H.J. Lutcher and G.B. Moore, who moved operations from Pennsylvania in 1877, made Orange the center of the Texas lumbering district.',
                                                date: '1880',
                                                year: 1880,
                                                city_id: orange?.id,
                                                topic_id: lumberTopic?.id,
                                                source: 'Texas State Historical Association',
                                                importance: 8
                                            },
                                            {
                                                title: 'Orange Shipbuilding in World War II',
                                                content: 'During World War II, Orange became a major shipbuilding center. The deep water port and availability of timber made it ideal for the industry. Orange shipyards produced hundreds of vessels for the war effort, reaching peak production levels. The shipbuilding industry employed thousands and transformed the local economy.',
                                                date: '1941',
                                                year: 1941,
                                                city_id: orange?.id,
                                                topic_id: shipTopic?.id,
                                                source: 'Heritage House of Orange County',
                                                importance: 9
                                            },
                                            {
                                                title: 'Arthur Stilwell Founds Port Arthur',
                                                content: 'Kansas railroad promoter Arthur E. Stilwell launched the Kansas City, Pittsburg and Gulf Railroad in 1894. By December 1895, Stilwell and his backers had acquired land on the western shore of Sabine Lake and begun platting a city, which the promoter named after himself. The city was incorporated in 1898, and the port opened for seagoing shipping with the arrival of the British steamer Saint Oswald in August 1899.',
                                                date: '1895',
                                                year: 1895,
                                                city_id: portArthur?.id,
                                                topic_id: oilTopic?.id,
                                                source: 'Texas State Historical Association',
                                                importance: 7
                                            },
                                            {
                                                title: 'Orange Named for Wild Orange Groves',
                                                content: 'Originally called Green\'s Bluff for Sabine River boatman Resin Green who arrived before 1830, the settlement was renamed Madison in 1852. In 1858, the name Orange was adopted because of the native orange groves that attracted the attention of boatmen as they navigated the Sabine River.',
                                                date: '1858',
                                                year: 1858,
                                                city_id: orange?.id,
                                                topic_id: null,
                                                source: 'City of Orange',
                                                importance: 5
                                            }
                                        ];

                                        const factStmt = db.prepare(`
                                            INSERT INTO historical_facts (title, content, event_date, event_year, city_id, topic_id, source_name, importance, is_verified, image_url)
                                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
                                        `);

                                        facts.forEach(fact => {
                                            factStmt.run(
                                                fact.title,
                                                fact.content,
                                                fact.date,
                                                fact.year,
                                                fact.city_id,
                                                fact.topic_id,
                                                fact.source,
                                                fact.importance,
                                                fact.image_url || null
                                            );
                                        });

                                    factStmt.finalize((finalizeErr) => {
                                        if (finalizeErr) {
                                            console.error('Error finalizing fact statement:', finalizeErr);
                                        } else {
                                            console.log('✅ Seeded historical facts');
                                        }
                                        resolve();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}

// Run if executed directly
if (require.main === module) {
    console.log('🏛️  Initializing Southeast Texas Historical Database...\n');
    initializeHistoricalTables()
        .then(() => seedHistoricalData())
        .then(() => {
            console.log('\n✅ Historical database initialized successfully!');
            db.close();
        })
        .catch(err => {
            console.error('❌ Error initializing database:', err);
            db.close();
        });
}

/**
 * Initialize all database tables
 * Creates comprehensive schema for Southeast Texas historical data including consolidation tables
 */
async function initializeAllTables() {
    try {
        await initializeHistoricalTables();
        await initializeConsolidationTables();
        console.log('✅ All database tables initialized');
    } catch (error) {
        console.error('❌ Error initializing database tables:', error);
        throw error;
    }
}

module.exports = { 
    initializeHistoricalTables, 
    initializeConsolidationTables,
    initializeAllTables,
    seedHistoricalData 
};
