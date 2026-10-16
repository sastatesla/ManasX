/**
 * Unified naming convention utility for ManasX
 */

export function detectNamingStyle(name) {
  if (!name || typeof name !== 'string') return 'unknown';

  // Strip leading and trailing underscores (e.g. _id, __dirname, _profile)
  const clean = name.replace(/^_+|_+$/g, '');
  if (!clean) return 'unknown';

  // UPPER_CASE: e.g. ETSY, AUTH_URL, PORT, MAX_RETRIES, API_BASE_URL
  if (/^[A-Z][A-Z0-9_]*$/.test(clean)) {
    return 'UPPER_CASE';
  }

  // PascalCase: starts with uppercase, has lowercase, only alphanumeric (e.g. SellerService, UserProfile)
  if (/^[A-Z][a-zA-Z0-9]*$/.test(clean) && /[a-z]/.test(clean)) {
    return 'PascalCase';
  }

  // snake_case: starts with lowercase, contains underscore, only lowercase alphanumeric and underscore
  if (/^[a-z][a-z0-9_]*$/.test(clean) && clean.includes('_')) {
    return 'snake_case';
  }

  // kebab-case: starts with lowercase, contains hyphen
  if (/^[a-z][a-z0-9-]*$/.test(clean) && clean.includes('-')) {
    return 'kebab-case';
  }

  // camelCase: starts with lowercase, only alphanumeric, NO underscore, NO hyphen
  // Single lowercase words (e.g. data, profile, token, existing, filter, beneficiary, response) ARE valid camelCase
  if (/^[a-z][a-zA-Z0-9]*$/.test(clean)) {
    return 'camelCase';
  }

  return 'unknown';
}

export function isCamelCase(str) {
  return detectNamingStyle(str) === 'camelCase';
}

export function isPascalCase(str) {
  return detectNamingStyle(str) === 'PascalCase';
}

export function isSnakeCase(str) {
  return detectNamingStyle(str) === 'snake_case';
}

export function isKebabCase(str) {
  return detectNamingStyle(str) === 'kebab-case';
}

export function isUpperCase(str) {
  return detectNamingStyle(str) === 'UPPER_CASE';
}

export function convertNamingStyle(name, targetStyle) {
  if (!name || typeof name !== 'string') return name;

  switch (targetStyle) {
    case 'camelCase':
      return name
        .replace(/^[A-Z]/, c => c.toLowerCase())
        .replace(/[_-]([a-zA-Z0-9])/g, (_, char) => char.toUpperCase());

    case 'snake_case':
      return name
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/-/g, '_')
        .toLowerCase();

    case 'PascalCase':
      const camel = convertNamingStyle(name, 'camelCase');
      return camel.charAt(0).toUpperCase() + camel.slice(1);

    case 'UPPER_CASE':
      return convertNamingStyle(name, 'snake_case').toUpperCase();

    case 'kebab-case':
      return convertNamingStyle(name, 'snake_case').replace(/_/g, '-');

    default:
      return name;
  }
}
