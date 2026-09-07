import { useEffect, useRef, useState } from "react";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import Loading from "../components/common/Loading.jsx";
import ChatSessionList from "../components/chat/ChatSessionList.jsx";
import ChatMessage from "../components/chat/ChatMessage.jsx";
import ChatComposer from "../components/chat/ChatComposer.jsx";
import { chatApi, downloadWithAuth } from "../services/api.js";
import { useToast } from "../context/ToastContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { Bot, Sparkles, RefreshCw, Menu, X, Plus, AlertCircle } from "lucide-react";

function TypingIndicator() {
  return (
    <div className="chat-bubble-row assistant">
      <div className="chat-bubble assistant typing" style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 18px" }}>
        <span style={{ fontSize: 13, color: "var(--teal)", fontWeight: 600 }}>AI is thinking...</span>
        <div style={{ display: "flex", gap: 4 }}>
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </div>
  );
}

const WELCOME_QUESTIONS_BY_LANG = {
  en: [
    { title: "What is diabetes?", desc: "Learn the basics, causes, and types of diabetes." },
    { title: "How can I control my blood sugar?", desc: "Actionable tips to maintain optimal blood glucose levels." },
    { title: "What foods should I eat?", desc: "Discover low-glycemic foods and fiber-rich meals." },
    { title: "What should I avoid eating?", desc: "Identify sugary drinks, refined carbs, and processed snacks." },
    { title: "How much water should I drink?", desc: "Learn daily hydration targets for diabetes management." },
    { title: "How can I reduce my diabetes risk?", desc: "Lifestyle modifications to lower diabetes probability." },
  ],
  hi: [
    { title: "डायबिटीज क्या है?", desc: "डायबिटीज के कारण और प्रकारों के बारे में जानें।" },
    { title: "ब्लड शुगर कैसे कंट्रोल करें?", desc: "ब्लड ग्लूकोज को कंट्रोल में रखने के आसान टिप्स।" },
    { title: "मुझे क्या खाना चाहिए?", desc: "कम ग्लाइसेमिक और फाइबर से भरपूर भोजन खोजें।" },
    { title: "किन चीजों से बचना चाहिए?", desc: "मीठे पेय और रिफाइंड कार्ब्स से बचें।" },
    { title: "कितना पानी पीना चाहिए?", desc: "डायबिटीज नियंत्रण के लिए पानी पीने का लक्ष्य।" },
    { title: "डायबिटीज का जोखिम कैसे कम करें?", desc: "जोखिम को कम करने के लाइफस्टाइल बदलाव।" },
  ],
  kn: [
    { title: "ಮಧುಮೇಹ ಎಂದರೇನು?", desc: "ಮಧುಮೇಹದ ಮೂಲಭೂತ ವಿಷಯಗಳು ಮತ್ತು ಕಾರಣಗಳನ್ನು ತಿಳಿಯಿರಿ." },
    { title: "ರಕ್ತದ ಸಕ್ಕರೆಯನ್ನು ಹೇಗೆ ನಿಯಂತ್ರಿಸುವುದು?", desc: "ಸಕ್ಕರೆ ಮಟ್ಟವನ್ನು ಕಂಟ್ರೋಲ್‌ನಲ್ಲಿಡಲು ಸರಳ ಸಲಹೆಗಳು." },
    { title: "ಯಾವ ಆಹಾರಗಳನ್ನು ಸೇವಿಸಬೇಕು?", desc: "ಉತ್ತಮ ಫೈಬರ್‌ಯುಕ್ತ ಆಹಾರಗಳನ್ನು ಕಂಡುಕೊಳ್ಳಿ." },
    { title: "ಯಾವ ಆಹಾರಗಳನ್ನು ತಪ್ಪಿಸಬೇಕು?", desc: "ಸಕ್ಕರೆ ಪಾನೀಯಗಳು ಮತ್ತು ಸಂಸ್ಕರಿಸಿದ ಆಹಾರಗಳನ್ನು ತಪ್ಪಿಸಿ." },
    { title: "ಎಷ್ಟು ನೀರು ಕುಡಿಯಬೇಕು?", desc: "ದೈನಂದಿನ ನೀರಿನ ಸೇವನೆಯ ಗುರಿಯನ್ನು ತಿಳಿಯಿರಿ." },
    { title: "ಮಧುಮೇಹದ ಅಪಾಯವನ್ನು ಹೇಗೆ ಕಡಿಮೆ ಮಾಡುವುದು?", desc: "ಅಪಾಯವನ್ನು ಕಡಿಮೆ ಮಾಡುವ ಜೀವನಶೈಲಿ ಬದಲಾವಣೆಗಳು." },
  ],
  ta: [
    { title: "நீரிழிவு நோய் என்றால் என்ன?", desc: "நீரிழிவு நோயின் வகைகள் மற்றும் காரணங்களை அறியவும்." },
    { title: "இரத்த சர்க்கரையை எவ்வாறு கட்டுப்படுத்துவது?", desc: "சர்க்கரை அளவை கட்டுப்படுத்த சிறந்த குறிப்புகள்." },
    { title: "என்ன உணவுகளை சாப்பிட வேண்டும்?", desc: "நார்ச்சத்து நிறைந்த சத்தான உணவுகள்." },
    { title: "எவற்றை தவிர்க்க வேண்டும்?", desc: "சர்க்கரை பானங்கள் மற்றும் சுத்திகரிக்கப்பட்ட உணவுகள்." },
    { title: "எவ்வளவு தண்ணீர் குடிக்க வேண்டும்?", desc: "தினசரி தண்ணீர் குடிக்கும் இலக்கை அறியவும்." },
    { title: "நீரிழிவு அபாயத்தை எவ்வாறு குறைப்பது?", desc: "வாழ்க்கை முறை மாற்றங்கள் மூலம் அபாயத்தைக் குறைக்கவும்." },
  ],
  te: [
    { title: "మధుమేహం అంటే ఏమిటి?", desc: "మధుమేహం రకాలు మరియు కారణాల గురించి తెలుసుకోండి." },
    { title: "రక్తంలో చక్కెరను ఎలా అదుపు చేయాలి?", desc: "గ్లూకోజ్ స్థాయిలను అదుపులో ఉంచుకునే చిట్కాలు." },
    { title: "ఏ ఆహారాలు తినాలి?", desc: "పీచుపదార్థాలు ఉన్న మంచి ఆహారాలు." },
    { title: "ఏవి నివారించాలి?", desc: "చక్కెర పానీయాలు మరియు ప్రాసెస్ చేసిన ఆహారాలు." },
    { title: "ఎంత నీరు తాగాలి?", desc: "రోజువారీ నీటి వినియోగ లక్ష్యాన్ని తెలుసుకోండి." },
    { title: "మధుమేహం ప్రమాదాన్ని ఎలా తగ్గించాలి?", desc: "జీవనశైలి మార్పుల ద్వారా ప్రమాదాన్ని తగ్గించండి." },
  ],
};

