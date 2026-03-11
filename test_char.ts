import { supabase } from "./src/db/supabase.js";

async function test() {
  console.log("Fetching players...");
  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("email", "1rinsakkarin10938@gmail.com");
  console.log("Players:", JSON.stringify(players, null, 2));

  if (players && players.length > 0) {
    console.log("Fetching characters for player", players[0].id);
    const { data: chars } = await supabase
      .from("characters")
      .select("*")
      .eq("player_id", players[0].id);
    console.log("Characters:", JSON.stringify(chars, null, 2));
  }
}

test();
