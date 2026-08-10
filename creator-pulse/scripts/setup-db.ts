// Creates the tables. Run once with: npm run db:setup
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Add it to .env or your shell first.");
    process.exit(1);
  }

  const sql = neon(url);
  const schema = readFileSync(join(process.cwd(), "schema.sql"), "utf8");

  // The HTTP driver runs one statement per call, so split on ";".
  // Comment lines are stripped per statement — a statement that merely
  // starts with a comment must still run.
  const statements = schema
    .split(";")
    .map((s) =>
      s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim()
    )
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await sql(stmt);
  }
  console.log(`Done. Ran ${statements.length} statements.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
