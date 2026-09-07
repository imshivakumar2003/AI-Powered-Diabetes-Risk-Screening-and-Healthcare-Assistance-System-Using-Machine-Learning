import { useState, useEffect, useRef } from "react";
import MarkdownLite from "./MarkdownLite.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { textToSpeechApi } from "../../services/api.js";
import {
  BrainCircuit,
  User,
  Volume2,
  Pause,
  Square,
  Copy,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Check,
  Loader2,
} from "lucide-react";

const LANG_VOICE_MAP = {
  en: "en-US",
  hi: "hi-IN",
  kn: "kn-IN",
  ta: "ta-IN",
  te: "te-IN",
};

export default function ChatMessage({ message, onRegenerate, isLast, regenerating }) {
  const { showToast } = useToast();
  const { language } = useLanguage() || {};
  const currentLang = language || "en";
  const isUser = message.role === "user";

  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState(null); // 'like' | 'dislike' | null
  const [ttsStatus, setTtsStatus] = useState("stopped"); // 'stopped' | 'loading' | 'playing' | 'paused'
  const [engineUsed, setEngineUsed] = useState("api"); // 'api' | 'synth'

  const audioRef = useRef(null);
  const audioCacheRef = useRef({}); // Cache generated audio URLs for instant re-play

  // Global listener: Stop playback if another message starts speaking
  useEffect(() => {
    const handleGlobalTtsPlay = (e) => {
      if (e.detail?.messageId !== message.id && ttsStatus !== "stopped") {
        stopAllAudio();
        setTtsStatus("stopped");
      }
    };

    window.addEventListener("tts-play", handleGlobalTtsPlay);
    return () => window.removeEventListener("tts-play", handleGlobalTtsPlay);
  }, [message.id, ttsStatus]);

  // Clean up audio & speech synthesis on unmount
  useEffect(() => {
    return () => {
      stopAllAudio();
      Object.values(audioCacheRef.current).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
    };
  }, []);

  const stopAllAudio = () => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {}
    }
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.message);
      setCopied(true);
      showToast("Response copied to clipboard.", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Could not copy response.", "error");
    }
  };

  const getBestBrowserVoice = (langTag) => {
    if (!("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const langPrefix = langTag.split("-")[0];
    const matchingVoices = voices.filter(
      (v) => v.lang === langTag || v.lang.startsWith(langPrefix) || v.lang.replace("_", "-") === langTag
    );
    const pool = matchingVoices.length > 0 ? matchingVoices : voices;
    return pool.find((v) => v.name.toLowerCase().includes("google") || v.name.toLowerCase().includes("natural")) || pool[0];
  };

  const fallbackNativeSpeech = () => {
    if (!("speechSynthesis" in window)) {
      showToast("Text-to-speech is not supported in this browser.", "error");
      setTtsStatus("stopped");
      return;
    }

    setEngineUsed("synth");
    const synth = window.speechSynthesis;
    synth.cancel();

    const cleanText = message.message.replace(/[*#`_-]/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);

    const targetLang = LANG_VOICE_MAP[currentLang] || "en-US";
    utterance.lang = targetLang;

    const voice = getBestBrowserVoice(targetLang);
    if (voice) utterance.voice = voice;

    utterance.onend = () => setTtsStatus("stopped");
    utterance.onerror = () => setTtsStatus("stopped");

    setTtsStatus("playing");
    synth.speak(utterance);
  };

  const handleSpeakToggle = async () => {
    // If playing, pause
    if (ttsStatus === "playing") {
      if (engineUsed === "api" && audioRef.current) {
        audioRef.current.pause();
      } else if (engineUsed === "synth" && "speechSynthesis" in window) {
        window.speechSynthesis.pause();
      }
      setTtsStatus("paused");
      return;
    }

    // If paused, resume
    if (ttsStatus === "paused") {
      window.dispatchEvent(new CustomEvent("tts-play", { detail: { messageId: message.id } }));
      if (engineUsed === "api" && audioRef.current) {
        try {
          await audioRef.current.play();
          setTtsStatus("playing");
          return;
        } catch {}
      } else if (engineUsed === "synth" && "speechSynthesis" in window) {
        window.speechSynthesis.resume();
        setTtsStatus("playing");
        return;
      }
    }

    // Dispatch global play event to stop other messages
    window.dispatchEvent(new CustomEvent("tts-play", { detail: { messageId: message.id } }));

    // Check cache for instant playback
    const cachedUrl = audioCacheRef.current[currentLang];
    if (cachedUrl) {
      setEngineUsed("api");
      playAudioFromUrl(cachedUrl);
      return;
    }

    // Fetch synthesized audio from backend AI TTS service
    setTtsStatus("loading");
    try {
      const audioBlob = await textToSpeechApi.generateAudio(message.message, currentLang);
      if (!audioBlob || audioBlob.size === 0) {
        fallbackNativeSpeech();
        return;
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      audioCacheRef.current[currentLang] = audioUrl;
      setEngineUsed("api");
      playAudioFromUrl(audioUrl);
    } catch (err) {
      // Fallback seamlessly to native browser speech synthesis on network drop
      console.warn("[TTS] AI TTS API call failed. Falling back to native browser SpeechSynthesis.");
      fallbackNativeSpeech();
    }
  };

  const playAudioFromUrl = (url) => {
    stopAllAudio();

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onended = () => {
      setTtsStatus("stopped");
    };

    audio.onerror = () => {
      fallbackNativeSpeech();
    };

    audio
      .play()
      .then(() => {
        setTtsStatus("playing");
      })
      .catch(() => {
        fallbackNativeSpeech();
      });
  };

  const handleStopSpeak = () => {
    stopAllAudio();
    setTtsStatus("stopped");
  };

  const handleRating = (type) => {
    const newRating = rating === type ? null : type;
    setRating(newRating);
    if (newRating) {
      showToast(newRating === "like" ? "Feedback recorded! Thank you." : "Feedback recorded.", "info");
    }
  };

  const formattedTime = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div
      className={`chat-bubble-row ${isUser ? "user" : "assistant"}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, fontSize: 11, color: "var(--text-faint)" }}>
        {isUser ? (
          <>
            <span>{formattedTime}</span>
            <span style={{ fontWeight: 600, color: "var(--ink)" }}>You</span>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--teal)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <User size={13} />
            </div>
          </>
        ) : (
          <>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--surface-subtle)", border: "1px solid var(--border)", color: "var(--teal)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BrainCircuit size={13} />
            </div>
            <span style={{ fontWeight: 600, color: "var(--teal)" }}>Diabetes AI</span>
            {ttsStatus !== "stopped" && (
              <span style={{ fontSize: 11, color: "var(--teal)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                {ttsStatus === "loading" ? (
                  <Loader2 size={12} className="spin" />
                ) : (
                  <Volume2 size={12} className="pulse" />
                )}
                {ttsStatus === "loading" ? "Generating Audio..." : ttsStatus === "playing" ? "Speaking..." : "Paused"}
              </span>
            )}
            <span>{formattedTime}</span>
          </>
        )}
      </div>

      <div
        className={`chat-bubble ${isUser ? "user" : "assistant"}`}
        style={{
          border: ttsStatus !== "stopped" && !isUser ? "2px solid var(--teal)" : undefined,
          boxShadow: ttsStatus !== "stopped" && !isUser ? "0 0 12px rgba(13, 148, 136, 0.3)" : undefined,
          transition: "all 0.2s ease",
        }}
      >
        {isUser ? <span>{message.message}</span> : <MarkdownLite text={message.message} />}
        {!isUser && (
          <div
            style={{
              marginTop: 10,
              padding: "6px 10px",
              borderRadius: 8,
              background: "rgba(13, 148, 136, 0.06)",
              border: "1px solid rgba(13, 148, 136, 0.15)",
              fontSize: 11,
              color: "var(--text-muted)",
              lineHeight: 1.4,
            }}
          >
            ⚠️ <i>This information is for general health guidance and is not a substitute for professional medical advice.</i>
          </div>
        )}
      </div>

      {!isUser && (
        <div
          className="chat-bubble-actions"
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 8,
            padding: "6px 12px",
            borderRadius: 12,
            background: "var(--surface-subtle)",
            border: "1px solid var(--border)",
            width: "fit-content",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.02)",
          }}
        >
          {/* AI TTS Play / Pause Speaker Button */}
          <button
            className="chat-action-btn"
            onClick={() => {
              if (ttsStatus === "stopped") showToast("Reading aloud...", "info");
              handleSpeakToggle();
            }}
            disabled={ttsStatus === "loading"}
            aria-label={ttsStatus === "playing" ? "Pause speech" : ttsStatus === "paused" ? "Resume speech" : "Read AI response aloud"}
            title={ttsStatus === "playing" ? "Pause speech" : ttsStatus === "paused" ? "Resume speech" : "Read AI response aloud"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: ttsStatus !== "stopped" ? "rgba(13, 148, 136, 0.12)" : "var(--paper)",
              color: ttsStatus !== "stopped" ? "var(--teal)" : "var(--ink)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {ttsStatus === "loading" ? (
              <Loader2 size={13} className="spin" />
            ) : ttsStatus === "playing" ? (
              <Pause size={13} />
            ) : (
              <Volume2 size={13} />
            )}
            {ttsStatus === "loading"
              ? "Loading..."
              : ttsStatus === "playing"
              ? "Pause"
              : ttsStatus === "paused"
              ? "Resume"
              : "Read Aloud"}
          </button>

          {ttsStatus !== "stopped" && ttsStatus !== "loading" && (
            <button
              className="chat-action-btn"
              onClick={handleStopSpeak}
              title="Stop speech"
              aria-label="Stop speech"
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--paper)", color: "var(--ink)", cursor: "pointer" }}
            >
              <Square size={12} />
            </button>
          )}

          {/* Copy Response */}
          <button
            className="chat-action-btn"
            onClick={handleCopy}
            title="Copy response"
            aria-label="Copy response"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--paper)",
              color: copied ? "var(--teal)" : "var(--ink)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {copied ? <Check size={13} color="var(--teal)" /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>

          {/* Like / Dislike Rating */}
          <button
            className="chat-action-btn"
            onClick={() => handleRating("like")}
            title="Helpful"
            aria-label="Helpful"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: rating === "like" ? "rgba(13, 148, 136, 0.12)" : "var(--paper)",
              color: rating === "like" ? "var(--teal)" : "var(--ink)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <ThumbsUp size={13} />
            <span>Helpful</span>
          </button>

          <button
            className="chat-action-btn"
            onClick={() => handleRating("dislike")}
            title="Not helpful"
            aria-label="Not helpful"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: rating === "dislike" ? "rgba(220, 38, 38, 0.12)" : "var(--paper)",
              color: rating === "dislike" ? "var(--crimson)" : "var(--ink)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <ThumbsDown size={13} />
          </button>

          {/* Regenerate if last message */}
          {isLast && (
            <button
              className="chat-action-btn"
              onClick={() => {
                showToast("Response regenerated", "info");
                onRegenerate();
              }}
              disabled={regenerating}
              title="Regenerate response"
              aria-label="Regenerate response"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--paper)",
                color: "var(--ink)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <RotateCcw size={13} />
              {regenerating ? "Regenerating…" : "Regenerate"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
