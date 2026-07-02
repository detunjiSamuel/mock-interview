"use client";
import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AudioRecorder, useAudioRecorder } from "react-audio-voice-recorder";
import { useAuth } from "@/app/AuthContext";
import { apiClient } from "@/lib/api-client";
import LoadingSpinner from "@/app/components/common/LoadingSpinner";
import LiveInterview from "@/app/components/live/LiveInterview";

interface Question {
  id: string;
  topic: string;
  text: string;
  video_url?: string;
  difficulty: string;
  category: string;
  helpful_tip?: string;
  slug: string;
}

interface FeedbackScore {
  overall_impression: string;
  strengths: string[];
  areas_for_improvement: string[];
  suggestions: string[];
  score: number;
}

interface InterviewResult {
  id: string;
  status: string;
  audio_url: string;
  audio_transcript?: string;
  feedback?: FeedbackScore | string;
  question?: Record<string, string>;
}

async function listenForFeedback(
  interviewId: string,
  token: string,
  onFeedback: (data: InterviewResult) => void,
  onError: () => void
) {
  try {
    const res = await fetch(`/backend/api/interviews/${interviewId}/stream`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok || !res.body) { onError(); return; }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      for (const line of text.split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.type === "feedback") {
              const interview = await apiClient.get(`/api/interviews/${interviewId}/feedback`);
              onFeedback(interview.data.interview);
              reader.cancel();
              return;
            }
          } catch { /* ignore malformed lines */ }
        }
      }
    }
  } catch {
    onError();
  }
}

