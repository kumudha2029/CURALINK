const express = require("express");
const router = express.Router();

const { handleQuery } = require("../controllers/researchController");

router.post("/query", handleQuery);

module.exports = router;