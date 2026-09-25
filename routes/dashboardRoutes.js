const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware")

const dashboardController = require("../controllers/dashboardController");

router.get("/stats",verifyToken, dashboardController.getStats);

module.exports = router;