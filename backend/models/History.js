const mongoose = require("mongoose");

const HistorySchema = new mongoose.Schema({
  patientName: String,
  disease: String,
  location: String,
  symptoms: String,

  // ✅ MAIN AI RESPONSE (USED IN CASE PAGE + PDF)
  response: String,

  // Chat messages (optional, for history view)
  messages: [
    {
      type: { type: String },
      text: String
    }
  ],

  primarySources: Array,
  clinicalTrials: Array,

  // ✅ ANALYSIS FIELDS (were missing — caused blank panels on resume)
  riskLevel: { type: Number, default: 60 },
  keyTakeaways: { type: Array, default: [] },
  personalizedInsight: { type: String, default: "" },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("History", HistorySchema);