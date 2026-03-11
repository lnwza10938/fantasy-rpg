# Source Code (src/)

This directory contains the core logic of the application, split between the client and the server.

## 📂 Subdirectories

- `src/api/` - Backend API routes and logic (Express).
- `src/client/` - Frontend logic and styles.
- `src/db/` - Database connection and repositories (Supabase).
- `src/server.ts` - Entry point for the Express server.

## 🔄 Data Flow

1. User interacts with UI in `src/client/`.
2. Frontend sends requests to `src/api/` endpoints.
3. API logic uses `src/db/` repositories to interact with Supabase.
4. Data is returned to the client and rendered.

---

_Guide for AI: When modifying features, always check both the client UI and the corresponding API route._
