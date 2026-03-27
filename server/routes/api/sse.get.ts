import { defineHandler, getRequestHeader, setResponseHeader } from "nitro/h3";
import { getSessionFromCookieHeader } from "@/server/auth";
import type { RetroEvent } from "@/server/redis";
import { getRecentEvents } from "@/server/redis";

function filterNewEvents(events: RetroEvent[], afterTimestamp: number): RetroEvent[] {
	return events.filter((e) => e.timestamp > afterTimestamp).reverse();
}

function createSSEStream(
	teamId: string,
	onClose: (cb: () => void) => void,
): ReadableStream<Uint8Array> {
	return new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();

			function send(eventName: string, data: string) {
				controller.enqueue(encoder.encode(`event: ${eventName}\ndata: ${data}\n\n`));
			}

			send("connected", JSON.stringify({ teamId }));

			let lastSeenTimestamp = Date.now();
			let closed = false;

			async function poll() {
				if (closed) return;

				try {
					const events = await getRecentEvents(teamId);
					const newEvents = filterNewEvents(events, lastSeenTimestamp);

					for (const retroEvent of newEvents) {
						send("message", JSON.stringify(retroEvent));
						lastSeenTimestamp = Math.max(lastSeenTimestamp, retroEvent.timestamp);
					}
				} catch (err) {
					console.error("[sse] Error polling events:", err);
				}

				if (!closed) {
					setTimeout(poll, 2000);
				}
			}

			setTimeout(poll, 2000);

			onClose(() => {
				closed = true;
				try {
					controller.close();
				} catch {
					// Already closed
				}
			});
		},
	});
}

export default defineHandler((event) => {
	const session = getSessionFromCookieHeader(getRequestHeader(event, "cookie") ?? null);

	if (!session) {
		setResponseHeader(event, "content-type", "application/json");
		if (event.node?.res) {
			event.node.res.statusCode = 401;
		}
		return { error: "Unauthorized" };
	}

	const teamId = session.teamId;

	setResponseHeader(event, "content-type", "text/event-stream");
	setResponseHeader(event, "cache-control", "no-cache");
	setResponseHeader(event, "connection", "keep-alive");

	const stream = createSSEStream(teamId, (cb) => {
		event.node?.req.on("close", cb);
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	});
});
