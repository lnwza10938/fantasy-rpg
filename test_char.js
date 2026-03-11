import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
);

async function run() {
  const { data } = await supabase.from("characters").select("*");
  console.log(JSON.stringify(data, null, 2));
}
run();
