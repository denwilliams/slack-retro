import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "./schema";

// Use a placeholder during build time, will be validated at runtime
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:password@localhost/dbname";

export const db = drizzle({ connection: DATABASE_URL, schema });
