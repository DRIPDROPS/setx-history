# Southeast Texas History

AI-powered chat agent for exploring Southeast Texas history and heritage.

## Quick Start

```bash
npm install
./start.sh
```

Visit http://localhost:3002

## Features

- Chat with AI historian about Southeast Texas
- Database of historical facts, cities, topics, and periods
- Learning system that captures new historical insights from conversations
- Automatic website population: Research workflow collects media and facts to populate the website
- Ollama cloud API integration

## How It Works

The website automatically creates permanent pages through a research workflow:
1. When a topic is researched, the system collects historical facts and media
2. A permanent web page is generated for that topic (these ARE the website pages)
3. The page displays historical facts, images, and content
4. Topics with pages are linked from the main site; topics without pages can be researched to create them

## API Endpoints

- `GET /api/cities` - List all cities
- `GET /api/topics` - List all topics
- `GET /api/facts` - List all historical facts
- `GET /api/periods` - List all historical periods
- `POST /api/chat/conversation` - Create new conversation
- `POST /api/chat` - Send message to AI historian

## Configuration

Set environment variables in `.env`:

```
OLLAMA_URL=https://ollama.com
OLLAMA_API_KEY=your-api-key-here
OLLAMA_MODEL=gpt-oss:20b-cloud
```

Or configure via `~/.ollama/config.json` after running `ollama login`.
