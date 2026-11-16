// Import this FIRST in scripts: ES imports are evaluated in order, and src/db
// reads DATABASE_URL when it is imported.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
