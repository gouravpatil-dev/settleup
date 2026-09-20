import { env } from "./config/env.js";
import { getDb } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";
import { createApp } from "./app.js";

const db = getDb();
runMigrations(db);

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`SettleUp server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
