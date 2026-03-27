import { useCallback, useEffect, useRef, useState } from "react";
import type { RetroEvent } from "@/server/redis";

const MAX_BACKOFF_MS = 30_000;
const INITIAL_BACKOFF_MS = 1_000;

export function useSSE(onEvent: (event: RetroEvent) => void): { connected: boolean } {
	const [connected, setConnected] = useState(false);
	const onEventRef = useRef(onEvent);
	onEventRef.current = onEvent;

	const connect = useCallback(() => {
		let backoff = INITIAL_BACKOFF_MS;
		let es: EventSource | null = null;
		let unmounted = false;

		function attempt() {
			if (unmounted) return;

			es = new EventSource("/api/sse");

			es.addEventListener("connected", () => {
				setConnected(true);
				backoff = INITIAL_BACKOFF_MS;
			});

			es.addEventListener("message", (msg) => {
				try {
					const data = JSON.parse(msg.data) as RetroEvent;
					onEventRef.current(data);
				} catch {
					// Ignore malformed events
				}
			});

			es.onerror = () => {
				setConnected(false);
				es?.close();
				es = null;

				if (!unmounted) {
					setTimeout(attempt, backoff);
					backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
				}
			};
		}

		attempt();

		return () => {
			unmounted = true;
			es?.close();
			es = null;
			setConnected(false);
		};
	}, []);

	useEffect(() => {
		return connect();
	}, [connect]);

	return { connected };
}
