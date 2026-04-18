const axios = require("axios");


// 🧠 STEP 1: SMART QUERY BUILDER
function buildSmartQuery({ query, disease, location }) {
  let finalQuery = "";

  if (query && disease) {
    finalQuery = `${query} for ${disease}`;
  } else if (disease) {
    finalQuery = `${disease} treatment research`;
  } else {
    finalQuery = query || "";
  }

  if (location) {
    finalQuery += ` ${location}`;
  }

  return finalQuery;
}


// 🔹 STEP 2: QUERY EXPANSION
function expandQuery(disease, query) {
  return [
    `${query}`,
    `${disease} treatment ${query}`,
    `${query} clinical trials ${disease}`,
    `${query} effectiveness ${disease}`
  ];
}


// 🔹 PubMed IDs
async function fetchPubMed(query) {
  try {
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${query}&retmax=50&retmode=json`;
    const res = await axios.get(url);

    return res.data?.esearchresult?.idlist || []; // ✅ SAFE
  } catch (err) {
    console.log("PubMed error:", err.message);
    return [];
  }
}


// 🔹 PubMed Details
async function fetchPubMedDetails(ids) {
  try {
    if (!ids.length) return [];

    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;
    const res = await axios.get(url);

    const result = res.data?.result || {};

    return ids.map(id => {
      const item = result[id];
      if (!item) return null;

      return {
        title: item.title,
        authors: item.authors?.map(a => a.name).join(", ") || "Unknown",
        year: item.pubdate?.slice(0, 4) || "N/A",
        source: "PubMed",
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`
      };
    }).filter(Boolean);

  } catch (err) {
    console.log("PubMed details error:", err.message);
    return [];
  }
}


// 🔹 OpenAlex
async function fetchOpenAlex(query) {
  try {
    const res = await axios.get(
      `https://api.openalex.org/works?search=${query}&per-page=50`
    );

    return (res.data?.results || []).map(item => ({
      title: item.title,
      authors: item.authorships
        ?.slice(0, 3)
        .map(a => a.author.display_name)
        .join(", ") || "Unknown",
      year: item.publication_year || "N/A",
      source: "OpenAlex",
      url: item.primary_location?.landing_page_url || item.id
    }));

  } catch (err) {
    console.log("OpenAlex error:", err.message);
    return [];
  }
}


// 🔹 Clinical Trials
async function fetchClinicalTrials(query) {
  try {
    const res = await axios.get(
      `https://clinicaltrials.gov/api/v2/studies?query.term=${query}&pageSize=20`
    );

    return (res.data?.studies || []).map(study => {
      const p = study.protocolSection;

      return {
        title: p?.identificationModule?.briefTitle || "No title",
        status: p?.statusModule?.overallStatus || "Unknown",
        location:
          p?.contactsLocationsModule?.locations?.[0]?.facility?.name ||
          "Not specified"
      };
    });

  } catch (err) {
    console.log("ClinicalTrials error:", err.message);
    return [];
  }
}


// 🔹 Ranking
function rankPapers(papers, query, disease) {
  return papers
    .map(p => {
      let score = 0;

      if (p.title?.toLowerCase().includes(query?.toLowerCase())) score += 10;
      if (p.title?.toLowerCase().includes(disease?.toLowerCase())) score += 15;

      score += (parseInt(p.year) || 2000) - 2000;

      return { ...p, score };
    })
    .sort((a, b) => b.score - a.score);
}


// 🔥 SMART RESPONSE GENERATOR
function generateSmartResponse(data, query, disease, location, patientName) {

  const insights = data.topPapers.slice(0, 3).map(p =>
    `• ${p.title} (${p.year}) highlights advancements in ${query}`
  ).join("\n");

  const trials = data.clinicalTrials.slice(0, 3).map(t =>
    `• ${t.title} (${t.status})`
  ).join("\n");

  return `
👤 Patient Context:
${patientName || "User"} is exploring ${query} for ${disease} in ${location || "global context"}.

🧬 Condition Overview:
${disease} research is actively evolving with focus on ${query}.

🔬 Key Research Insights:
${insights || "No strong insights found."}

🧪 Clinical Trials:
${trials || "No trials available."}

📌 Interpretation:
Publications and clinical trials together indicate current research activity.

✅ Conclusion:
This area shows promising advancements with ongoing clinical validation.
`;
}


// 🔥 MAIN CONTROLLER
exports.handleQuery = async (req, res) => {

  try {
    const { query, disease, location, patientName } = req.body;

    const smartQuery = buildSmartQuery({ query, disease, location });
    const expanded = expandQuery(disease, smartQuery);

    let allIds = [];

    // ✅ FIXED LOOP
    for (let q of expanded) {
      const ids = await fetchPubMed(q) || [];

      if (!Array.isArray(ids)) {
        console.log("Invalid IDs:", ids);
        continue;
      }

      allIds.push(...ids);
    }

    allIds = [...new Set(allIds)].slice(0, 50);

    // ✅ SAFETY CHECK
    if (!allIds.length) {
      return res.json({
        aiResponse: "No research data found for this query.",
        topPapers: [],
        clinicalTrials: [],
      });
    }

    const pubmed = await fetchPubMedDetails(allIds);
    const openalex = await fetchOpenAlex(expanded[0]);
    const trials = await fetchClinicalTrials(expanded[0]);

    const allPapers = [...pubmed, ...openalex];

    const ranked = rankPapers(allPapers, query, disease);
    const topPapers = ranked.slice(0, 8);
    const filteredTrials = trials.slice(0, 5);

    const aiResponse = generateSmartResponse(
      { topPapers, clinicalTrials: filteredTrials },
      query,
      disease,
      location,
      patientName
    );

    res.json({
  patientName,
  disease,
  location,
  query,

  aiResponse,

  // ✅ FRONTEND FRIENDLY
  sources: topPapers,
  trials: filteredTrials,

  // ✅ KEEP ORIGINAL (DON’T BREAK ANYTHING)
  topPapers,
  clinicalTrials: filteredTrials
});

  } catch (error) {
    console.error("Server Error:", error.message);

    res.status(500).json({
      error: "Something went wrong on server",
    });
  }
};