import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const config = defineConfig({
	plugins: [
		nitro({ inlineDynamicImports: true, preset: "bun", serveStatic: "inline" }),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	],
	resolve: {
		tsconfigPaths: true,
	},
});

export default config;
