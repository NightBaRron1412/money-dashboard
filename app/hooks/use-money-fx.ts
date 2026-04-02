"use client";

import { useCallback, useEffect, useState } from "react";
import type { FxRates } from "@/lib/money/fx";
import { DEFAULT_FX } from "@/lib/money/fx";

const CACHE_KEY = "money:fx-rates";

function loadCachedRates(): FxRates {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const { rates, ts } = JSON.parse(raw);
      if (Date.now() - ts < 60 * 60 * 1000 && rates?.USDCAD > 0 && rates?.USDEGP > 0) {
        return rates;
      }
    }
  } catch {}
  return DEFAULT_FX;
}

function saveCachedRates(rates: FxRates) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rates, ts: Date.now() }));
  } catch {}
}

export function useMoneyFx() {
  const [fx, setFx] = useState<FxRates>(DEFAULT_FX);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stocks?symbols=USDCAD=X,USDEGP=X");
      const data = await res.json();
      const USDCAD = data?.results?.["USDCAD=X"]?.price;
      const USDEGP = data?.results?.["USDEGP=X"]?.price;
      if (Number.isFinite(USDCAD) && USDCAD > 0 && Number.isFinite(USDEGP) && USDEGP > 0) {
        const rates = { USDCAD, USDEGP };
        setFx(rates);
        saveCachedRates(rates);
      }
    } catch {
      // keep current rates
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, []);

  useEffect(() => {
    const cached = loadCachedRates();
    if (cached.USDCAD !== 1 || cached.USDEGP !== 1) {
      setFx(cached);
      setReady(true);
    }
    refresh();
    const id = setInterval(refresh, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [refresh]);

  return { fx, loading, ready, refresh };
}
