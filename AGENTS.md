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