/**
 * Seed Vercel KV from local JSON/MD files.
 * Usage: KV_REST_API_URL=... KV_REST_API_TOKEN=... npx tsx scripts/seed-kv.ts
 */
import { Redis } from "@upstash/redis";
import { readFileSync, readdirSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const kv = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

async function seed() {
  console.log("Seeding Vercel KV for AIS Prospect Engine...\n");

  // 1. AIS Prospect data
  const aisLeadsPath = path.join(ROOT, "data/prospects/ais-leads.json");
  if (existsSync(aisLeadsPath)) {
    const data = JSON.parse(readFileSync(aisLeadsPath, "utf-8"));
    await kv.set("prospects:ais-leads", data);
    console.log(`  [OK] prospects:ais-leads (${Array.isArray(data) ? data.length : "?"} prospects)`);
  } else {
    console.log(`  [SKIP] ${aisLeadsPath} not found`);
  }

  // 2. AIS Config
  const configPath = path.join(ROOT, "configs/ais-mn.md");
  if (existsSync(configPath)) {
    const content = readFileSync(configPath, "utf-8");
    await kv.set("config:ais-mn", content);
    console.log(`  [OK] config:ais-mn`);
  }

  // 3. Playbooks
  const playbooksDir = path.join(ROOT, "playbooks");
  if (existsSync(playbooksDir)) {
    const playbooks = readdirSync(playbooksDir).filter((f) => f.endsWith(".md"));
    for (const file of playbooks) {
      const name = file.replace(".md", "");
      const content = readFileSync(path.join(playbooksDir, file), "utf-8");
      await kv.set(`playbook:${name}`, content);
      console.log(`  [OK] playbook:${name}`);
    }
  }

  // 4. CLAUDE.md system prompt
  const claudeMdPath = path.join(ROOT, "CLAUDE.md");
  if (existsSync(claudeMdPath)) {
    const content = readFileSync(claudeMdPath, "utf-8");
    await kv.set("system:claude-md", content);
    console.log(`  [OK] system:claude-md`);
  }

  console.log("\nDone! All AIS data seeded to Vercel KV.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
