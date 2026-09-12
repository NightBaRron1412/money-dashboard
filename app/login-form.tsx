"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "./auth-provider";
import { Lock, KeyRound, Delete, Loader2, CircleDollarSign, ShieldCheck } from "lucide-react";

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

  const title = isSetupMode ? "Secure your dashboard" : "Welcome back";
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
    <div className="flex min-h-screen items-center justify-center bg-bg-main p-4 sm:p-8">
      <div className="money-surface grid w-full max-w-4xl overflow-hidden lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative hidden min-h-[640px] flex-col justify-between overflow-hidden bg-text-primary p-10 text-bg-main lg:flex">
          <div className="relative z-10 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-bg-main text-text-primary">
              <CircleDollarSign className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-semibold tracking-[-0.03em]">Money</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-55">Personal finance</p>
            </div>
          </div>
          <div className="relative z-10">
            <p className="max-w-sm text-4xl font-semibold leading-[1.05] tracking-[-0.06em]">A clearer view of your money.</p>
            <p className="mt-5 max-w-sm text-sm leading-6 opacity-60">Accounts, spending, investments, and goals—organized around the decisions that matter.</p>
          </div>
          <div className="relative z-10 flex items-center gap-2 text-xs font-medium opacity-65">
            <ShieldCheck className="h-4 w-4" /> Your financial dashboard is PIN protected
          </div>
          <div className="pointer-events-none absolute -bottom-40 -right-32 h-96 w-96 rounded-full border-[70px] border-bg-main/5" />
        </div>

        <div className="flex min-h-[600px] items-center p-7 sm:p-12">
          <div className="mx-auto w-full max-w-xs">
            <div className="mb-8">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-bg-elevated text-accent-purple lg:hidden">
                <CircleDollarSign className="h-6 w-6" />
              </div>
              <div className="mb-5 hidden h-11 w-11 items-center justify-center rounded-full bg-bg-elevated text-accent-purple lg:flex">
                <Icon className="h-5 w-5" />
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.05em] text-text-primary">{title}</h1>
              <p className="mt-2 text-sm text-text-secondary">{subtitle}</p>
            </div>

            <div
              className={`mb-8 flex items-center gap-3 ${shake ? "animate-shake" : ""}`}
              aria-label={`${currentPin.length} of ${PIN_LENGTH} PIN digits entered`}
            >
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <div
                  key={i}
                  className={`h-3 w-3 rounded-full border transition-all duration-200 ${
                    i < currentPin.length
                      ? "scale-110 border-accent-purple bg-accent-purple"
                      : "border-border-subtle bg-bg-elevated"
                  }`}
                />
              ))}
            </div>

            {error && (
              <p className="mb-4 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-medium text-red-500">{error}</p>
            )}

            {loading && (
              <div className="mb-4 flex items-center gap-2 text-xs font-medium text-text-secondary">
                <Loader2 className="h-4 w-4 animate-spin text-accent-purple" /> Checking PIN…
              </div>
            )}

            <div className="grid grid-cols-3 gap-2.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button
                  key={n}
                  onClick={() => handleDigit(String(n))}
                  disabled={loading}
                  aria-label={`Enter ${n}`}
                  className="flex h-14 items-center justify-center rounded-2xl border border-border-subtle bg-[var(--card-bg)] text-lg font-semibold text-text-primary transition hover:-translate-y-0.5 hover:bg-bg-elevated active:scale-95 disabled:opacity-50"
                >
                  {n}
                </button>
              ))}
              <div />
              <button
                onClick={() => handleDigit("0")}
                disabled={loading}
                aria-label="Enter 0"
                className="flex h-14 items-center justify-center rounded-2xl border border-border-subtle bg-[var(--card-bg)] text-lg font-semibold text-text-primary transition hover:-translate-y-0.5 hover:bg-bg-elevated active:scale-95 disabled:opacity-50"
              >
                0
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                aria-label="Delete last digit"
                className="flex h-14 items-center justify-center rounded-2xl border border-border-subtle bg-[var(--card-bg)] text-text-secondary transition hover:-translate-y-0.5 hover:bg-bg-elevated hover:text-text-primary active:scale-95 disabled:opacity-50"
              >
                <Delete className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
