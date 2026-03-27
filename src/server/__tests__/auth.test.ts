import { describe, expect, it } from "bun:test";
import {
	generateAuthToken,
	generateSessionToken,
	getSessionFromCookieHeader,
	verifyAuthToken,
	verifySessionToken,
} from "../auth";

describe("auth", () => {
	describe("generateAuthToken", () => {
		it("returns a string in payload.signature format", () => {
			const token = generateAuthToken("U123", "Alice", "T456");
			const parts = token.split(".");
			expect(parts).toHaveLength(2);
			expect(parts[0]).toBeTruthy();
			expect(parts[1]).toBeTruthy();
		});

		it("encodes the correct payload data", () => {
			const token = generateAuthToken("U123", "Alice", "T456");
			const payloadBase64 = token.split(".")[0] ?? "";
			const payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf-8"));
			expect(payload.userId).toBe("U123");
			expect(payload.userName).toBe("Alice");
			expect(payload.teamId).toBe("T456");
			expect(typeof payload.exp).toBe("number");
		});
	});

	describe("verifyAuthToken", () => {
		it("decodes a valid token correctly", () => {
			const token = generateAuthToken("U123", "Alice", "T456");
			const payload = verifyAuthToken(token);
			expect(payload).not.toBeNull();
			expect(payload?.userId).toBe("U123");
			expect(payload?.userName).toBe("Alice");
			expect(payload?.teamId).toBe("T456");
		});

		it("returns null for expired tokens", () => {
			const original = Date.now;
			// Generate token in the past
			Date.now = () => 1000;
			const token = generateAuthToken("U123", "Alice", "T456");
			// Restore time to present (well after 5-minute expiry)
			Date.now = original;
			const payload = verifyAuthToken(token);
			expect(payload).toBeNull();
		});

		it("returns null when payload is tampered", () => {
			const token = generateAuthToken("U123", "Alice", "T456");
			const parts = token.split(".");
			const signature = parts[1] ?? "";
			const tamperedPayload = Buffer.from(
				JSON.stringify({
					userId: "HACKER",
					userName: "Evil",
					teamId: "T456",
					exp: Date.now() + 99999999,
				}),
			).toString("base64url");
			const tampered = `${tamperedPayload}.${signature}`;
			expect(verifyAuthToken(tampered)).toBeNull();
		});

		it("returns null when signature is tampered", () => {
			const token = generateAuthToken("U123", "Alice", "T456");
			const payload = token.split(".")[0] ?? "";
			const tampered = `${payload}.invalidsignature`;
			expect(verifyAuthToken(tampered)).toBeNull();
		});

		it("returns null for token without a dot separator", () => {
			expect(verifyAuthToken("nodothere")).toBeNull();
		});

		it("returns null for empty parts", () => {
			expect(verifyAuthToken(".signature")).toBeNull();
			expect(verifyAuthToken("payload.")).toBeNull();
		});

		it("returns null for empty string", () => {
			expect(verifyAuthToken("")).toBeNull();
		});

		it("returns null for non-JSON payload", () => {
			const fakePayload = Buffer.from("not-json").toString("base64url");
			const secret =
				process.env.AUTH_SECRET ||
				process.env.SLACK_SIGNING_SECRET ||
				"default-secret-change-in-production";
			const hasher = new Bun.CryptoHasher("sha256", secret);
			hasher.update(fakePayload);
			const sig = hasher.digest("base64url") as string;
			expect(verifyAuthToken(`${fakePayload}.${sig}`)).toBeNull();
		});
	});

	describe("generateSessionToken", () => {
		it("generates a valid token with 4-hour expiry", () => {
			const token = generateSessionToken("U123", "Alice", "T456");
			const payloadBase64 = token.split(".")[0] ?? "";
			const payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf-8"));
			const fourHoursMs = 4 * 60 * 60 * 1000;
			const expectedExp = Date.now() + fourHoursMs;
			// Allow 1 second tolerance
			expect(Math.abs(payload.exp - expectedExp)).toBeLessThan(1000);
		});

		it("can be verified with verifySessionToken", () => {
			const token = generateSessionToken("U123", "Alice", "T456");
			const payload = verifySessionToken(token);
			expect(payload).not.toBeNull();
			expect(payload?.userId).toBe("U123");
		});
	});

	describe("getSessionFromCookieHeader", () => {
		it("extracts and verifies session from cookie header", () => {
			const token = generateSessionToken("U123", "Alice", "T456");
			const cookieHeader = `retro_session=${token}; other_cookie=abc`;
			const payload = getSessionFromCookieHeader(cookieHeader);
			expect(payload).not.toBeNull();
			expect(payload?.userId).toBe("U123");
			expect(payload?.userName).toBe("Alice");
			expect(payload?.teamId).toBe("T456");
		});

		it("returns null when cookie header is null", () => {
			expect(getSessionFromCookieHeader(null)).toBeNull();
		});

		it("returns null when retro_session cookie is missing", () => {
			expect(getSessionFromCookieHeader("other=value; foo=bar")).toBeNull();
		});

		it("returns null when retro_session has invalid token", () => {
			expect(getSessionFromCookieHeader("retro_session=garbage.token")).toBeNull();
		});

		it("handles cookie header with only retro_session", () => {
			const token = generateSessionToken("U999", "Bob", "T111");
			const payload = getSessionFromCookieHeader(`retro_session=${token}`);
			expect(payload).not.toBeNull();
			expect(payload?.userId).toBe("U999");
		});
	});
});
