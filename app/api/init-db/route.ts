import { NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";

export async function POST() {
  try {
    await initDatabase();
    return NextResponse.json({
      success: true,
      message: "Database initialized successfully",
    });
  } catch (error) {
    console.error("Error initializing database:", error);
    return NextResponse.json(
      { success: false, error: "Failed to initialize database" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST to initialize the database",
  });
}
