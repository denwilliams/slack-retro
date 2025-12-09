import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const results: { [key: string]: boolean } = {};

    // Check each table
    const tables = ["installations", "retrospectives", "discussion_items", "action_items"];

    for (const table of tables) {
      try {
        await sql`SELECT 1 FROM ${sql(table)} LIMIT 1`;
        results[table] = true;
      } catch (error) {
        results[table] = false;
      }
    }

    const allExist = Object.values(results).every(v => v);

    return NextResponse.json({
      success: allExist,
      tables: results,
      message: allExist
        ? "All tables exist"
        : "Some tables are missing - run POST /api/init-db to initialize",
    });
  } catch (error) {
    console.error("Error checking database health:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to check database",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
