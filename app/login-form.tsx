"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "./auth-provider";
import { Lock, KeyRound, Delete, Loader2 } from "lucide-react";

const PIN_LENGTH = 6;

export function LoginForm() {
  const { signIn, setPin: setNewPin, pinExists } = useAuth();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  // Two modes: setting a new PIN (confirm step) or entering existing PIN
  const isSetupMode = pinExists === false;
  const [setupStep, setSetupStep] = useState<"enter" | "confirm">("enter");

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleDigit = useCallback(
    async (digit: string) => {
      if (loading) return;
      setError("");

      if (isSetupMode && setupStep === "confirm") {
        const next = confirmPin + digit;
        if (next.length > PIN_LENGTH) return;
        setConfirmPin(next);

        if (next.length === PIN_LENGTH) {
          if (next !== pin) {
            setError("PINs don't match. Try again.");
            setPin("");
            setConfirmPin("");
            setSetupStep("enter");
            triggerShake();
            return;
          }
          setLoading(true);
          try {
            await setNewPin(next);
          } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to set PIN");
            setPin("");
            setConfirmPin("");
            setSetupStep("enter");
            triggerShake();
          } finally {
            setLoading(false);
          }
        }
        return;
      }

      // Normal mode: enter PIN
      const next = pin + digit;
      if (next.length > PIN_LENGTH) return;
      setPin(next);

      if (next.length === PIN_LENGTH) {
        if (isSetupMode) {
          // Move to confirm step
          setSetupStep("confirm");
          return;
        }

        // Verify PIN
        setLoading(true);
        try {
          await signIn(next);
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : "Invalid PIN");
          setPin("");
          triggerShake();
        } finally {
          setLoading(false);
        }
      }
    },
    [pin, confirmPin, loading, signIn, setNewPin, isSetupMode, setupStep]
  );

  const handleDelete = useCallback(() => {
    if (loading) return;
    setError("");
    if (isSetupMode && setupStep === "confirm") {
      setConfirmPin((p) => p.slice(0, -1));
    } else {
      setPin((p) => p.slice(0, -1));
    }
  }, [loading, isSetupMode, setupStep]);

  const currentPin = isSetupMode && setupStep === "confirm" ? confirmPin : pin;

  // Keyboard support
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        handleDelete();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleDigit, handleDelete]);

  const title = isSetupMode ? "Set Your PIN" : "Finance Dashboard";
  const subtitle = isSetupMode
    ? setupStep === "confirm"
      ? "Confirm your PIN"
      : "Choose a 6-digit PIN"
    : "Enter your PIN";
  const Icon = isSetupMode ? KeyRound : Lock;

  // Still checking if PIN exists
  if (pinExists === null) {
    return (
      <div className="flex h-screen items-center justify-center overflow-hidden bg-bg-main">
        <Loader2 className="h-8 w-8 animate-spin text-accent-purple" />
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center overflow-hidden bg-bg-main p-4">
      <div className="w-full max-w-xs">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-purple to-accent-pink shadow-glow">
            <Icon className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-text-primary">{title}</h1>
          <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
        </div>

        {/* PIN Dots */}
        <div
          className={`mb-8 flex items-center justify-center gap-3 ${shake ? "animate-shake" : ""}`}
        >
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div
              key={i}
              className={`h-3.5 w-3.5 rounded-full border-2 transition-all duration-200 ${
                i < currentPin.length
                  ? isSetupMode
                    ? "border-accent-pink bg-accent-pink scale-110"
                    : "border-accent-purple bg-accent-purple scale-110"
                  : "border-border-subtle bg-transparent"
              }`}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <p className="mb-4 text-center text-xs text-red-400">{error}</p>
        )}

        {/* Loading */}
        {loading && (
          <div className="mb-4 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-accent-purple" />
          </div>
        )}

        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              onClick={() => handleDigit(String(n))}
              disabled={loading}
              className="flex h-16 items-center justify-center rounded-2xl border border-border-subtle bg-bg-secondary text-xl font-semibold text-text-primary transition hover:bg-bg-elevated active:scale-95 focus-visible:ring-2 focus-visible:ring-accent-purple disabled:opacity-50"
            >
              {n}
            </button>
          ))}
          <div /> {/* empty cell */}
          <button
            onClick={() => handleDigit("0")}
            disabled={loading}
            className="flex h-16 items-center justify-center rounded-2xl border border-border-subtle bg-bg-secondary text-xl font-semibold text-text-primary transition hover:bg-bg-elevated active:scale-95 focus-visible:ring-2 focus-visible:ring-accent-purple disabled:opacity-50"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex h-16 items-center justify-center rounded-2xl border border-border-subtle bg-bg-secondary text-text-secondary transition hover:bg-bg-elevated active:scale-95 focus-visible:ring-2 focus-visible:ring-accent-purple disabled:opacity-50"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
