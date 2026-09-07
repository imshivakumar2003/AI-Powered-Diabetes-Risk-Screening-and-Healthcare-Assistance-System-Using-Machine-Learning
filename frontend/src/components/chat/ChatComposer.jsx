import { useState } from "react";
import { useLanguage } from "../../context/LanguageContext.jsx";
import { Send, Sparkles, Activity, Utensils, Flame, Droplets, FileText, Pill } from "lucide-react";

const SUGGESTIONS_BY_LANG = {
  en: [
    "What is diabetes?",
    "How can I control blood sugar?",
    "What foods should I eat?",
    "What should I avoid?",
    "Explain my latest report",
    "Give me a healthy diet plan",
  ],
  hi: [
    "डायबिटीज क्या है?",
    "ब्लड शुगर कैसे कंट्रोल करें?",
    "मुझे क्या खाना चाहिए?",
    "किन चीजों से बचना चाहिए?",
    "मेरी रिपोर्ट समझाएं",
    "मुझे हेल्दी डाइट प्लान दें",
  ],
  kn: [
    "ಮಧುಮೇಹ ಎಂದರೇನು?",
    "ರಕ್ತದ ಸಕ್ಕರೆಯನ್ನು ಹೇಗೆ ನಿಯಂತ್ರಿಸುವುದು?",
    "ಯಾವ ಆಹಾರಗಳನ್ನು ಸೇವಿಸಬೇಕು?",
    "ಯಾವ ಆಹಾರಗಳನ್ನು ತಪ್ಪಿಸಬೇಕು?",
    "ನನ್ನ ವರದಿಯನ್ನು ವಿವರಿಸಿ",
    "ಆರೋಗ್ಯಕರ ಆಹಾರ ಯೋಜನೆ ನೀಡಿ",
  ],
  ta: [
    "நீரிழிவு நோய் என்றால் என்ன?",
    "இரத்த சர்க்கரையை எவ்வாறு குறைப்பது?",
    "என்ன உணவுகளை சாப்பிட வேண்டும்?",
    "எவற்றை தவிர்க்க வேண்டும்?",
    "என் அறிக்கையை விளக்கவும்",
    "ஆரோக்கியமான உணவு திட்டம் தரவும்",
  ],
  te: [
    "మధుమేహం అంటే ఏమిటి?",
    "రక్తంలో చెక్కరను ఎలా తగ్గించాలి?",
    "ఏ ఆహారాలు తినాలి?",
    "ఏవి నివారించాలి?",
    "నా నివేదికను వివరించండి",
    "ఆరోగ్యకరమైన డైట్ ప్లాన్ ఇవ్వండి",
  ],
};

