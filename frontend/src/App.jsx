import { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Landing from "./Landing";
import ChatPage from "./components/ChatPage";
import HistoryPage from "./components/HistoryPage";
import CasePage from "./components/CasePage";

function App() {
  const [showApp, setShowApp] = useState(false);
  const [data, setData] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState("English");
  const [privacyMode, setPrivacyMode] = useState(false);

  // 🆕 NEW: Store last query context (for personalization)
  const [lastQueryContext, setLastQueryContext] = useState(null);

  // ✅ FIX 1: Enhanced Query Function
  const sendQuery = async (formData) => {
    try {
      const res = await fetch("http://localhost:5000/api/research/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patientName: formData.patientName,
          disease: formData.disease,
          query: formData.query,
          location: formData.location,
          timestamp: new Date()
        }),
      });

      const result = await res.json();
      console.log("API RESULT:", result);

      setData(result);

      // 🆕 SAVE CONTEXT FOR PERSONALIZATION
      setLastQueryContext({
        patientName: formData.patientName,
        disease: formData.disease,
        query: formData.query,
      });

      // 🆕 AUTO SAVE TO HISTORY (GLOBAL LEVEL — SAFE)
      await fetch("http://localhost:5000/api/history/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patientName: privacyMode
            ? "PAT-" + Math.floor(1000 + Math.random() * 9000)
            : formData.patientName,
          disease: formData.disease,
          symptoms: formData.query,
          response: result.aiResponse,
          primarySources: result.sources || [],
          clinicalTrials: result.trials || [],
        }),
      });

    } catch (err) {
      console.error("Error connecting to server:", err);
    }
  };

  // ✅ FIX 2: Reset Data helper
  const clearData = () => setData(null);

  if (!showApp) {
    return (
      <Landing
        onStart={() => setShowApp(true)}
        language={language}
        setLanguage={setLanguage}
      />
    );
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <ChatPage
              sendQuery={sendQuery}
              data={data}
              clearData={clearData}
              darkMode={darkMode}
              setDarkMode={setDarkMode}
              language={language}
              setLanguage={setLanguage}
              privacyMode={privacyMode}
              setPrivacyMode={setPrivacyMode}
              lastQueryContext={lastQueryContext}
            />
          }
        />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/case/:id" element={<CasePage />} />
      </Routes>
    </Router>
  );
}

export default App;