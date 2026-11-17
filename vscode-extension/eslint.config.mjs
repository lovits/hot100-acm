import typescriptEslint from "typescript-eslint";

export default [{
    ignores: ["out/**", "vendor/**", "node_modules/**", "scripts/**"],
}, ...typescriptEslint.configs.recommended, {
    files: ["**/*.ts"],

    plugins: {
        "@typescript-eslint": typescriptEslint.plugin,
    },

    languageOptions: {
        parser: typescriptEslint.parser,
        ecmaVersion: 2022,
        sourceType: "module",
    },

    rules: {
        "@typescript-eslint/naming-convention": ["warn", {
            selector: "import",
            format: ["camelCase", "PascalCase"],
        }],

        // 死代码类问题的直接防线：未使用变量/参数报 error（_ 前缀豁免，供占位参数）
        "@typescript-eslint/no-unused-vars": ["error", {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
            caughtErrorsIgnorePattern: "^_",
        }],

        // any 清零属重构类（REVIEW-REMAINING 一、），与本次工程收尾解耦；
        // 降 warn 保留可见性，随重构推进逐步收紧回 error
        "@typescript-eslint/no-explicit-any": "warn",

        curly: "warn",
        eqeqeq: "warn",
        "no-throw-literal": "warn",
        semi: "warn",
    },
}];
