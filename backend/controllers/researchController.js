const axios = require("axios");

/* ═══════════════════════════════════════════════════════════════
   STEP 1 — SMART QUERY BUILDER
═══════════════════════════════════════════════════════════════ */
function buildSmartQuery({ query, disease, location }) {
  let base = query && disease ? `${query} ${disease}` : disease ? `${disease} treatment` : query || "";
  return location ? `${base} ${location}` : base;
}

function expandQuery(disease, baseQuery) {
  return [
    baseQuery,
    `${disease} treatment ${baseQuery}`,
    `${baseQuery} clinical evidence`,
    `${disease} pathophysiology management`,
  ];
}

/* ═══════════════════════════════════════════════════════════════
   PUBMED — search IDs then fetch summaries
═══════════════════════════════════════════════════════════════ */
async function fetchPubMedIds(query) {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encoded}&retmax=30&sort=relevance&retmode=json`;
    const res = await axios.get(url, { timeout: 8000 });
    return res.data?.esearchresult?.idlist || [];
  } catch (err) {
    console.warn("PubMed search error:", err.message);
    return [];
  }
}

async function fetchPubMedDetails(ids) {
  if (!ids.length) return [];
  try {
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;
    const res = await axios.get(url, { timeout: 8000 });
    const result = res.data?.result || {};
    return ids.map(id => {
      const item = result[id];
      if (!item || !item.title) return null;
      return {
        title  : item.title,
        authors: item.authors?.slice(0, 4).map(a => a.name).join(", ") || "Unknown",
        year   : item.pubdate?.slice(0, 4) || "N/A",
        journal: item.source || "",
        source : "PubMed",
        url    : `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        snippet: item.title, // used for display
      };
    }).filter(Boolean);
  } catch (err) {
    console.warn("PubMed details error:", err.message);
    return [];
  }
}

/* ═══════════════════════════════════════════════════════════════
   OPENALEX — improved with filters for quality
═══════════════════════════════════════════════════════════════ */
async function fetchOpenAlex(query, disease) {
  try {
    const encoded = encodeURIComponent(`${query} ${disease}`);
    const url = `https://api.openalex.org/works?search=${encoded}&per-page=20&sort=relevance_score&filter=is_oa:true`;
    const res = await axios.get(url, { timeout: 8000 });
    return (res.data?.results || []).map(item => ({
      title  : item.title || "Untitled",
      authors: item.authorships?.slice(0, 3).map(a => a.author?.display_name).filter(Boolean).join(", ") || "Unknown",
      year   : item.publication_year || "N/A",
      journal: item.primary_location?.source?.display_name || "",
      source : "OpenAlex",
      url    : item.primary_location?.landing_page_url || item.id || "",
      snippet: item.title,
    }));
  } catch (err) {
    console.warn("OpenAlex error:", err.message);
    return [];
  }
}

/* ═══════════════════════════════════════════════════════════════
   CLINICAL TRIALS — improved location extraction
═══════════════════════════════════════════════════════════════ */
async function fetchClinicalTrials(query, disease, location) {
  try {
    const term = encodeURIComponent(`${disease} ${query}`);
    const url  = `https://clinicaltrials.gov/api/v2/studies?query.term=${term}&pageSize=8&filter.overallStatus=COMPLETED,RECRUITING,ACTIVE_NOT_RECRUITING`;
    const res  = await axios.get(url, { timeout: 10000 });

    return (res.data?.studies || []).map(study => {
      const p = study.protocolSection;

      // ── Location: try city → country → patient location ──
      const locs     = p?.contactsLocationsModule?.locations || [];
      const country  = locs[0]?.country || "";
      const city     = locs[0]?.city || "";
      const facility = locs[0]?.facility?.name || "";
      const locStr   = city && country ? `${city}, ${country}` : country || facility || location || "";

      // ── Phase ──
      const phase = p?.designModule?.phases?.[0]?.replace("PHASE", "Phase ") || "";

      // ── Condition ──
      const conditions = p?.conditionsModule?.conditions?.slice(0, 2).join(", ") || disease;

      return {
        title     : p?.identificationModule?.briefTitle || "Untitled Study",
        status    : p?.statusModule?.overallStatus || "UNKNOWN",
        location  : locStr,
        phase,
        conditions,
        nctId     : p?.identificationModule?.nctId || "",
        url       : p?.identificationModule?.nctId
                    ? `https://clinicaltrials.gov/study/${p.identificationModule.nctId}`
                    : "",
      };
    });
  } catch (err) {
    console.warn("ClinicalTrials error:", err.message);
    return [];
  }
}

