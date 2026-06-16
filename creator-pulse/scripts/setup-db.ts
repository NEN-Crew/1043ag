// Creates the tables. Run once with: npm run db:setup
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env or your shell first.");
  process.exit(1);
}

const sql = neon(url);
const schema = readFileSync(join(process.cwd(), "schema.sql"), "utf8");

// Run each statement in the schema file.
const statements = schema
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

for (const stmt of statements) {
  await (sql as any).query(stmt);
}
console.log(`Done. Ran ${statements.length} statements.`);
