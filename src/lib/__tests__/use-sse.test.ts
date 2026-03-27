import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

// Mock EventSource
type EventSourceListener = (event: { data: string }) => void;

class MockEventSource {
	static instances: MockEventSource[] = [];
	url: string;
	listeners: Record<string, EventSourceListener[]> = {};
	onerror: (() => void) | null = null;
	readyState = 0;

	constructor(url: string) {
		this.url = url;
		MockEventSource.instances.push(this);
	}

	addEventListener(event: string, listener: EventSourceListener) {
		if (!this.listeners[event]) {
			this.listeners[event] = [];
		}
		this.listeners[event]?.push(listener);
	}

	close() {
		this.readyState = 2;
	}

	// Test helper: simulate an event
	_emit(event: string, data: string) {
		const handlers = this.listeners[event];
		if (handlers) {
			for (const handler of handlers) {
				handler({ data });
			}
		}
	}

	static reset() {
		MockEventSource.instances = [];
	}
}

// biome-ignore lint/suspicious/noExplicitAny: assigning mock to global
(globalThis as any).EventSource = MockEventSource;

// Mock React hooks
let effectCleanup: (() => void) | null = null;
const mockUseState = mock(<T>(initial: T): [T, (v: T) => void] => {
	let value = initial;
	return [
		value,
		(v: T) => {
			value = v;
		},
	];
});
const mockUseRef = mock(<T>(initial: T) => ({ current: initial }));
const mockUseCallback = mock(<T>(fn: T) => fn);
const mockUseEffect = mock((fn: () => (() => void) | undefined) => {
	const cleanup = fn();
	if (cleanup) effectCleanup = cleanup;
});

mock.module("react", () => ({
	useState: mockUseState,
	useRef: mockUseRef,
	useCallback: mockUseCallback,
	useEffect: mockUseEffect,
}));

// Import after mocking
const { useSSE } = await import("../use-sse");

describe("useSSE", () => {
	beforeEach(() => {
		MockEventSource.reset();
		effectCleanup = null;
	});

	afterEach(() => {
		if (effectCleanup) {
			effectCleanup();
			effectCleanup = null;
		}
	});

	test("connects to /api/sse", () => {
		const onEvent = mock(() => {});
		useSSE(onEvent);

		expect(MockEventSource.instances).toHaveLength(1);
		expect(MockEventSource.instances[0]?.url).toBe("/api/sse");
	});

	test("calls onEvent when a message is received", () => {
		const onEvent = mock(() => {});
		useSSE(onEvent);

		const es = MockEventSource.instances[0];
		const event = { type: "item:added", teamId: "T123", timestamp: 1000 };
		es?._emit("message", JSON.stringify(event));

		expect(onEvent).toHaveBeenCalledWith(event);
	});

	test("does not call onEvent for malformed data", () => {
		const onEvent = mock(() => {});
		useSSE(onEvent);

		const es = MockEventSource.instances[0];
		es?._emit("message", "not-valid-json");

		expect(onEvent).not.toHaveBeenCalled();
	});

	test("reconnects on error", async () => {
		const onEvent = mock(() => {});
		useSSE(onEvent);

		expect(MockEventSource.instances).toHaveLength(1);

		// Trigger error to cause reconnect
		const es = MockEventSource.instances[0];
		es?.onerror?.();

		// Wait for reconnect timeout (1s initial backoff)
		await new Promise((r) => setTimeout(r, 1100));

		expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(2);
	});

	test("cleans up EventSource on unmount", () => {
		const onEvent = mock(() => {});
		useSSE(onEvent);

		const es = MockEventSource.instances[0];
		expect(es?.readyState).not.toBe(2);

		// Trigger cleanup
		if (effectCleanup) effectCleanup();

		expect(es?.readyState).toBe(2);
	});
});
