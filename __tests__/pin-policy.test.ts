import { describe, expect, it } from "vitest";
import { PIN_LENGTH, MAX_PIN_ATTEMPTS, LOCKOUT_MINUTES } from "@/lib/money/constants";

describe("PIN Policy Constants", () => {
  it("PIN must be exactly 6 digits", () => {
    expect(PIN_LENGTH).toBe(6);
  });

  it("lockout after 5 failed attempts", () => {
    expect(MAX_PIN_ATTEMPTS).toBe(5);
  });

  it("lockout duration is 15 minutes", () => {
    expect(LOCKOUT_MINUTES).toBe(15);
  });

  it("PIN regex validates correct length", () => {
    const validPin = "123456";
    const shortPin = "1234";
    const longPin = "12345678";
    const alphaPin = "12345a";

    const isValid = (p: string) => p.length === PIN_LENGTH && /^\d+$/.test(p);

    expect(isValid(validPin)).toBe(true);
    expect(isValid(shortPin)).toBe(false);
    expect(isValid(longPin)).toBe(false);
    expect(isValid(alphaPin)).toBe(false);
  });
});
