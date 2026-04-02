/** Centralized owner UUID – single-user personal dashboard. */
export const OWNER_ID = "00000000-0000-0000-0000-000000000001";

/** PIN must be exactly this many digits. */
export const PIN_LENGTH = 6;

/** Lock account after this many failed PIN attempts. */
export const MAX_PIN_ATTEMPTS = 5;

/** Minutes to lock after exceeding MAX_PIN_ATTEMPTS. */
export const LOCKOUT_MINUTES = 15;

/** Allowed currency codes. */
export const VALID_CURRENCIES = ["CAD", "USD", "EGP"] as const;

/** Session cookie name for PIN auth. */
export const SESSION_COOKIE = "money_session";