/* ═══════════════════════════════════════════════════════════════
   RANKING — score papers by relevance + recency
═══════════════════════════════════════════════════════════════ */
function rankPapers(papers, query, disease) {
  const qLow = (query || "").toLowerCase();
  const dLow = (disease || "").toLowerCase();
  return papers
    .filter(p => p.title && p.title.length > 5)
    .map(p => {
      const t  = (p.title || "").toLowerCase();
      let score = 0;
      if (t.includes(qLow))  score += 12;
      if (t.includes(dLow))  score += 18;
      score += Math.max(0, (parseInt(p.year) || 2000) - 2000) * 0.8; // recency boost
      if (p.source === "PubMed") score += 5; // peer-reviewed bonus
      return { ...p, score };
    })
    .sort((a, b) => b.score - a.score);
}

/* ═══════════════════════════════════════════════════════════════
   STRUCTURED RESPONSE — returns keyTakeaways + personalizedInsight
   as proper fields, not buried in freetext
═══════════════════════════════════════════════════════════════ */
function buildStructuredResponse({ topPapers, clinicalTrials, query, disease, location, patientName }) {

  // ── Key Takeaways: derived from top papers ──
  const keyTakeaways = [];

  if (topPapers.length > 0) {
    keyTakeaways.push(
      `${topPapers[0].title?.slice(0, 100)} (${topPapers[0].year}) — most relevant recent finding for ${disease}.`
    );
  }
  if (topPapers.length > 1) {
    keyTakeaways.push(
      `Research from ${topPapers[1].year} indicates ongoing scientific interest in ${query} related to ${disease}.`
    );
  }

  const completedTrials = clinicalTrials.filter(t => t.status === "COMPLETED");
  const activeTrials    = clinicalTrials.filter(t => ["RECRUITING","ACTIVE_NOT_RECRUITING"].includes(t.status));

  if (completedTrials.length > 0) {
    keyTakeaways.push(
      `${completedTrials.length} completed clinical trial(s) found, suggesting established research pathways for ${disease}.`
    );
  }
  if (activeTrials.length > 0) {
    keyTakeaways.push(
      `${activeTrials.length} active/recruiting trial(s) currently underway — ${disease} treatment research is still evolving.`
    );
  }
  if (keyTakeaways.length < 3) {
    keyTakeaways.push(
      `Cross-referencing ${topPapers.length} publications and ${clinicalTrials.length} trials confirms active research in ${disease} and ${query}.`
    );
  }

  // ── Personalized Insight: tailored to patient ──
  const locPhrase   = location ? ` in ${location}` : "";
  const trialPhrase = activeTrials.length > 0
    ? ` There are ${activeTrials.length} currently recruiting trial(s) that may be relevant.`
    : completedTrials.length > 0
    ? ` Completed trials show established protocols exist for this condition.`
    : "";

  const personalizedInsight =
    `For ${patientName || "this patient"}${locPhrase} with ${disease}: based on ${topPapers.length} research publications, ${query} shows active scientific investigation.${trialPhrase} Consult a specialist to evaluate applicability given individual clinical factors.`;

  // ── AI Response text (for the chat bubble) ──
  const insightLines = topPapers.slice(0, 3).map(p =>
    `• ${p.title?.slice(0, 110)} (${p.year}) — ${p.journal || p.source}`
  ).join("\n");

  const trialLines = clinicalTrials.slice(0, 4).map(t =>
    `• ${t.title?.slice(0, 100)} (${t.status})${t.location ? ` — ${t.location}` : ""}${t.phase ? ` | ${t.phase}` : ""}`
  ).join("\n");

  const riskLevel = Math.min(90, Math.max(20,
    50 +
    (activeTrials.length > 0 ? 10 : 0) +
    (topPapers.length > 5 ? 10 : 0) -
    (completedTrials.length > 2 ? 10 : 0)
  ));

  const aiResponse = `👤 Patient Context:
${patientName || "Patient"} is exploring ${query} for ${disease}${location ? ` in ${location}` : ""}.

🧬 Condition Overview:
${disease} research is actively evolving with focus on ${query}. ${topPapers.length} publications and ${clinicalTrials.length} trials identified.

🔬 Key Research Insights:
${insightLines || "• No strong peer-reviewed results found for this specific query."}

🧪 Clinical Trials:
${trialLines || "• No clinical trials found for this query."}

📌 Interpretation:
Publications and clinical trials together indicate ${activeTrials.length > 0 ? "active and ongoing" : "established"} research activity in this area.

✅ Conclusion:
This area shows ${topPapers.length > 3 ? "strong" : "emerging"} evidence with ${completedTrials.length > 0 ? "completed and" : ""} ongoing clinical investigation.`;

  return { aiResponse, keyTakeaways, personalizedInsight, riskLevel };
}

