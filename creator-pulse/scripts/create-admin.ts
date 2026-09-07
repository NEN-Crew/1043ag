// Creates (or resets the password of) an agency staff account.
//
//   npm run admin:create -- "Nome" email@1043.ag
//
// Prints the password once. Run it again with the same e-mail to issue a new
// password — that's the whole reset flow.
import { neon } from "@neondatabase/serverless";
import crypto from "node:crypto";
import { hashPassword } from "../lib/crypto";

async function main() {
  const [name, emailRaw] = process.argv.slice(2);
  if (!name || !emailRaw) {
    console.error('Usage: npm run admin:create -- "Nome" email@1043.ag');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Add it to .env or your shell first.");
    process.exit(1);
  }

  const email = emailRaw.trim().toLowerCase();
  const sql = neon(url);

  const taken = (await sql`select 1 from influencers where lower(email) = ${email}`)[0];
  if (taken) {
    console.error(`${email} already belongs to a creator account. Use a different e-mail.`);
    process.exit(1);
  }

  const base = name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const id = `${base || "admin"}-${crypto.randomBytes(2).toString("hex")}`;
  const password = crypto.randomBytes(9).toString("base64url"); // 12 chars

  const existing = (await sql`select id from admins where lower(email) = ${email}`)[0];
  if (existing) {
    await sql`update admins set name = ${name}, password_hash = ${hashPassword(password)} where id = ${existing.id}`;
    console.log(`Password reset for ${email}.`);
  } else {
    await sql`insert into admins (id, name, email, password_hash) values (${id}, ${name}, ${email}, ${hashPassword(password)})`;
    console.log(`Admin created.`);
  }

  console.log(`\n  e-mail:   ${email}\n  password: ${password}\n  login:    ${process.env.APP_URL ?? "http://localhost:3000"}/login\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
