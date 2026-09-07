import { createContext, useContext, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { userSettingsApi } from "../services/api.js";

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const { t, i18n } = useTranslation();
  const [language, setLanguageState] = useState(() => localStorage.getItem("gc_language") || "en");

  useEffect(() => {
    // Sync language from database settings on mount
    userSettingsApi
      .get()
      .then((data) => {
        if (data?.preferred_language) {
          setLanguageState(data.preferred_language);
          i18n.changeLanguage(data.preferred_language);
          localStorage.setItem("gc_language", data.preferred_language);
        }
      })
      .catch(() => {});
  }, [i18n]);

  const changeLanguage = (lang) => {
    setLanguageState(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem("gc_language", lang);
  };

  const customT = (key, options) => {
    if (!key) return "";
    const rawRes = t(key, options);
    const keyStr = String(key);
    
    // If i18next returns the raw key itself (e.g., "auth.welcomeBack" or "AUTH.EMAIL")
    if (typeof rawRes === "string" && (rawRes === keyStr || rawRes.includes("."))) {
      const parts = keyStr.split(".");
      const lastPart = parts[parts.length - 1];
      
      const knownFallbacks = {
        welcomeback: "Welcome Back",
        patientlogin: "Patient Login",
        adminlogin: "Administrator Sign In",
        adminportal: "Admin Portal",
        email: "Email",
        password: "Password",
        signin: "Sign In",
        signup: "Sign Up",
        forgotpassword: "Forgot Password?",
        donthaveaccount: "Don't have an account?",
        systemadministrator: "System Administrator?",
        adminportallink: "Admin Portal",
        userportallink: "Go to User Portal",
      };

      if (knownFallbacks[lastPart.toLowerCase()]) {
        return knownFallbacks[lastPart.toLowerCase()];
      }

      return lastPart
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
    }
    return rawRes;
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t: customT, i18n }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
