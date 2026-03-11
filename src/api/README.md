# Backend API (src/api/)

This folder contains the server-side logic and route definitions.

## 📄 Key Files

- `gameplayRoutes.ts` - Main gameplay logic (Combat, Exploration, Events).
- `authRoutes.ts` - (If exists) Authentication and player management.

## 🛠 Design Principles

- Routes should be lean; heavy logic belongs in repository or helper functions.
- All game state updates are handled by the server to prevent cheating.
- AI-generated content (Skills, Lore) is typically managed via specific endpoints here.

---

_AI Tip: Use `gameplayRoutes.ts` to debug gameplay mechanics or add new world interaction events._
