/**
 * Prettier configuration
 * https://prettier.io/docs/en/options.html
 */

/** @type {import("prettier").Config} */
module.exports = {
    // Line length before wrapping
    printWidth: 120,

    // Number of spaces per indentation level (matches ESLint "indent": 4)
    tabWidth: 4,

    // Use spaces instead of tabs
    useTabs: false,

    // Remove semicolons at the end of statements (matches ESLint "semi": never)
    semi: false,

    // Use double quotes instead of single quotes (matches ESLint "quotes": double)
    singleQuote: false,

    // Only add quotes around object properties when required
    quoteProps: "as-needed",

    // Use single quotes in JSX
    jsxSingleQuote: false,

    // Add trailing commas wherever valid in ES5 (objects, arrays, etc.)
    trailingComma: "all",

    // Print spaces between brackets in object literals
    bracketSpacing: true,

    // Put the `>` of a multi-line JSX element at the end of the last line
    bracketSameLine: false,

    // Include parentheses around a sole arrow function parameter
    arrowParens: "always",

    // Format only files that have a pragma comment at the top (disabled)
    requirePragma: false,

    // Insert a pragma comment at the top of formatted files (disabled)
    insertPragma: false,

    // Use default line-wrapping behavior for prose (markdown, etc.)
    proseWrap: "preserve",

    // Respect the default whitespace sensitivity for HTML
    htmlWhitespaceSensitivity: "css",

    // Line ending style
    endOfLine: "lf",

    // Format embedded code (e.g. in template literals) when possible
    embeddedLanguageFormatting: "auto",

    // Enforce single attribute per line in HTML/Vue/JSX
    singleAttributePerLine: false,
}
