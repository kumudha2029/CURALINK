const express = require("express");
const router = express.Router();
const History = require("../models/History");


// ✅ SAVE
router.post("/save", async (req, res) => {
  try {
    const newItem = new History(req.body);
    const saved = await newItem.save();
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ✅ GET ALL
router.get("/", async (req, res) => {
  try {
    const data = await History.find().sort({ createdAt: -1 });
    res.json(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error(err);
    res.status(200).json([]);
  }
});


// ✅ GET ONE
router.get("/:id", async (req, res) => {
  try {
    const item = await History.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ✅ DELETE
router.delete("/:id", async (req, res) => {
  try {
    await History.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;