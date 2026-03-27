import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const mockLpush = mock(() => Promise.resolve(1));
const mockLtrim = mock(() => Promise.resolve("OK"));
const mockLrange = mock(() => Promise.resolve([]));

const MockRedis = mock(
	() =>
		({
			lpush: mockLpush,
			ltrim: mockLtrim,
			lrange: mockLrange,
		}) as unknown,
);

mock.module("@upstash/redis", () => ({
	Redis: MockRedis,
}));

// Import after mocking
const { publishEvent, getRecentEvents, _resetForTesting } = await import("../redis");

describe("redis", () => {
	beforeEach(() => {
		_resetForTesting();
		mockLpush.mockClear();
		mockLtrim.mockClear();
		mockLrange.mockClear();
		MockRedis.mockClear();
	});

	afterEach(() => {
		delete process.env.UPSTASH_REDIS_REST_URL;
		delete process.env.UPSTASH_REDIS_REST_TOKEN;
		_resetForTesting();
	});

	describe("publishEvent", () => {
		test("is a no-op when Redis env vars are not set", () => {
			const event = { type: "item:added" as const, teamId: "T123", timestamp: Date.now() };
			publishEvent("T123", event);
			expect(mockLpush).not.toHaveBeenCalled();
		});

		test("calls lpush with correct key and data when Redis is configured", async () => {
			process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
			process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

			const event = { type: "item:added" as const, teamId: "T123", timestamp: 1000 };
			publishEvent("T123", event);

			// Give the fire-and-forget promise time to resolve
			await new Promise((r) => setTimeout(r, 10));

			expect(MockRedis).toHaveBeenCalledTimes(1);
			expect(mockLpush).toHaveBeenCalledWith("retro:events:T123", JSON.stringify(event));
			expect(mockLtrim).toHaveBeenCalledWith("retro:events:T123", 0, 49);
		});

		test("logs error when lpush fails", async () => {
			process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
			process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

			const consoleError = mock(() => {});
			const original = console.error;
			console.error = consoleError;

			mockLpush.mockImplementationOnce(() => Promise.reject(new Error("connection failed")));

			const event = { type: "item:added" as const, teamId: "T123", timestamp: 1000 };
			publishEvent("T123", event);

			await new Promise((r) => setTimeout(r, 10));

			expect(consoleError).toHaveBeenCalled();
			console.error = original;
		});
	});

	describe("getRecentEvents", () => {
		test("returns empty array when Redis is not configured", async () => {
			const events = await getRecentEvents("T123");
			expect(events).toEqual([]);
		});

		test("returns parsed events from Redis list", async () => {
			process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
			process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

			const event1 = { type: "item:added" as const, teamId: "T123", timestamp: 1000 };
			const event2 = { type: "item:deleted" as const, teamId: "T123", timestamp: 2000 };

			mockLrange.mockImplementationOnce(() =>
				Promise.resolve([JSON.stringify(event1), JSON.stringify(event2)] as never[]),
			);

			const events = await getRecentEvents("T123");
			expect(events).toEqual([event1, event2]);
		});
	});
});