/* ═══════════════════════════════════════════════════════════════
   MAIN CONTROLLER
═══════════════════════════════════════════════════════════════ */
exports.handleQuery = async (req, res) => {
  try {
    const { query, disease, location, patientName } = req.body;

    if (!query && !disease) {
      return res.status(400).json({ error: "query or disease is required" });
    }

    const baseQuery = buildSmartQuery({ query, disease, location });
    const expanded  = expandQuery(disease || "", baseQuery);

    // ── Fetch all sources in parallel ──
    const [pubmedIds, openalexPapers, clinicalTrials] = await Promise.all([
      // Gather PubMed IDs from 2 expanded queries for coverage
      Promise.all([fetchPubMedIds(expanded[0]), fetchPubMedIds(expanded[1])])
        .then(([a, b]) => [...new Set([...a, ...b])].slice(0, 40)),
      fetchOpenAlex(query || disease, disease || query),
      fetchClinicalTrials(query || "", disease || "", location || ""),
    ]);

    // ── No data at all ──
    if (!pubmedIds.length && !openalexPapers.length) {
      return res.json({
        aiResponse        : `No research data found for "${query || disease}". Try a more specific medical term.`,
        keyTakeaways      : [],
        personalizedInsight: "",
        riskLevel         : 60,
        topPapers         : [],
        sources           : [],
        clinicalTrials    : clinicalTrials.slice(0, 5),
        trials            : clinicalTrials.slice(0, 5),
      });
    }

    // ── Fetch PubMed details + merge ──
    const pubmedPapers = await fetchPubMedDetails(pubmedIds);
    const allPapers    = [...pubmedPapers, ...openalexPapers];
    const ranked       = rankPapers(allPapers, query || disease, disease || query);
    const topPapers    = ranked.slice(0, 8);
    const filteredTrials = clinicalTrials.slice(0, 5);

    // ── Build full structured response ──
    const { aiResponse, keyTakeaways, personalizedInsight, riskLevel } = buildStructuredResponse({
      topPapers,
      clinicalTrials : filteredTrials,
      query          : query || disease,
      disease        : disease || query,
      location,
      patientName,
    });

    res.json({
      patientName,
      disease,
      location,
      query,

      // ── Structured fields (frontend reads these directly) ──
      aiResponse,
      keyTakeaways,
      personalizedInsight,
      riskLevel,

      // ── Evidence panels ──
      topPapers,
      sources        : topPapers,
      clinicalTrials : filteredTrials,
      trials         : filteredTrials,
    });

  } catch (error) {
    console.error("Server Error:", error.message);
    res.status(500).json({ error: "Something went wrong on the server." });
  }
};