const express = require("express");
const router = express.Router();
const History = require("../models/History");

// ✅ SAVE CASE (Maps frontend 'response' to DB 'response')
router.post("/save", async (req, res) => {
  try {
    const {
      patientName,
      disease,
      symptoms,
      messages,
      primarySources,
      clinicalTrials,
      response, // This is the core AI text
      riskLevel,
      keyTakeaways,
      personalizedInsight
    } = req.body;

    const newItem = new History({
      patientName,
      disease,
      symptoms,
      messages,
      primarySources,
      clinicalTrials,
      response, 
      riskLevel: riskLevel || 60,
      keyTakeaways: keyTakeaways || [],
      personalizedInsight: personalizedInsight || ""
    });

    const saved = await newItem.save();
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET ALL HISTORY (FIXES YOUR ERROR)
router.get("/", async (req, res) => {
  try {
    const allHistory = await History.find().sort({ createdAt: -1 });
    res.json(allHistory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;