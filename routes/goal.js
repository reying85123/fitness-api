const express = require("express");
const router = express.Router();
const conn = require("../connection.js");
const tokenValidation = require("../middleware/tokenValidation.js");
const validDate = require("../middleware/validDate.js");

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

//取得近七日紀錄體重、體脂變化
router.get("/weight-change", async (req, res) => {
  const token = req.query.token;
  const date = req.query.date;
  if (token === undefined || date === undefined) {
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

  //檢查日期
  let dateCheck = validDate(date);
  if (!dateCheck) {
    res.status(400).send({
      success: false,
      error:
        "Invalid date format. Please use the correct date format, such as YYYY-MM-DD.",
      errorCode: "BAD_REQUEST",
    });
    return;
  }

  try {
    const [scheduleRow] = await conn.execute(
      "SELECT user_id, weight, fat, DATE_FORMAT(schedule_time, '%m/%d') as schedule_time FROM fit_schedule WHERE user_id = ? AND (schedule_time >= ? - INTERVAL 6 DAY AND schedule_time <= ?) ORDER BY schedule_time ASC",
      [userData.uid, date, date]
    );

    let weightData = {};
    for (const dataRow of scheduleRow) {
      weightData[dataRow.schedule_time] = {
        weight: dataRow.weight ? dataRow.weight : 0,
        fat: dataRow.fat ? dataRow.fat : 0,
      };
    }

    const queryDate = new Date(date);
    const returnData = [];
    queryDate.setDate(queryDate.getDate() - 6);
    for (let i = 0; i < 7; i++) {
      let dateStr = `${(queryDate.getMonth() + 1)
        .toString()
        .padStart(2, "0")}/${queryDate.getDate().toString().padStart(2, "0")}`;
      if (weightData[dateStr]) {
        returnData.push({
          date: dateStr,
          weight: Number(weightData[dateStr].weight).toFixed(1),
          fat: Number(weightData[dateStr].fat).toFixed(1),
        });
      } else {
        if (returnData.length === 0) {
          returnData.push({
            date: dateStr,
            weight: "0.0",
            fat: "0.0",
          });
        } else {
          returnData.push({
            date: dateStr,
            weight: Number(returnData[returnData.length - 1].weight).toFixed(1),
            fat: Number(returnData[returnData.length - 1].fat).toFixed(1),
          });
        }
      }

      queryDate.setDate(queryDate.getDate() + 1); // 减去一天
    }

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
module.exports = router;
