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

    const payload = JSON.parse(body);

    // Handle URL verification challenge
    if (payload.type === "url_verification") {
      return NextResponse.json({ challenge: payload.challenge });
    }

    // Process the event asynchronously
    setImmediate(() => processSlackEvent(payload));

    // Acknowledge immediately
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error processing Slack event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
