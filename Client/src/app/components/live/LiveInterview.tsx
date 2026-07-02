"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/app/AuthContext";
import { apiClient } from "@/lib/api-client";
import LoadingSpinner from "@/app/components/common/LoadingSpinner";

// ── Types ────────────────────────────────────────────────────────────────────

type SessionState = "idle" | "connecting" | "active" | "ended";

interface TranscriptMessage {
  role: "user" | "assistant";
  text: string;
  id: string;
}

interface FeedbackScore {
  overall_impression: string;
  strengths: string[];
  areas_for_improvement: string[];
  suggestions: string[];
  score: number;
}

export interface LiveInterviewProps {
  questionSlug: string;
}

// ── Audio conversion helpers ──────────────────────────────────────────────────

/** Float32 PCM → Int16 PCM ArrayBuffer (clamp to [-32768, 32767]) */
function float32ToInt16Buffer(samples: Float32Array): ArrayBuffer {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? s * 32768 : s * 32767;
  }
  return out.buffer;
}

/** Base64 string → ArrayBuffer */
function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

/** Int16 PCM ArrayBuffer → Float32Array */
function int16BufferToFloat32(buf: ArrayBuffer): Float32Array {
  const i16 = new Int16Array(buf);
  const f32 = new Float32Array(i16.length);
  for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 32768.0;
  return f32;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LiveInterview({ questionSlug }: LiveInterviewProps) {
  const { isLoggedIn, token } = useAuth();

  // State machine
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackScore | string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Stable refs — not part of render cycle
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const isMutedRef = useRef(false);
  const nextPlayTimeRef = useRef(0);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Keep muted ref in sync with state (read in ScriptProcessor callback)
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Auto-scroll transcript to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // ── Audio capture / playback ────────────────────────────────────────────────

  const stopAudioCapture = useCallback(() => {
    processorRef.current?.disconnect();
    sourceNodeRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    processorRef.current = null;
    sourceNodeRef.current = null;
    streamRef.current = null;
  }, []);

  const startAudioCapture = useCallback(async (ws: WebSocket) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 24 kHz to match OpenAI Realtime API requirement
      const ctx = new AudioContext({ sampleRate: 24000 });
      audioCtxRef.current = ctx;
      nextPlayTimeRef.current = ctx.currentTime;

      const source = ctx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      // ScriptProcessorNode is deprecated but universally supported
      // bufferSize 4096 ≈ 170 ms at 24 kHz — acceptable capture latency
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (isMutedRef.current || ws.readyState !== WebSocket.OPEN) return;
        const samples = e.inputBuffer.getChannelData(0);
        ws.send(float32ToInt16Buffer(samples));
      };

      // Must connect to destination for ScriptProcessorNode to fire
      source.connect(processor);
      processor.connect(ctx.destination);
    } catch {
      setErrorMsg("Microphone access denied. Please allow microphone access and try again.");
      setSessionState("ended");
    }
  }, []);

  /** Queue a PCM16 delta chunk (base64) for gapless playback */
  const playAudioChunk = useCallback((base64Delta: string) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const f32 = int16BufferToFloat32(base64ToArrayBuffer(base64Delta));
    const buf = ctx.createBuffer(1, f32.length, 24000);
    buf.copyToChannel(f32, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    const now = ctx.currentTime;
    const start = Math.max(now, nextPlayTimeRef.current);
    src.start(start);
    nextPlayTimeRef.current = start + buf.duration;
  }, []);

  // Start capturing mic when session goes active
  useEffect(() => {
    if (sessionState !== "active" || !wsRef.current) return;
    startAudioCapture(wsRef.current);
  }, [sessionState, startAudioCapture]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudioCapture();
      wsRef.current?.close();
      audioCtxRef.current?.close();
    };
  }, [stopAudioCapture]);

  // ── SSE feedback listener ───────────────────────────────────────────────────

  const listenForFeedback = useCallback(async (sid: string, authToken: string) => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    try {
      const res = await fetch(`${base}/api/interviews/${sid}/stream`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        for (const line of dec.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.type === "feedback") {
              const r = await apiClient.get(`/api/interviews/${sid}/feedback`);
              setFeedback(r.data.interview?.feedback ?? null);
              reader.cancel();
              return;
            }
          } catch {
            /* ignore malformed SSE lines */
          }
        }
      }
    } catch {
      /* SSE failed — the "ended" message still shows */
    }
  }, []);

  // ── WebSocket message handler ───────────────────────────────────────────────

  const onMessage = useCallback(
    (event: MessageEvent) => {
      // Ignore binary frames
      if (event.data instanceof ArrayBuffer || event.data instanceof Blob) return;

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }

      switch (msg.type as string) {
        case "session_created": {
          setSessionId(msg.session_id as string);
          setSessionState("active");
          break;
        }

        case "response.audio.delta": {
          playAudioChunk(msg.delta as string);
          break;
        }

        case "conversation.item.created": {
          const item = msg.item as {
            role: "user" | "assistant";
            id?: string;
            content?: Array<{ type: string; text?: string; transcript?: string }>;
          };
          const text = (item.content ?? [])
            .map((c) => c.text ?? c.transcript ?? "")
            .filter(Boolean)
            .join(" ");
          if (text) {
            setTranscript((prev) => [
              ...prev,
              { role: item.role, text, id: item.id ?? String(Date.now()) },
            ]);
          }
          break;
        }

        case "error": {
          setErrorMsg((msg.detail as string) ?? "An error occurred during the session.");
          break;
        }
      }
    },
    [playAudioChunk]
  );

  // ── Session control ─────────────────────────────────────────────────────────

  const startSession = () => {
    if (!isLoggedIn || !token) {
      setErrorMsg("You must be logged in to start a live interview.");
      return;
    }
    setSessionState("connecting");
    setErrorMsg(null);
    setTranscript([]);
    setFeedback(null);
    setSessionId(null);

    const baseWs = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(
      /^http/,
      "ws"
    );
    const ws = new WebSocket(
      `${baseWs}/api/interviews/live/${questionSlug}?token=${encodeURIComponent(token)}`
    );
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;
    ws.onmessage = onMessage;

    ws.onclose = () => {
      stopAudioCapture();
      setSessionState((prev) => (prev !== "ended" ? "ended" : prev));
    };

    ws.onerror = () => {
      stopAudioCapture();
      setErrorMsg("Connection failed. Please check your network and try again.");
      setSessionState("ended");
    };
  };

  const endSession = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "end_session" }));
      wsRef.current.close();
    }
    stopAudioCapture();
    setSessionState("ended");
    // Capture sessionId from current state before async work
    const currentSid = sessionId;
    if (currentSid && token) {
      listenForFeedback(currentSid, token);
    }
  };

  const resetSession = () => {
    setSessionState("idle");
    setTranscript([]);
    setFeedback(null);
    setSessionId(null);
    setErrorMsg(null);
    setIsMuted(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* ── Session controls ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {sessionState === "idle" && (
          <button
            onClick={startSession}
            className="px-5 py-2 bg-black text-white rounded-lg hover:bg-gray-800 font-medium text-sm"
          >
            Start Live Interview
          </button>
        )}

        {sessionState === "connecting" && (
          <div className="flex items-center gap-3 text-gray-600">
            <LoadingSpinner size="small" />
            <span className="text-sm">Connecting…</span>
          </div>
        )}

        {sessionState === "active" && (
          <>
            <button
              onClick={endSession}
              className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm"
            >
              End Session
            </button>
            <button
              onClick={() => setIsMuted((m) => !m)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                isMuted
                  ? "bg-yellow-100 border-yellow-400 text-yellow-800 hover:bg-yellow-200"
                  : "bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {isMuted ? "Unmute" : "Mute"}
            </button>
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium ml-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          </>
        )}
      </div>

      {/* ── Error banner ── */}
      {errorMsg && (
        <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{errorMsg}</div>
      )}

      {/* ── Ended state ── */}
      {sessionState === "ended" && (
        <div className="flex flex-col gap-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm font-medium">
              Session complete. Feedback will arrive shortly.
            </p>
          </div>

          {feedback ? (
            <div className="bg-blue-50 p-4 rounded-lg space-y-3">
              {typeof feedback === "string" ? (
                <p className="text-gray-700 text-sm whitespace-pre-line">{feedback}</p>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-600">Score</span>
                    <span className="bg-black text-white text-sm font-bold px-3 py-1 rounded-full">
                      {feedback.score} / 10
                    </span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Overall Impression</h4>
                    <p className="text-gray-700 text-sm">{feedback.overall_impression}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Strengths</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {feedback.strengths.map((s, i) => (
                        <li key={i} className="text-gray-700 text-sm">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Areas for Improvement</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {feedback.areas_for_improvement.map((a, i) => (
                        <li key={i} className="text-gray-700 text-sm">
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Suggestions</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {feedback.suggestions.map((s, i) => (
                        <li key={i} className="text-gray-700 text-sm">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <LoadingSpinner size="small" color="gray" />
              <span>Waiting for feedback…</span>
            </div>
          )}

          <button
            onClick={resetSession}
            className="self-start px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm"
          >
            Start New Session
          </button>
        </div>
      )}

      {/* ── Live transcript ── */}
      {transcript.length > 0 && (
        <div className="border border-gray-200 rounded-lg bg-gray-50 p-4 max-h-72 overflow-y-auto flex flex-col gap-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            Conversation
          </p>
          {transcript.map((msg) => (
            <div
              key={msg.id}
              className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                msg.role === "user"
                  ? "self-end bg-black text-white"
                  : "self-start bg-white border border-gray-200 text-gray-800"
              }`}
            >
              <span className="block text-xs opacity-60 mb-0.5 capitalize">{msg.role}</span>
              {msg.text}
            </div>
          ))}
          <div ref={transcriptEndRef} />
        </div>
      )}
    </div>
  );
}
