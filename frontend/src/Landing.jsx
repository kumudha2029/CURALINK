function Landing({ onStart }) {
  return (
    <div
      style={{
        height: "100vh",
        width: "100%",
        // UPDATED: Matches your Clinical History/Case Page gradient
        background: "linear-gradient(135deg, #3b76b0 0%, #2a5b8d 60%, #1e3a5f 100%)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* NAVBAR */}
      <div
        style={{
          padding: "30px 60px",
          display: "flex",
          justifyContent: "center", // Centered logo since button is removed
          alignItems: "center",
        }}
      >
        {/* LOGO */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "#0ea5a4", // Matches your teal accent
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
              boxShadow: "0 6px 20px rgba(14,165,164,0.4)",
              transition: "0.3s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
            onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            🤖
          </div>

          <h2
            style={{
              fontSize: "24px",
              fontWeight: "700",
              letterSpacing: "-0.5px",
              color: "#ffffff",
            }}
          >
            CuraLink
          </h2>
        </div>
      </div>

      {/* HERO */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "0 20px",
        }}
      >
        <div style={{ maxWidth: "1000px" }}>
          
          {/* TAGLINE */}
          <h2
            style={{
              fontSize: "28px",
              fontWeight: "500",
              color: "#dbe5ef", // Light blue-grey
              marginBottom: "15px",
            }}
          >
            Advanced{" "}
            <span
              style={{
                fontFamily: "'Pacifico', cursive",
                color: "#0ea5a4", // Teal accent
                fontSize: "30px",
              }}
            >
              AI Assistant
            </span>{" "}
            for Healthcare Research
          </h2>

          {/* MAIN TITLE */}
          <h1
            style={{
              fontSize: "82px",
              fontWeight: "800",
              letterSpacing: "-3px",
              color: "#ffffff",
              lineHeight: "1.0",
              margin: 0,
            }}
          >
            CuraLink AI
          </h1>

          {/* GRADIENT TEXT */}
          <h2
            style={{
              fontSize: "56px",
              fontWeight: "700",
              marginTop: "15px",
              background: "linear-gradient(to right, #ffffff, #0ea5a4, #3b82f6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Medical Research Assistant
          </h2>

          {/* SUBTEXT */}
          <p
            style={{
              marginTop: "25px",
              fontSize: "20px",
              color: "#cbd5e1",
              maxWidth: "700px",
              marginLeft: "auto",
              marginRight: "auto",
              lineHeight: "1.6"
            }}
          >
            Extract precision insights from clinical trials and source publications
            with AI-powered deep analysis.
          </p>

          {/* MAIN CTA BUTTON */}
          <button
            onClick={onStart}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = "translateY(-5px)";
              e.currentTarget.style.boxShadow = "0 15px 30px rgba(14,165,164,0.4)";
              e.currentTarget.style.background = "#12c2c0";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 10px 25px rgba(14,165,164,0.3)";
              e.currentTarget.style.background = "#0ea5a4";
            }}
            style={{
              marginTop: "45px",
              padding: "18px 45px",
              background: "#0ea5a4",
              color: "white",
              border: "none",
              borderRadius: "16px", // Matching your card border radius
              fontSize: "18px",
              fontWeight: "700",
              cursor: "pointer",
              boxShadow: "0 10px 25px rgba(14,165,164,0.3)",
              transition: "all 0.3s ease",
            }}
          >
            🚀 Launch Chat
          </button>
        </div>
      </div>
    </div>
  );
}

export default Landing;