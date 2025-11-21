## Agent Instructions for `setx-history`

### Build, Lint, and Test Commands

- **Start the server:** `npm start` (runs api-server.js)
- **Initialize the database:** `npm run init` (runs history-database.js)
- **Populate topics:** `npm run populate` (runs populate-all-topics.js)
- **Testing:** 
  - Run all tests: `npm test` or `npm run test`
  - Run a single test: Modify test.js to isolate specific test cases
  - Test page consolidation: `node test-consolidation.js`
- **Linting:** No linter configured. Follow existing code style conventions.

### Code Style Guidelines

- **Imports:** Use `require()` for modules (e.g., `const express = require('express');`)
- **Formatting:**
  - Indentation: 4 spaces
  - Strings: Use single quotes
  - Semicolons: Use at end of statements
- **Naming Conventions:**
  - `camelCase` for variables and functions (e.g., `chatWithAgent`)
  - `PascalCase` for classes (e.g., `MediaAgent`)
  - `snake_case` for database tables and columns (e.g., `historical_cities`)
- **Types:** Standard JavaScript with no type annotations
- **Error Handling:**
  - For database calls: Callback pattern with error-first argument
  - For async functions: Use `try...catch` blocks
  - Log errors to console with `console.error()`
- **Asynchronous Code:** Use `async/await` for new code, but be consistent with callbacks when modifying existing database-related code

### Page Consolidation Workflow

The system now automatically consolidates related research presentations into comprehensive category pages:

1. **Automatic Consolidation**: After research on related topics, the system automatically creates consolidated pages
2. **Tabbed Navigation**: Consolidated pages feature tabbed interfaces for easy navigation between subtopics
3. **Manual Triggers**: Use API endpoints to manually trigger consolidation:
   - `POST /api/consolidate/:category` - Consolidate specific category
   - `POST /api/consolidate-all` - Consolidate all categories
4. **Page Organization**: Related pages are grouped by main categories (Oil & Energy, Lumber Industry, Shipbuilding)
5. **Source Preservation**: All consolidated pages maintain proper attribution to original sources

Example consolidated pages have been created in `/public/presentations/` with tabbed interfaces for browsing related content.

### Interactive Page Enhancement

Each presentation page now includes an interactive enhancement widget that allows users to expand the page with new research:

1. **Enhancement Widget**: Located on every presentation page with:
   - Text input for asking questions about the current topic
   - "Research & Add" button to trigger research
   - Live status updates during research
   - Example questions tailored to the current page
   
2. **API Endpoint**: `POST /api/enhance-page`
   ```json
   {
     "topicId": 123,
     "topicName": "Beaumont",
     "query": "What were the major buildings in Beaumont during the oil boom?"
   }
   ```

3. **Workflow**:
   - User asks a question on the page (e.g., "Tell me about historical buildings in Beaumont")
   - System researches the query in the context of the current page
   - New facts and media are added to the existing topic
   - Page automatically regenerates and reloads with new content
   
4. **Features**:
   - Context-aware: Questions are automatically scoped to the current topic
   - Incremental: Adds to existing content without replacing it
   - Source-attributed: All new content maintains proper citations
   - Real-time feedback: Shows research progress and results

**Example Usage**:
- On the "Beaumont" page, ask: "What were the important buildings during the oil boom?"
- On the "Oil & Energy" page, ask: "Who were the key people in the Texas oil industry?"
- On any city page, ask: "Tell me about the architecture" or "What happened during World War II?"