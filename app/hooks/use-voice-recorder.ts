"use client";

import { useCallback, useRef, useState } from "react";

export type RecorderState = "idle" | "requesting" | "recording" | "processing";
export type RecorderError =
  | "not-supported"
  | "needs-https"
  | "permission-denied"
  | "recording-failed"
  | null;

export interface UseVoiceRecorderReturn {
  state: RecorderState;
  error: RecorderError;
  duration: number;
  volumeRef: React.RefObject<number>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  cancelRecording: () => void;
}

const MAX_DURATION_MS = 60_000;
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4",
];

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const mime of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch { /* */ }
  }
  return "";
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<RecorderError>(null);
  const [duration, setDuration] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef(0);
  const resolveRef = useRef<((blob: Blob | null) => void) | null>(null);
  const mimeRef = useRef<string>("");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const volumeRef = useRef(0);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (scriptNodeRef.current) {
      scriptNodeRef.current.onaudioprocess = null;
      scriptNodeRef.current.disconnect();
      scriptNodeRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
    volumeRef.current = 0;
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);

    if (typeof window === "undefined") {
      setError("not-supported");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      const isSecure = window.isSecureContext ?? location.protocol === "https:";
      setError(isSecure ? "not-supported" : "needs-https");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setError("not-supported");
      return;
    }

    const mime = pickMime();
    if (mime === undefined) {
      setError("not-supported");
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    let audioCtx: AudioContext | null = null;
    try {
      audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      audioCtx.resume().catch(() => {});
    } catch {
      audioCtx = null;
    }

    setState("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const opts: MediaRecorderOptions = mime ? { mimeType: mime } : {};
      const recorder = new MediaRecorder(stream, opts);
      recorderRef.current = recorder;
      mimeRef.current = recorder.mimeType || mime || "audio/webm";
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        if (resolveRef.current) {
          resolveRef.current(blob);
          resolveRef.current = null;
        }
        cleanup();
        setState("idle");
      };

      recorder.onerror = () => {
        setError("recording-failed");
        setState("idle");
        if (resolveRef.current) {
          resolveRef.current(null);
          resolveRef.current = null;
        }
        cleanup();
      };

      // Start audio level monitor via ScriptProcessorNode
      if (audioCtx) {
        try {
          const source = audioCtx.createMediaStreamSource(stream);
          const processor = audioCtx.createScriptProcessor(2048, 1, 1);
          scriptNodeRef.current = processor;
          processor.onaudioprocess = (e) => {
            const buf = e.inputBuffer.getChannelData(0);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
            const rms = Math.sqrt(sum / buf.length);
            volumeRef.current = Math.max(rms, volumeRef.current * 0.85);
          };
          source.connect(processor);
          processor.connect(audioCtx.destination);
        } catch { /* Web Audio unavailable */ }
      }

      recorder.start(250);
      startTimeRef.current = Date.now();
      setDuration(0);
      setState("recording");

      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 250);

      maxTimerRef.current = setTimeout(() => {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        }
      }, MAX_DURATION_MS);
    } catch (err: unknown) {
      cleanup();
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("permission-denied");
      } else {
        setError("recording-failed");
      }
      setState("idle");
    }
  }, [cleanup]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (!recorderRef.current || recorderRef.current.state !== "recording") {
      return null;
    }

    const elapsed = Date.now() - startTimeRef.current;
    if (elapsed < 800) {
      if (recorderRef.current.state === "recording") {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      cleanup();
      setState("idle");
      setDuration(0);
      return null;
    }

    return new Promise<Blob | null>((resolve) => {
      resolveRef.current = resolve;
      setState("processing");
      recorderRef.current!.stop();
    });
  }, [cleanup]);

  const cancelRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    if (resolveRef.current) {
      resolveRef.current(null);
      resolveRef.current = null;
    }
    cleanup();
    setState("idle");
    setDuration(0);
  }, [cleanup]);

  return { state, error, duration, volumeRef, startRecording, stopRecording, cancelRecording };
}
