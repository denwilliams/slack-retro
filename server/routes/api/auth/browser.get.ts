import { defineHandler, getQuery, redirect, setCookie } from "nitro/h3";
import { generateSessionToken, verifyAuthToken } from "@/server/auth";

export default defineHandler((event) => {
	const query = getQuery(event);
	const token = typeof query.token === "string" ? query.token : null;

	if (!token) {
		return { error: "Missing token" };
	}

	const payload = verifyAuthToken(token);
	if (!payload) {
		return { error: "Invalid or expired token" };
	}

	const sessionToken = generateSessionToken(payload.userId, payload.userName, payload.teamId);

	setCookie(event, "retro_session", sessionToken, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 14400,
		path: "/",
	});

	return redirect("/retro", 302);
});
