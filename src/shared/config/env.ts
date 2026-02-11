/**
 * Type-safe environment variable utilities
 * Shared across all services in the monorepo
 */

/**
 * Get string environment variable with optional default
 * @throws Error if required variable is missing
 */
export function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`❌ Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Get number environment variable with optional default
 * @throws Error if required variable is missing or not a valid number
 */
export function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`❌ Missing required environment variable: ${key}`);
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`❌ Invalid number for ${key}: ${value}`);
  }
  return parsed;
}

/**
 * Get boolean environment variable with default
 * Accepts: "true", "1" as true; anything else as false
 */
export function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value === "true" || value === "1";
}
