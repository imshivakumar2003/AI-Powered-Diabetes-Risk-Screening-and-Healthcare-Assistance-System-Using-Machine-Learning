/**
 * speechService.js
 * ----------------
 * Pure MediaRecorder + Groq Whisper API Speech-to-Text Service.
 * Completely removes browser Web Speech API (SpeechRecognition) dependencies.
 */

import { speechToTextApi } from "./api.js";

export const speechService = {
  /**
   * Detects whether MediaRecorder & mediaDevices audio capture are supported.
   */
  isSupported() {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof MediaRecorder !== "undefined");
  },

  /**
   * Detects whether internet connectivity is active.
   */
  isOnline() {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine !== false;
  },

  getLangTag(langCode) {
    const LANG_BCP47 = {
      en: "en-US",
      hi: "hi-IN",
      kn: "kn-IN",
      ta: "ta-IN",
      te: "te-IN",
    };
    return LANG_BCP47[langCode] || (typeof navigator !== "undefined" ? navigator.language : "en-US");
  },

  /**
   * Requests microphone access explicitly.
   */
  async requestMicrophonePermission() {
    if (!this.isSupported()) {
      throw new Error("AUDIO_CAPTURE_UNSUPPORTED");
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (err) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        throw new Error("NOT_ALLOWED");
      }
      if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        throw new Error("AUDIO_CAPTURE");
      }
      throw err;
    }
  },

  getFriendlyErrorMessage(errorCode) {
    switch (errorCode) {
      case "OFFLINE":
        return "No internet connection. Please connect to the internet and try again.";
      case "NOT_ALLOWED":
      case "not-allowed":
        return "Microphone permission denied. Please grant microphone access in browser settings.";
      case "AUDIO_CAPTURE":
      case "audio-capture":
      case "AUDIO_CAPTURE_UNSUPPORTED":
        return "No microphone device detected. Please connect a working microphone.";
      case "EMPTY_RECORDING":
        return "Recording was empty. Please speak clearly into your microphone.";
      case "UPLOAD_FAILED":
        return "Upload failed. Could not send audio to transcription server.";
      case "GROQ_API_FAILED":
        return "Groq Whisper API transcription failed. Please try again.";
      case "BROWSER_UNSUPPORTED":
        return "Audio recording is not supported in this browser. Please use Google Chrome or Microsoft Edge.";
      default:
        return "Voice input encountered an error. Please try again or type your query.";
    }
  },

  /**
   * Starts a MediaRecorder audio session and sends recording to Groq Whisper.
   */
  async startRecordingSession({ langCode = "en", onStart, onUploading, onTranscribing, onResult, onError, onEnd }) {
    if (!this.isSupported()) {
      onError?.(this.getFriendlyErrorMessage("BROWSER_UNSUPPORTED"), "BROWSER_UNSUPPORTED");
      onEnd?.();
      return null;
    }

    if (!this.isOnline()) {
      onError?.(this.getFriendlyErrorMessage("OFFLINE"), "OFFLINE");
      onEnd?.();
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = MediaRecorder.isTypeSupported("audio/webm")
        ? { mimeType: "audio/webm" }
        : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? { mimeType: "audio/ogg;codecs=opus" }
        : {};

      const mediaRecorder = new MediaRecorder(stream, options);
      const audioChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunks.push(e.data);
        }
      };

      mediaRecorder.onstart = () => {
        onStart?.();
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        if (audioChunks.length === 0) {
          onError?.(this.getFriendlyErrorMessage("EMPTY_RECORDING"), "EMPTY_RECORDING");
          onEnd?.();
          return;
        }

        const mimeType = mediaRecorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunks, { type: mimeType });

        if (audioBlob.size === 0) {
          onError?.(this.getFriendlyErrorMessage("EMPTY_RECORDING"), "EMPTY_RECORDING");
          onEnd?.();
          return;
        }

        try {
          onUploading?.();
          onTranscribing?.();

          const res = await speechToTextApi.transcribe(audioBlob, langCode);

          const transcriptText = res?.text || res?.transcript || "";

          if (transcriptText.trim()) {
            onResult?.(transcriptText.trim());
          } else {
            onError?.(this.getFriendlyErrorMessage("EMPTY_RECORDING"), "EMPTY_RECORDING");
          }
        } catch {
          onError?.(this.getFriendlyErrorMessage("GROQ_API_FAILED"), "GROQ_API_FAILED");
        } finally {
          onEnd?.();
        }
      };

      mediaRecorder.start();
      return mediaRecorder;
    } catch (err) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        onError?.(this.getFriendlyErrorMessage("NOT_ALLOWED"), "NOT_ALLOWED");
      } else {
        onError?.(this.getFriendlyErrorMessage("AUDIO_CAPTURE"), "AUDIO_CAPTURE");
      }
      onEnd?.();
      return null;
    }
  },
};
