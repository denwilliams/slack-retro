import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { processSlackEvent } from "@/lib/slack-handlers";

function verifySlackRequest(
  body: string,
  timestamp: string,
  signature: string
): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET!;
  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature =
    "v0=" +
    createHmac("sha256", signingSecret).update(sigBasestring).digest("hex");

  return (
    mySignature.length === signature.length &&
    createHmac("sha256", signingSecret)
      .update(mySignature)
      .digest("hex") ===
      createHmac("sha256", signingSecret).update(signature).digest("hex")
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const timestamp = request.headers.get("x-slack-request-timestamp") || "";
    const signature = request.headers.get("x-slack-signature") || "";

    // Verify request is from Slack
    if (!verifySlackRequest(body, timestamp, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Parse payload based on content type
    // Event subscriptions come as JSON, interactive components as form-encoded
    const contentType = request.headers.get("content-type") || "";
    let payload;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      // Interactive components (buttons, modals, etc.) send form-encoded data
      const params = new URLSearchParams(body);
      const payloadStr = params.get("payload");
      if (!payloadStr) {
        throw new Error("No payload field in form data");
      }
      payload = JSON.parse(payloadStr);
    } else {
      // Event subscriptions send JSON directly
      payload = JSON.parse(body);
    }

    // Handle URL verification challenge
    if (payload.type === "url_verification") {
      return NextResponse.json({ challenge: payload.challenge });
    }

    // Process the event synchronously to avoid serverless function termination
    // Slack expects a response within 3 seconds, but view publishing is usually fast
    await processSlackEvent(payload);

    // Acknowledge
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error processing Slack event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
