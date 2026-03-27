import { Redis } from "@upstash/redis";

export interface RetroEvent {
	type:
		| "item:added"
		| "item:edited"
		| "item:deleted"
		| "action:toggled"
		| "action:added"
		| "retro:finished"
		| "instructions:updated";
	teamId: string;
	timestamp: number;
}

let redis: Redis | null = null;
let warnedOnce = false;

function getRedis(): Redis | null {
	if (redis) return redis;

	const url = process.env.UPSTASH_REDIS_REST_URL;
	const token = process.env.UPSTASH_REDIS_REST_TOKEN;

	if (!url || !token) {
		if (!warnedOnce) {
			console.warn(
				"[redis] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set. Real-time updates disabled.",
			);
			warnedOnce = true;
		}
		return null;
	}

	redis = new Redis({ url, token });
	return redis;
}

const MAX_EVENTS = 50;

export function publishEvent(teamId: string, event: RetroEvent): void {
	const client = getRedis();
	if (!client) return;

	const key = `retro:events:${teamId}`;
	const payload = JSON.stringify(event);

	// Fire-and-forget: don't await, just log errors
	client
		.lpush(key, payload)
		.then(() => client.ltrim(key, 0, MAX_EVENTS - 1))
		.catch((err: unknown) => {
			console.error("[redis] Failed to publish event:", err);
		});
}

/** Exported for use by the SSE endpoint. Returns events newest-first. */
export async function getRecentEvents(teamId: string): Promise<RetroEvent[]> {
	const client = getRedis();
	if (!client) return [];

	const key = `retro:events:${teamId}`;
	const raw: string[] = await client.lrange(key, 0, MAX_EVENTS - 1);
	return raw.map((item) => JSON.parse(item) as RetroEvent);
}

/** Reset module state — only for testing. */
export function _resetForTesting(): void {
	redis = null;
	warnedOnce = false;
}
