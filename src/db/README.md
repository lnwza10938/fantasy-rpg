# Database Layer (src/db/)

This directory manages the connection and interactions with Supabase.

## 📄 Key Files

- `supabase.ts` - Client initialization using environment variables.
- `repositories.ts` - Data access layer (DAL) for Players, Characters, and World Save data.
- `*.sql` - Migration and schema scripts for database setup.

## 💾 Schema Notes

- **Players:** Authentication and basic user profiles.
- **Characters:** Created legends with stats and skills.
- **Save Data:** Serialized world state for active adventures.

---
*AI Tip: Check `repositories.ts` to understand how data is persisted or retrieved from the database.*
