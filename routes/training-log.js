const express = require("express");
const router = express.Router();
const conn = require("../connection.js");
const tokenValidation = require("../middleware/tokenValidation.js");

router.get("/", async (req, res) => {
  const token = req.query.token;
  if (token === undefined) {
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

  try {
    const [logRow] = await conn.execute(
      "SELECT user_id, log FROM training_log WHERE user_id = ?",
      [userData.uid]
    );
    let returnData = {};
    if (logRow.length > 0) returnData = logRow[0].log;
    res.status(200).send({
      success: true,
      message: "Get succeeded.",
      data: returnData,
    });
    return;
  } catch (err) {
    console.log(err);
    res.status(500).send({
      success: false,
      error: "Internal Server Error.",
      errorCode: "INTERNAL_ERROR",
    });
    return;
  }
});

router.post("/", async (req, res) => {
  const token = req.body.token;
  const log = req.body.log;
  if (token === undefined || log === undefined) {
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

  const allowLogPart = [
    "chest",
    "back",
    "shoulders",
    "biceps",
    "triceps",
    "core",
    "legs",
  ];

  let saveData = {};
  allowLogPart.forEach((part) => {
    if (log[part] !== undefined) {
      let formatData = [];
      if (!Array.isArray(log[part])) {
        saveData[part] = formatData;
        return;
      }
      log[part].forEach((logData) => {
        let logText = logData.text;
        let logVolume = logData.volume;
        let logSet = logData.set;
        let logUnit = logData.unit;
        if (!logText) return;
        logText = logText.replace(/[^\sa-zA-Z\u4e00-\u9fa5()0-9]+/g, "");
        if (!logText) return;
        if (!logVolume || isNaN(logVolume)) logVolume = 0;
        if (!logSet || isNaN(logSet)) logSet = 0;
        if (!logUnit) logUnit = "KG";
        formatData.push({
          text: logText,
          volume: logVolume,
          set: logSet,
          unit: logUnit,
        });
      });
      saveData[part] = formatData;
    }
  });

  try {
    const [logRow] = await conn.execute(
      "INSERT INTO training_log (user_id, log) VALUES (?, ?) ON DUPLICATE KEY UPDATE log = VALUES(log)",
      [userData.uid, saveData]
    );

    res.status(200).send({
      success: true,
      message: "update succeeded.",
    });
    return;
  } catch (err) {
    console.log(err);
    res.status(500).send({
      success: false,
      error: "Internal Server Error.",
      errorCode: "INTERNAL_ERROR",
    });
    return;
  }
});

module.exports = router;
