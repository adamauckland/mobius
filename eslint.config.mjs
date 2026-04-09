import tseslint from "typescript-eslint";

// Minimal ESLint setup focused on banning `any` in production source.
// Test files (src/__tests__/**) are excluded because mocking Excalibur and
// other engine internals relies on `any` for ergonomics.
export default tseslint.config(
	{
		ignores: ["dist/**", "node_modules/**", "playwright-report/**", "test-results/**"],
	},
	{
		files: ["src/**/*.ts"],
		ignores: ["src/__tests__/**"],
		languageOptions: {
			parser: tseslint.parser,
		},
		plugins: {
			"@typescript-eslint": tseslint.plugin,
		},
		rules: {
			"@typescript-eslint/no-explicit-any": "error",
		},
	},
);