const QUICK_ACTIONS_BY_LANG = {
  en: [
    { icon: Activity, label: "Blood Sugar", text: "How can I control blood sugar?" },
    { icon: Utensils, label: "Diet", text: "What foods should I eat?" },
    { icon: Flame, label: "Exercise", text: "What exercises are good for diabetes?" },
    { icon: Droplets, label: "Water", text: "How much water should I drink daily?" },
    { icon: FileText, label: "My Report", text: "Explain my latest report" },
    { icon: Pill, label: "Medication", text: "General guidelines for diabetes management" },
  ],
  hi: [
    { icon: Activity, label: "ब्लड शुगर", text: "ब्लड शुगर कैसे कंट्रोल करें?" },
    { icon: Utensils, label: "डाइट", text: "डायबिटीज में क्या खाना चाहिए?" },
    { icon: Flame, label: "व्यायाम", text: "डायबिटीज के लिए कौन से व्यायाम अच्छे हैं?" },
    { icon: Droplets, label: "पानी", text: "रोज कितना पानी पीना चाहिए?" },
    { icon: FileText, label: "मेरी रिपोर्ट", text: "मेरी रिपोर्ट समझाएं" },
    { icon: Pill, label: "स्वास्थ्य सलाह", text: "डायबिटीज प्रबंधन की सामान्य सलाह" },
  ],
  kn: [
    { icon: Activity, label: "ರಕ್ತದ ಸಕ್ಕರೆ", text: "ರಕ್ತದ ಸಕ್ಕರೆಯನ್ನು ನಿಯಂತ್ರಿಸುವುದು ಹೇಗೆ?" },
    { icon: Utensils, label: "ಆಹಾರ", text: "ಯಾವ ಆಹಾರಗಳನ್ನು ಸೇವಿಸಬೇಕು?" },
    { icon: Flame, label: "ವ್ಯಾಯಾಮ", text: "ಯಾವ ವ್ಯಾಯಾಮಗಳು ಒಳ್ಳೆಯದು?" },
    { icon: Droplets, label: "ನೀರು", text: "ದಿನಕ್ಕೆ ಎಷ್ಟು ನೀರು ಕುಡಿಯಬೇಕು?" },
    { icon: FileText, label: "ನನ್ನ ವರದಿ", text: "ನನ್ನ ವರದಿಯನ್ನು ವಿವರಿಸಿ" },
    { icon: Pill, label: "ಸಲಹೆಗಳು", text: "ಮಧುಮೇಹ ನಿರ್ವಹಣೆಯ ಸಾಮಾನ್ಯ ಸಲಹೆಗಳು" },
  ],
  ta: [
    { icon: Activity, label: "இரத்த சர்க்கரை", text: "இரத்த சர்க்கரையை கட்டுப்படுத்துவது எப்படி?" },
    { icon: Utensils, label: "உணவு", text: "என்ன உணவுகளை சாப்பிட வேண்டும்?" },
    { icon: Flame, label: "உடற்பயிற்சி", text: "சிறந்த உடற்பயிற்சிகள் எவை?" },
    { icon: Droplets, label: "தண்ணீர்", text: "தினமும் எவ்வளவு தண்ணீர் குடிக்க வேண்டும்?" },
    { icon: FileText, label: "என் அறிக்கை", text: "என் அறிக்கையை விளக்கவும்" },
    { icon: Pill, label: "வழிகாட்டுதல்", text: "நீரிழிவு மேலாண்மை பொது வழிகாட்டுதல்" },
  ],
  te: [
    { icon: Activity, label: "రక్త చక్కెర", text: "రక్తంలో చెక్కరను ఎలా నియంత్రించాలి?" },
    { icon: Utensils, label: "డైట్", text: "ఏ ఆహారాలు తినాలి?" },
    { icon: Flame, label: "వ్యాయామం", text: "ఏ వ్యాయామాలు మంచివి?" },
    { icon: Droplets, label: "నీరు", text: "రోజుకు ఎంత నీరు తాగాలి?" },
    { icon: FileText, label: "నా నివేదిక", text: "నా నివేదికను వివరించండి" },
    { icon: Pill, label: "సలహాలు", text: "మధుమేహ నివారణ సాధారణ సలహాలు" },
  ],
};

export default function ChatComposer({ onSend, sending, showSuggestions }) {
  const [text, setText] = useState("");
  const { language } = useLanguage() || {};
  const currentLang = language || "en";

  const activeSuggestions = SUGGESTIONS_BY_LANG[currentLang] || SUGGESTIONS_BY_LANG["en"];
  const activeQuickActions = QUICK_ACTIONS_BY_LANG[currentLang] || QUICK_ACTIONS_BY_LANG["en"];

  const submit = (value) => {
    const finalText = (value ?? text).trim();
    if (!finalText || sending) return;
    onSend(finalText);
    setText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
      {/* Section 8: Quick Health Actions */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
          <Sparkles size={12} color="var(--teal)" />
          <span>Quick Health Questions</span>
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
          {activeQuickActions.map((qa, i) => {
            const IconComp = qa.icon;
            return (
              <button
                key={i}
                type="button"
                onClick={() => submit(qa.text)}
                disabled={sending}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 10px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--surface-subtle, #f8fafc)",
                  color: "var(--ink)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                <IconComp size={13} color="var(--teal)" />
                <span>{qa.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Input Composer */}
      <div className="chat-composer" style={{ position: "relative", display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          placeholder={`Ask about diabetes, diet, blood sugar, or your report... (${currentLang.toUpperCase()})`}
          rows={2}
          className="chat-textarea"
          style={{ flex: 1, resize: "none", borderRadius: 12, padding: "10px 14px", fontSize: 13.5, border: "1px solid var(--border)" }}
        />

        <button
          className="btn btn-primary"
          onClick={() => submit()}
          disabled={sending || !text.trim()}
          aria-label="Send message"
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 12, height: 46 }}
        >
          <Send size={15} />
          {sending ? "Sending..." : "Send"}
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, fontSize: 11, color: "var(--text-faint)" }}>
        <span>Press <b>Enter</b> to send &middot; <b>Shift + Enter</b> for new line</span>
        {sending && <span style={{ color: "var(--teal)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>AI is thinking...</span>}
      </div>
    </div>
  );
}
