import { defineHandler, getRequestHeader, readRawBody, setResponseHeader } from "nitro/h3";
import { processSlackEvent } from "@/server/slack/handlers";

function verifySlackRequest(body: string, timestamp: string, signature: string): boolean {
	const signingSecret = process.env.SLACK_SIGNING_SECRET;
	if (!signingSecret) return false;

	const sigBasestring = `v0:${timestamp}:${body}`;
	const hasher = new Bun.CryptoHasher("sha256", signingSecret);
	hasher.update(sigBasestring);
	const mySignature = `v0=${hasher.digest("hex") as string}`;

	return mySignature === signature;
}

export default defineHandler(async (event) => {
	const body = (await readRawBody(event)) ?? "";
	const timestamp = getRequestHeader(event, "x-slack-request-timestamp") ?? "";
	const signature = getRequestHeader(event, "x-slack-signature") ?? "";

	if (!verifySlackRequest(body, timestamp, signature)) {
		setResponseHeader(event, "content-type", "application/json");
		return { error: "Invalid signature" };
	}

	const contentType = getRequestHeader(event, "content-type") ?? "";
	// biome-ignore lint/suspicious/noExplicitAny: Slack payloads are untyped
	let payload: any;

	if (contentType.includes("application/x-www-form-urlencoded")) {
		const params = new URLSearchParams(body);
		const payloadStr = params.get("payload");
		if (!payloadStr) {
			setResponseHeader(event, "content-type", "application/json");
			return { error: "No payload field in form data" };
		}
		payload = JSON.parse(payloadStr);
	} else {
		payload = JSON.parse(body);
	}

	if (payload.type === "url_verification") {
		setResponseHeader(event, "content-type", "application/json");
		return { challenge: payload.challenge };
	}

	await processSlackEvent(payload);

	if (payload.type === "view_submission") {
		return "";
	}

	setResponseHeader(event, "content-type", "application/json");
	return { ok: true };
});
