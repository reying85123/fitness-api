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

  const sqlStr =
    "SELECT type, target, unit FROM weight_goal WHERE user_id = ? AND (type = 'weight' OR type = 'fat')";

  try {
    const [goalRow] = await conn.execute(sqlStr, [userData.uid]);
    goalRow.forEach((goalItem, goalIndex) => {
      goalRow[goalIndex].target = parseFloat(goalItem.target);
    });
    res.status(200).send({
      success: true,
      message: "Get succeeded.",
      data: goalRow,
    });
    return;
  } catch (err) {
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
  const type = req.body.type;
  const target = req.body.target;
  const unit = req.body.unit;
  let errorStatus = false;
  if (token === undefined) errorStatus = true;

  const allowType = ["weight", "fat"];
  if (!allowType.includes(type)) errorStatus = true;

  if (isNaN(target)) errorStatus = true;

  const allowUnit = ["KG", "LB", "%"];
  if (!allowUnit.includes(unit)) errorStatus = true;

  const valueLimit = {
    weight: {
      max: 999,
      min: 0,
    },
    fat: {
      max: 100,
      min: 0,
    },
  };
  if (
    Number(target) > valueLimit[type].max ||
    Number(target) < valueLimit[type].min
  ) {
    errorStatus = true;
  }

  if (errorStatus) {
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
    const [goalRow] = await conn.execute(
      "INSERT INTO weight_goal (user_id, type, target, unit) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE target = VALUES(target), unit = VALUES(unit)",
      [userData.uid, type, target, unit]
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
