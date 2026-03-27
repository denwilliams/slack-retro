const AUTH_SECRET =
	process.env.AUTH_SECRET ||
	process.env.SLACK_SIGNING_SECRET ||
	"default-secret-change-in-production";

export interface TokenPayload {
	userId: string;
	userName: string;
	teamId: string;
	exp: number;
}

function sign(data: string): string {
	const hasher = new Bun.CryptoHasher("sha256", AUTH_SECRET);
	hasher.update(data);
	return hasher.digest("base64url") as string;
}

export function generateAuthToken(userId: string, userName: string, teamId: string): string {
	const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
	const payload: TokenPayload = { userId, userName, teamId, exp: expiresAt };
	const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
	const signature = sign(payloadBase64);
	return `${payloadBase64}.${signature}`;
}

export function verifyAuthToken(token: string): TokenPayload | null {
	try {
		const dotIndex = token.indexOf(".");
		if (dotIndex === -1) return null;

		const payloadBase64 = token.slice(0, dotIndex);
		const signature = token.slice(dotIndex + 1);
		if (!payloadBase64 || !signature) return null;

		const expectedSignature = sign(payloadBase64);
		if (signature !== expectedSignature) return null;

		const payloadStr = Buffer.from(payloadBase64, "base64url").toString("utf-8");
		const payload: TokenPayload = JSON.parse(payloadStr);
		if (Date.now() > payload.exp) return null;

		return payload;
	} catch {
		return null;
	}
}

export function generateSessionToken(userId: string, userName: string, teamId: string): string {
	const expiresAt = Date.now() + 4 * 60 * 60 * 1000; // 4 hours
	const payload: TokenPayload = { userId, userName, teamId, exp: expiresAt };
	const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
	const signature = sign(payloadBase64);
	return `${payloadBase64}.${signature}`;
}

export function verifySessionToken(token: string): TokenPayload | null {
	return verifyAuthToken(token);
}

function parseCookie(cookieHeader: string, name: string): string | null {
	const pairs = cookieHeader.split(";");
	for (const pair of pairs) {
		const eqIndex = pair.indexOf("=");
		if (eqIndex === -1) continue;
		const key = pair.slice(0, eqIndex).trim();
		const value = pair.slice(eqIndex + 1).trim();
		if (key === name) return value;
	}
	return null;
}

export function getSessionFromCookieHeader(cookieHeader: string | null): TokenPayload | null {
	if (!cookieHeader) return null;
	const sessionValue = parseCookie(cookieHeader, "retro_session");
	if (!sessionValue) return null;
	return verifySessionToken(sessionValue);
}