function FeedbackDisplay({ feedback }: { feedback: FeedbackScore | string }) {
  if (typeof feedback === "string") {
    return <div className="whitespace-pre-line text-gray-700">{feedback}</div>;
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-sm font-medium text-gray-600">Score</span>
        <span className="inline-block bg-black text-white text-sm font-bold px-3 py-1 rounded-full">
          {feedback.score} / 10
        </span>
      </div>
      <div>
        <h4 className="font-semibold mb-1">Overall Impression</h4>
        <p className="text-gray-700 text-sm">{feedback.overall_impression}</p>
      </div>
      <div>
        <h4 className="font-semibold mb-1">Strengths</h4>
        <ul className="list-disc list-inside space-y-1">
          {feedback.strengths.map((s, i) => (
            <li key={i} className="text-gray-700 text-sm">{s}</li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="font-semibold mb-1">Areas for Improvement</h4>
        <ul className="list-disc list-inside space-y-1">
          {feedback.areas_for_improvement.map((a, i) => (
            <li key={i} className="text-gray-700 text-sm">{a}</li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="font-semibold mb-1">Suggestions</h4>
        <ul className="list-disc list-inside space-y-1">
          {feedback.suggestions.map((s, i) => (
            <li key={i} className="text-gray-700 text-sm">{s}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function QuestionDetailPage() {
  const { isLoggedIn, token } = useAuth();
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [mode, setMode] = useState<"async" | "live">("async");
  const [audioUrl, setAudioUrl] = useState("");
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<InterviewResult | null>(null);
  const [waitingForFeedback, setWaitingForFeedback] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const recorderControls = useAudioRecorder();

  const { data: question, isLoading, isError } = useQuery<Question>({
    queryKey: ["question", slug],
    queryFn: () => apiClient.get(`/api/questions/${slug}`).then((r) => r.data),
  });


  const handleAudioComplete = (blob: Blob) => {
    setRecordingBlob(blob);
    setAudioUrl(URL.createObjectURL(blob));
  };

  const handleRedo = () => {
    setAudioUrl("");
    setRecordingBlob(null);
    if (audioRef.current) audioRef.current.src = "";
  };

  const handleSubmit = async () => {
    if (!isLoggedIn) { router.push("/auth/login"); return; }
    if (!recordingBlob) { setSubmitError("No recording found."); return; }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const form = new FormData();
      form.append("audio_response", recordingBlob, "recording.webm");
      form.append("question_id", slug);

      const { data } = await apiClient.post("/api/interviews/submit-recording", form);
      setWaitingForFeedback(true);

      listenForFeedback(
        data.interview,
        token!,
        (interview) => { setResult(interview); setWaitingForFeedback(false); },
        () => setWaitingForFeedback(false)
      );
    } catch {
      setSubmitError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="flex flex-col md:flex-row min-h-screen p-6 gap-8">
        <section className="md:w-2/5 bg-white rounded-lg shadow-lg p-6 h-fit space-y-4">
          <div className="h-6 bg-gray-200 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-full" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-5/6" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
        </section>
        <section className="md:w-3/5 bg-white rounded-lg shadow-lg p-6 flex items-center justify-center">
          <LoadingSpinner size="large" />
        </section>
      </main>
    );
  }

  if (isError || !question) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="bg-red-100 text-red-700 p-4 rounded-lg">Question not found.</div>
        <button onClick={() => router.push("/")} className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800">
          Back to Questions
        </button>
      </div>
    );
  }

  return (
    <main className="flex flex-col md:flex-row min-h-screen p-6 gap-8">
      {/* Question panel */}
      <section className="md:w-2/5 bg-white rounded-lg shadow-lg p-6 h-fit">
        {question.video_url && (
          <video src={question.video_url} controls className="w-full rounded-lg mb-6" />
        )}
        <div className="flex justify-between items-center mb-4">
          <h1 className="font-mono text-xl font-bold">{question.topic}</h1>
          <div className="flex gap-2">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs capitalize">
              {question.difficulty}
            </span>
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs capitalize">
              {question.category}
            </span>
          </div>
        </div>
        <div className="mb-4">
          <h2 className="font-semibold mb-1">Question:</h2>
          <p className="text-gray-700">{question.text}</p>
        </div>
        {question.helpful_tip && (
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <h2 className="font-semibold mb-1 text-sm">Helpful Tip:</h2>
            <p className="text-gray-700 text-sm">{question.helpful_tip}</p>
          </div>
        )}
      </section>

      {/* Recording / feedback panel */}
      <section className="md:w-3/5 flex flex-col gap-4">
        <button onClick={() => router.push("/")} className="self-start text-blue-600 hover:underline text-sm">
          ← Back to Questions
        </button>

        {/* Mode selector */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg self-start">
          <button
            onClick={() => setMode("async")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === "async"
                ? "bg-white text-black shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Practice (Async)
          </button>
          <button
            onClick={() => setMode("live")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === "live"
                ? "bg-white text-black shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Live Interview
          </button>
        </div>

        {mode === "live" ? (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="font-mono text-xl font-bold mb-6">Live Interview</h2>
            <p className="text-gray-600 text-sm mb-6">
              Speak directly with an AI interviewer in real time. Your answer will be evaluated and
              feedback will be delivered once the session ends.
            </p>
            <LiveInterview questionSlug={slug} />
          </div>
        ) : result ? (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="font-mono text-xl font-bold mb-4">Feedback</h2>
            {result.audio_transcript && (
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h3 className="font-medium mb-2 text-sm">Your Answer (transcript):</h3>
                <p className="text-gray-700 text-sm">{result.audio_transcript}</p>
              </div>
            )}
            <div className="bg-blue-50 p-4 rounded-lg">
              {result.feedback ? (
                <FeedbackDisplay feedback={result.feedback} />
              ) : (
                <p className="text-gray-600 text-sm">No feedback yet.</p>
              )}
            </div>
            <button
              onClick={() => { setResult(null); setAudioUrl(""); }}
              className="mt-4 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm"
            >
              Record another answer
            </button>
          </div>
        ) : waitingForFeedback ? (
          <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col items-center gap-4">
            <p className="text-gray-700 font-medium">Generating feedback…</p>
            <p className="text-gray-500 text-sm">This usually takes 20–40 seconds.</p>
            <LoadingSpinner />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col items-center">
            <h2 className="font-mono text-xl font-bold mb-6 text-center">
              {audioUrl ? "Review Your Answer" : "Record Your Answer"}
            </h2>

            {!isLoggedIn && (
              <div className="bg-yellow-100 text-yellow-800 p-4 rounded-lg mb-6 w-full text-sm">
                Please{" "}
                <a href="/auth/login" className="underline">
                  log in
                </a>{" "}
                to submit your recording and receive feedback.
              </div>
            )}

            {submitError && (
              <div className="mb-4 p-3 text-sm text-red-700 bg-red-100 rounded w-full">{submitError}</div>
            )}

            <div className="w-full max-w-lg mb-6">
              {audioUrl ? (
                <div className="flex flex-col items-center">
                  <audio ref={audioRef} src={audioUrl} controls className="w-full mb-3" />
                  <p className="text-gray-600 text-center text-sm">
                    Listen back, then submit for feedback or re-record.
                  </p>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center">
                  <AudioRecorder
                    onRecordingComplete={handleAudioComplete}
                    recorderControls={recorderControls}
                    audioTrackConstraints={{ noiseSuppression: true, echoCancellation: true }}
                    downloadOnSavePress={false}
                    showVisualizer={true}
                  />
                  {!recorderControls.isRecording && (
                    <p className="text-gray-500 mt-4 text-sm text-center">
                      Click the microphone to start recording
                    </p>
                  )}
                </div>
              )}
            </div>

            {audioUrl && (
              <div className="flex gap-3">
                <button
                  onClick={handleRedo}
                  disabled={submitting}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50"
                >
                  Re-record
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting && <LoadingSpinner size="small" color="white" />}
                  {submitting ? "Submitting…" : "Submit for Feedback"}
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