export default function ChatAssistant() {
  const { showToast } = useToast();
  const { language } = useLanguage() || {};
  const currentLang = language || "en";

  const [sessions, setSessions] = useState([]);
  const [search, setSearch] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [lastFailedMessage, setLastFailedMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const scrollRef = useRef(null);

  const welcomeQuestions = WELCOME_QUESTIONS_BY_LANG[currentLang] || WELCOME_QUESTIONS_BY_LANG["en"];

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const params = {};
      if (search) params.q = search;
      if (favoriteOnly) params.favorite = 1;
      const data = await chatApi.listSessions(params);
      setSessions(data.items);
      if (!activeId && data.items.length > 0) {
        setActiveId(data.items[0].id);
      }
    } catch (err) {
      showToast(err.message || "Could not load chats.", "error");
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    chatApi.status().then((s) => setConfigured(s.configured)).catch(() => {});
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(loadSessions, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, favoriteOnly]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    chatApi
      .getMessages(activeId)
      .then((data) => {
        if (!cancelled) setMessages(data.messages);
      })
      .catch((err) => showToast(err.message || "Could not load messages.", "error"))
      .finally(() => !cancelled && setLoadingMessages(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const handleNewChat = async () => {
    try {
      const session = await chatApi.createSession(currentLang);
      setSessions((prev) => [session, ...prev]);
      setActiveId(session.id);
      setMessages([]);
      setLastFailedMessage("");
      if (mobileSidebarOpen) setMobileSidebarOpen(false);
    } catch (err) {
      showToast(err.message || "Could not start a new chat.", "error");
    }
  };

  const handleSend = async (textToSubmit) => {
    const text = (textToSubmit || lastFailedMessage).trim();
    if (!text) return;

    let sessionId = activeId;
    if (!sessionId) {
      try {
        const session = await chatApi.createSession(currentLang);
        setSessions((prev) => [session, ...prev]);
        sessionId = session.id;
        setActiveId(sessionId);
      } catch (err) {
        showToast("Could not initialize chat session.", "error");
        return;
      }
    }

    setLastFailedMessage("");
    setErrorMessage("");
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", message: text, created_at: new Date().toISOString() },
    ]);
    setSending(true);

    try {
      const result = await chatApi.sendMessage(sessionId, text, currentLang);
      setMessages((prev) => [
        ...prev.filter((m) => !String(m.id).startsWith("local-")),
        result.user_message,
        result.assistant_message,
      ]);
      loadSessions();
    } catch (err) {
      console.error("AI Chat Assistant request failed:", err);
      setLastFailedMessage(text);
      let errMsg = err.message || "Could not connect to AI Assistant. Please try again.";
      if (err.status === 401) errMsg = "Authentication error. Please log in again.";
      else if (err.status === 429) errMsg = "AI API rate limit reached. Please wait a moment.";
      else if (err.status === 503) errMsg = "AI service temporarily unavailable. Please try again.";
      setErrorMessage(errMsg);
      showToast(errMsg, "error");
      setMessages((prev) => prev.filter((m) => !String(m.id).startsWith("local-")));
    } finally {
      setSending(false);
    }
  };

  const handleRegenerate = async () => {
    if (!activeId) return;
    setRegenerating(true);
    try {
      const fresh = await chatApi.regenerate(activeId, currentLang);
      setMessages((prev) => {
        const withoutLast = [...prev];
        withoutLast.pop();
        return [...withoutLast, fresh];
      });
    } catch (err) {
      showToast(err.message || "Could not regenerate response.", "error");
    } finally {
      setRegenerating(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await chatApi.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
      showToast("Chat deleted.", "success");
    } catch (err) {
      showToast(err.message || "Could not delete chat.", "error");
    }
  };

  const handleRename = async (id, title) => {
    try {
      await chatApi.updateSession(id, { title });
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));
    } catch (err) {
      showToast(err.message || "Could not rename chat.", "error");
    }
  };

  const handleToggleFavorite = async (id, value) => {
    try {
      await chatApi.updateSession(id, { is_favorite: value });
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, is_favorite: value } : s)));
    } catch (err) {
      showToast(err.message || "Could not update favorite.", "error");
    }
  };

  const handleExport = async (format) => {
    if (!activeId) return;
    try {
      if (format === "pdf") {
        await downloadWithAuth(chatApi.exportUrl(activeId, "pdf"), `chat_${activeId.slice(0, 8)}.pdf`);
      } else {
        await downloadWithAuth(chatApi.exportUrl(activeId, "txt"), `chat_${activeId.slice(0, 8)}.txt`);
      }
      showToast("Chat exported.", "success");
    } catch (err) {
      showToast(err.message || "Could not export chat.", "error");
    }
  };

  const handleClearChat = async () => {
    if (!activeId) return;
    try {
      await chatApi.deleteSession(activeId);
      setSessions((prev) => prev.filter((s) => s.id !== activeId));
      setActiveId(null);
      setMessages([]);
      showToast("Chat cleared.", "success");
    } catch {
      showToast("Could not clear chat.", "error");
    }
  };

  return (
    <div className="chat-container" style={{ maxWidth: 1400, margin: "0 auto", padding: 24, width: "100%" }}>
      {/* Section 1: Professional Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 20,
          padding: 20,
          borderRadius: 16,
          background: "linear-gradient(135deg, var(--paper, #ffffff), var(--surface-subtle, #f8fafc))",
          border: "1px solid var(--border, #e2e8f0)",
          boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "var(--teal, #0d9488)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(13, 148, 136, 0.3)",
              flexShrink: 0,
            }}
          >
            <Bot size={26} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", margin: 0 }}>AI Health Assistant</h1>
            <p style={{ fontSize: 13, color: "var(--text-faint)", margin: "2px 0 0 0" }}>Your personal diabetes health companion</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: "rgba(16, 185, 129, 0.12)", color: "#10b981", fontSize: 12, fontWeight: 700 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
            Online
          </div>

          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: "rgba(13, 148, 136, 0.12)", color: "var(--teal)", fontSize: 12, fontWeight: 700 }}>
            🌐 Language: {currentLang.toUpperCase()}
          </div>

          <Button onClick={handleNewChat} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 14px", borderRadius: 10 }}>
            <Plus size={16} /> + New Chat
          </Button>

          <button
            className="mobile-sidebar-toggle"
            onClick={() => setMobileSidebarOpen((v) => !v)}
            style={{ display: "none", padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--paper)" }}
          >
            {mobileSidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {!configured && (
        <div className="chat-config-banner" style={{ padding: 14, borderRadius: 12, background: "#fef3c7", border: "1px solid #f59e0b", color: "#b45309", marginBottom: 20, fontSize: 13 }}>
          Groq API key not configured yet — running in limited fallback mode. Add <code>GROQ_API_KEY</code> to <code>backend/.env</code> to enable full AI replies.
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="chat-layout" style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 24, alignItems: "start" }}>
        {/* Left Chat History Sidebar */}
        <Card className={`chat-sidebar-card ${mobileSidebarOpen ? "open" : ""}`} style={{ padding: 16, borderRadius: 16, boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)" }}>
          {loadingSessions ? (
            <Loading label="Loading chats…" />
          ) : (
            <ChatSessionList
              sessions={sessions}
              activeId={activeId}
              onSelect={(id) => {
                setActiveId(id);
                setMobileSidebarOpen(false);
              }}
              onNew={handleNewChat}
              onDelete={handleDelete}
              onRename={handleRename}
              onToggleFavorite={handleToggleFavorite}
              search={search}
              onSearchChange={setSearch}
              favoriteOnly={favoriteOnly}
              onToggleFavoriteFilter={() => setFavoriteOnly((v) => !v)}
            />
          )}
        </Card>

        {/* Right Chat Conversation Card */}
        <Card style={{ display: "flex", flexDirection: "column", padding: 24, minHeight: 620, height: "calc(100vh - 220px)", borderRadius: 16, boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)", width: "100%" }}>
          {/* Header Row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
              {activeId ? "🤖 AI Health Conversation" : "🤖 New AI Conversation"}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {activeId && (
                <Button variant="ghost" onClick={handleClearChat} style={{ color: "var(--crimson)", padding: "6px 12px", fontSize: 12.5 }}>
                  Clear Chat
                </Button>
              )}
              <Button variant="ghost" onClick={() => handleExport("pdf")} style={{ padding: "6px 12px", fontSize: 12.5 }}>
                Export PDF
              </Button>
              <Button variant="ghost" onClick={() => handleExport("txt")} style={{ padding: "6px 12px", fontSize: 12.5 }}>
                Export Text
              </Button>
            </div>
          </div>

          {/* Chat Messages Thread */}
          <div className="chat-thread" ref={scrollRef} style={{ flex: 1, overflowY: "auto", paddingRight: 6 }}>
            {loadingMessages ? (
              <Loading label="Loading conversation…" />
            ) : messages.length === 0 ? (
              /* Section 2: Welcome Screen */
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 380, padding: "20px 10px", textAlign: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(13, 148, 136, 0.12)", color: "var(--teal)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  <Sparkles size={28} />
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", margin: 0 }}>How can I help you today?</h2>
                <p style={{ fontSize: 14, color: "var(--text-faint)", maxWidth: 520, margin: "8px 0 24px 0", lineHeight: 1.5 }}>
                  Ask me about diabetes, blood glucose, diet, exercise, reports, or healthy lifestyle.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, width: "100%", maxWidth: 800 }}>
                  {welcomeQuestions.map((q, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSend(q.title)}
                      style={{
                        padding: 16,
                        borderRadius: 14,
                        border: "1px solid var(--border)",
                        background: "var(--paper)",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.02)",
                      }}
                      className="welcome-card-item"
                    >
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>{q.title}</div>
                      <div style={{ fontSize: 12, color: "var(--text-faint)", lineHeight: 1.4 }}>{q.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <ChatMessage
                  key={m.id}
                  message={m}
                  isLast={i === messages.length - 1 && m.role === "assistant"}
                  onRegenerate={handleRegenerate}
                  regenerating={regenerating}
                />
              ))
            )}
            {sending && <TypingIndicator />}

            {/* Error Retry Banner */}
            {lastFailedMessage && !sending && (
              <div style={{ padding: 14, borderRadius: 12, background: "rgba(220, 38, 38, 0.08)", border: "1px solid rgba(220, 38, 38, 0.2)", color: "var(--crimson)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <AlertCircle size={16} />
                  <span>{errorMessage || "Unable to connect to the AI assistant right now. Please try again."}</span>
                </div>
                <Button onClick={() => handleSend()} style={{ fontSize: 12, padding: "6px 12px", background: "var(--crimson)", color: "#fff" }}>
                  <RefreshCw size={13} style={{ marginRight: 4 }} /> Retry
                </Button>
              </div>
            )}
          </div>

          {/* Section 8 & 12: Composer */}
          <ChatComposer onSend={handleSend} sending={sending} showSuggestions={messages.length === 0} />
        </Card>
      </div>
    </div>
  );
}
