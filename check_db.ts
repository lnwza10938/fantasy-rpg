import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
);

async function checkTables() {
  const tables = [
    "players",
    "characters",
    "player_states",
    "monsters",
    "maps",
    "factions",
    "lore_snippets",
  ];
  console.log("--- DB Diagnostics ---");
  for (const table of tables) {
    const { error } = await supabase.from(table).select("*").limit(1);
    if (error && error.code === "42P01") {
      console.log(`❌ Table [${table}] is MISSING`);
    } else if (error) {
      console.log(`⚠️  Table [${table}] Error: ${error.message}`);
    } else {
      console.log(`✅ Table [${table}] OK`);
    }
  }
}

checkTables();
