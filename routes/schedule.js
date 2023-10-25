const express = require("express");
const router = express.Router();
const conn = require("../connection.js");
const tokenValidation = require("../middleware/tokenValidation.js");
const validDate = require("../middleware/validDate.js");

router.get("/", async (req, res) => {});

router.post("/", async (req, res) => {
  console.log(req.body);
  const token = req.body.token;
  const schedule = req.body.schedule;
  if (token === undefined || schedule === undefined) {
    res.status(400).send({
      success: false,
      error: "Bad Request!",
      errorCode: "BAD_REQUEST",
    });
    return;
  }
  //驗證jwt
  const userData = {
    email: "",
    uid: "",
  };
  //驗證jwt
  const [verifyResult, jwtData] = tokenValidation(token);
  if (!verifyResult) {
    res.status(400).send({
      success: false,
      error: "Bad Request!",
      errorCode: "BAD_REQUEST",
    });
    return;
  }
  userData.email = jwtData.email;
  userData.uid = jwtData.uid;

  const scheduleDate = schedule.date;
  //檢查日期
  //   const checkDate

  const scheduleTime = schedule.scheduleTime;
  const scheduleWeight = schedule.weight;
  const scheduleFat = schedule.fat;
});

module.exports = router;
