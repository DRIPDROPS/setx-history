#!/usr/bin/env node

/**
 * Test script for SETX History application
 * Tests key functionality without requiring the server to be running
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database.sqlite');
let testsPassed = 0;
let testsFailed = 0;
const failures = [];

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function test(name, fn) {
    if (fn instanceof Promise || (typeof fn === 'function' && fn.constructor.name === 'AsyncFunction')) {
        // Async test
        const promise = fn instanceof Promise ? fn : fn();
        promise
            .then(() => {
                testsPassed++;
                console.log(`✅ ${name}`);
            })
            .catch(error => {
                testsFailed++;
                failures.push({ name, error: error.message });
                console.log(`❌ ${name}: ${error.message}`);
            });
    } else {
        // Sync test
        try {
            fn();
            testsPassed++;
            console.log(`✅ ${name}`);
        } catch (error) {
            testsFailed++;
            failures.push({ name, error: error.message });
            console.log(`❌ ${name}: ${error.message}`);
        }
    }
}

console.log('🧪 Testing SETX History Application\n');
console.log('='.repeat(50));

// Run all tests
test('Database file exists', () => {
    assert(fs.existsSync(dbPath), 'database.sqlite not found');
});

test('Module imports', () => {
    const { chatWithAgent } = require('./history-chat-agent');
    const { ResearchWorkflow } = require('./research-workflow');
    const { PresentationBuilder } = require('./presentation-builder');
    const { MediaAgent } = require('./media-agent');
    
    assert(typeof chatWithAgent === 'function', 'chatWithAgent not exported');
    assert(typeof ResearchWorkflow === 'function', 'ResearchWorkflow not exported');
    assert(typeof PresentationBuilder === 'function', 'PresentationBuilder not exported');
    assert(typeof MediaAgent === 'function', 'MediaAgent not exported');
});

test('Static files exist', () => {
    const publicDir = path.join(__dirname, 'public');
    assert(fs.existsSync(publicDir), 'public directory not found');
    
    const imagesDir = path.join(publicDir, 'images', 'historical');
    assert(fs.existsSync(imagesDir), 'images/historical directory not found');
    
    const presentationsDir = path.join(publicDir, 'presentations');
    assert(fs.existsSync(presentationsDir), 'presentations directory not found');
});

test('HTML files exist', () => {
    assert(fs.existsSync(path.join(__dirname, 'history.html')), 'history.html not found');
    assert(fs.existsSync(path.join(__dirname, 'public', 'presentations.html')), 'presentations.html not found');
    assert(fs.existsSync(path.join(__dirname, 'public', 'contribute.html')), 'contribute.html not found');
});

test('Database connection', () => {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                reject(err);
            } else {
                db.close();
                resolve();
            }
        });
    });
});

test('Required tables exist', () => {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath);
        const requiredTables = [
            'historical_cities',
            'historical_topics',
            'historical_facts',
            'historical_periods',
            'chat_conversations',
            'chat_messages'
        ];

        let checked = 0;
        requiredTables.forEach(table => {
            db.get(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                [table],
                (err, row) => {
                    checked++;
                    if (err) {
                        db.close();
                        reject(err);
                    } else if (!row) {
                        db.close();
                        reject(new Error(`Table ${table} does not exist`));
                    } else if (checked === requiredTables.length) {
                        db.close();
                        resolve();
                    }
                }
            );
        });
    });
});

test('Database has seed data', () => {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath);
        
        db.get('SELECT COUNT(*) as count FROM historical_cities', [], (err, row) => {
            if (err) {
                db.close();
                reject(err);
            } else {
                assert(row.count > 0, 'No cities in database');
                
                db.get('SELECT COUNT(*) as count FROM historical_topics', [], (err2, row2) => {
                    if (err2) {
                        db.close();
                        reject(err2);
                    } else {
                        assert(row2.count > 0, 'No topics in database');
                        
                        db.get('SELECT COUNT(*) as count FROM historical_facts', [], (err3, row3) => {
                            db.close();
                            if (err3) {
                                reject(err3);
                            } else {
                                assert(row3.count > 0, 'No facts in database');
                                resolve();
                            }
                        });
                    }
                });
            }
        });
    });
});

// Wait for async tests to complete
setTimeout(() => {
    console.log('\n' + '='.repeat(50));
    console.log(`\n📊 Test Results:`);
    console.log(`   ✅ Passed: ${testsPassed}`);
    console.log(`   ❌ Failed: ${testsFailed}`);
    
    if (failures.length > 0) {
        console.log(`\n❌ Failures:`);
        failures.forEach(f => {
            console.log(`   - ${f.name}: ${f.error}`);
        });
    }
    
    if (testsFailed === 0) {
        console.log('\n🎉 All tests passed!');
        process.exit(0);
    } else {
        console.log('\n⚠️  Some tests failed');
        process.exit(1);
    }
}, 2000);
