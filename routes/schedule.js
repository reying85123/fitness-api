const express = require("express");
const router = express.Router();
const multer = require("multer");
const sharp = require("sharp");
const conn = require("../connection.js");
const tokenValidation = require("../middleware/tokenValidation.js");
const validDate = require("../middleware/validDate.js");
const setTimeGroupLabels = require("../middleware/setTimeGroupLabels.js");

router.get("/", async (req, res) => {
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
      "SELECT user_id, weight, fat, log, start_time, end_time, schedule_time FROM fit_schedule WHERE user_id = ? AND schedule_time = ?",
      [userData.uid, date]
    );
    let returnData = {
      weight: 0,
      fat: 0,
      log: {},
      start_time: "00:00:00",
      end_time: "00:00:00",
      date: date,
    };
    if (scheduleRow.length > 0) {
      returnData.weight = scheduleRow[0].weight ? scheduleRow[0].weight : 0;
      returnData.fat = scheduleRow[0].fat ? scheduleRow[0].fat : 0;
      returnData.log = scheduleRow[0].log ? scheduleRow[0].log : {};
      returnData.start_time = scheduleRow[0].start_time
        ? scheduleRow[0].start_time
        : "00:00:00";
      returnData.end_time = scheduleRow[0].end_time
        ? scheduleRow[0].end_time
        : "00:00:00";
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

router.post("/", async (req, res) => {
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

  let scheduleDate = schedule.date;
  //檢查日期
  let dateCheck = validDate(scheduleDate);
  if (!dateCheck) {
    res.status(400).send({
      success: false,
      error:
        "Invalid date format. Please use the correct date format, such as YYYY-MM-DD.",
      errorCode: "BAD_REQUEST",
    });
    return;
  }
  //開始/結束時間
  let scheduleTimeStart = schedule.start;
  if (isNaN(scheduleTimeStart)) scheduleTimeStart = 0;
  else if (scheduleTimeStart < 0) scheduleTimeStart = 0;
  else if (scheduleTimeStart > 24) scheduleTimeStart = 24;

  let scheduleTimeEnd = schedule.end;
  if (isNaN(scheduleTimeEnd)) scheduleTimeEnd = 0;
  else if (scheduleTimeEnd < 0) scheduleTimeEnd = 0;
  else if (scheduleTimeEnd > 24) scheduleTimeEnd = 24;

  if (scheduleTimeEnd < scheduleTimeStart) scheduleTimeEnd = scheduleTimeStart;
  scheduleTimeStart = `${scheduleTimeStart.toString().padStart(2, "0")}:00`;
  scheduleTimeEnd = `${scheduleTimeEnd.toString().padStart(2, "0")}:00`;

  //體重
  let scheduleWeight = schedule.weight;
  if (scheduleWeight < 0) scheduleWeight = 0;
  else if (scheduleWeight > 999) scheduleWeight = 999;
  //體脂
  let scheduleFat = schedule.fat;
  if (scheduleFat < 0) scheduleFat = 0;
  else if (scheduleFat > 100) scheduleFat = 100;

  //訓練菜單
  const scheduleLog = schedule.log;
  const allowLogPart = [
    "chest",
    "back",
    "shoulders",
    "biceps",
    "triceps",
    "core",
    "legs",
  ];

  let saveLogData = {};
  allowLogPart.forEach((part) => {
    if (scheduleLog[part] !== undefined) {
      let formatData = [];
      if (!Array.isArray(scheduleLog[part])) {
        saveLogData[part] = formatData;
        return;
      }
      scheduleLog[part].forEach((logData) => {
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
      saveLogData[part] = formatData;
    }
  });

  try {
    const [scheduleRow] = await conn.execute(
      "INSERT INTO fit_schedule (user_id, weight, fat, log, start_time, end_time, schedule_time) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE weight = VALUES(weight), fat = VALUES(fat), log = VALUES(log), start_time = VALUES(start_time), end_time = VALUES(end_time)",
      [
        userData.uid,
        scheduleWeight,
        scheduleFat,
        saveLogData,
        scheduleTimeStart,
        scheduleTimeEnd,
        scheduleDate,
      ]
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

router.get("/photo", async (req, res) => {
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
      "SELECT user_id, image, schedule_time FROM fit_schedule WHERE user_id = ? AND schedule_time = ?",
      [userData.uid, date]
    );

    if (scheduleRow.length !== 1) {
      res.status(404).send({
        success: false,
        message: "Photo not found",
        data: null,
      });
      return;
    }

    let returnPhoto = scheduleRow[0].image;
    if (!returnPhoto) {
      res.status(404).send({
        success: false,
        message: "Photo not found",
        data: null,
      });

      return;
    }
    let schedulePhoto = Buffer.from(returnPhoto).toString("base64");
    res.status(200).send({
      success: true,
      message: "Get succeeded.",
      data: {
        photo: schedulePhoto,
      },
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

const upload = multer({
  storage: multer.memoryStorage(), // 儲存於內存中
  fileFilter: (req, file, callback) => {
    // 過濾MIME Type
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif"];
    //限制最大5MB
    const maxSize = 5 * 1024 * 1024;
    const fileSize = parseInt(req.headers["content-length"]);

    if (allowedMimeTypes.includes(file.mimetype) && fileSize <= maxSize) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
});
router.post("/photo", upload.single("photo"), async (req, res) => {
  const uploadPhoto = req.file;
  const date = req.body.date;
  const token = req.body.token;
  if (!uploadPhoto || !token || !date) {
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

  //檢查日期格式、是否大於今天
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
    const resizedImageBuffer = await sharp(uploadPhoto.buffer)
      .resize({
        height: 960,
        withoutEnlargement: true, // 不放大圖片
      })
      .withMetadata({ density: 72 })
      .toBuffer();

    const [scheduleRow] = await conn.execute(
      "INSERT INTO fit_schedule (user_id, image, schedule_time) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE image = VALUES(image)",
      [userData.uid, resizedImageBuffer, date]
    );
    res.status(200).send({
      success: true,
      message: "upload succeeded.",
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

router.delete("/photo", async (req, res) => {
  const date = req.body.date;
  const token = req.body.token;
  if (!token || !date) {
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

  //檢查日期格式、是否大於今天
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
    const [deletePhotoResult] = await conn.execute(
      "UPDATE fit_schedule SET image = NULL WHERE user_id = ? AND schedule_time = ?",
      [userData.uid, date]
    );
    res.status(200).send({
      success: true,
      message: "delete successful.",
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

router.get("/fit-hours", async (req, res) => {
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

  //取得兩個月前月份第一天
  const nowDate = new Date(date);
  nowDate.setDate(1);
  nowDate.setMonth(nowDate.getMonth() - 2);
  const queryStartDate = `${nowDate.getFullYear()}-${(nowDate.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${nowDate.getDate().toString().padStart(2, "0")}`;
  try {
    const [scheduleRows] = await conn.execute(
      "SELECT user_id, start_time, end_time, schedule_time FROM fit_schedule WHERE user_id = ? AND (schedule_time >= ? AND schedule_time <= ?) ORDER BY schedule_time ASC",
      [userData.uid, queryStartDate, date]
    );
    const dateKeyData = {};
    for (let row of scheduleRows) {
      let rowDate = new Date(row.schedule_time);
      let setKey = `${rowDate.getFullYear()}-${(rowDate.getMonth() + 1)
        .toString()
        .padStart(2, "0")}-${rowDate.getDate().toString().padStart(2, "0")}`;
      dateKeyData[setKey] = { start: row.start_time, end: row.end_time };
    }

    //過去七日 每日訓練時數
    const dailyLabels = setTimeGroupLabels(date, "daily");
    const dailyFitHours = [];
    dailyLabels.forEach((label) => {
      let fitHours = 0;
      if (dateKeyData[label]) {
        let startTime = new Date(`${label}T${dateKeyData[label].start}`);
        let endTime = new Date(`${label}T${dateKeyData[label].end}`);
        let timeDifference = endTime - startTime;

        fitHours = timeDifference / (1000 * 60 * 60);
        if (fitHours < 0 || isNaN(fitHours)) fitHours = 0;
      }

      dailyFitHours.push({
        date: label,
        hours: fitHours,
      });
    });

    //近四週 每週訓練時數統計
    const weeklyLabels = setTimeGroupLabels(date, "weekly");
    const weeklyHours = [];
    weeklyLabels.forEach((label) => {
      let accumulateHours = 0;
      const weekStart = new Date(label[0]);
      const weekEnd = new Date(label[1]);

      for (let dateKey in dateKeyData) {
        const targetDate = new Date(dateKey);
        if (weekStart <= targetDate && targetDate <= weekEnd) {
          let startTime = new Date(`${dateKey}T${dateKeyData[dateKey].start}`);
          let endTime = new Date(`${dateKey}T${dateKeyData[dateKey].end}`);
          let timeDifference = endTime - startTime;

          fitHours = timeDifference / (1000 * 60 * 60);
          if (fitHours < 0 || isNaN(fitHours)) fitHours = 0;
          accumulateHours += fitHours;
        }
      }

      weeklyHours.push({
        date: label,
        hours: accumulateHours,
      });
    });

    const monthlyLabels = setTimeGroupLabels(date, "monthly");
    const monthlyHours = [];
    monthlyLabels.forEach((label) => {
      let accumulateHours = 0;

      for (let dateKey in dateKeyData) {
        const targetDate = new Date(dateKey);
        const targetDateMonth = targetDate.getMonth() + 1;
        if (targetDateMonth === label) {
          let startTime = new Date(`${dateKey}T${dateKeyData[dateKey].start}`);
          let endTime = new Date(`${dateKey}T${dateKeyData[dateKey].end}`);
          let timeDifference = endTime - startTime;

          fitHours = timeDifference / (1000 * 60 * 60);
          if (fitHours < 0 || isNaN(fitHours)) fitHours = 0;
          accumulateHours += fitHours;
        }
      }

      monthlyHours.push({
        date: label,
        hours: accumulateHours,
      });
    });

    const returnData = {
      daily: dailyFitHours,
      weekly: weeklyHours,
      monthly: monthlyHours,
    };
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
