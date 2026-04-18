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

// ✅ GET SINGLE CASE
router.get("/:id", async (req, res) => {
  try {
    const item = await History.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Case not found" });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;