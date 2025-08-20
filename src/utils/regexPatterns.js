
export const FUNCTION_REGEX = /(?:function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|function))/g;

export const VARIABLE_REGEX = /(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;

export const CONSTANT_REGEX = /const\s+([A-Z][A-Z0-9_]*)\s*=/g;

export const IMPORT_REGEX = /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g;