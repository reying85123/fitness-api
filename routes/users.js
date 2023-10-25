const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const conn = require("../connection.js");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const rules = {
  email:
    /^\w+((-\w+)|(\.\w+)|(\+\w+))*@[A-Za-z0-9]+((\.|-)[A-Za-z0-9]+)*\.[A-Za-z]+$/,
  pwd: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,16}$/,
};
const randomPassword = (length) => {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randomString = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(charset.length);
    randomString += charset.charAt(randomIndex);
  }

  return randomString;
};

//註冊
router.post("/signup", async (req, res) => {
  const email = req.body.email;
  const pwd = req.body.password;

  if (
    email === undefined ||
    pwd === undefined ||
    !rules.email.test(email) ||
    !rules.pwd.test(pwd)
  ) {
    res.status(400).send({
      success: false,
      error: "Bad Request!",
      errorCode: "BAD_REQUEST",
    });
    return;
  }

  //1.輸入帳號密碼註冊
  //加密密碼
  const hashPwd = await bcrypt.hash(pwd, 10);

  //註冊成功id
  let signupId = "";

  try {
    const [singupRows, signupFields] = await conn.execute(
      "INSERT INTO member (email, password) VALUES (?, ?)",
      [email, hashPwd]
    );
    signupId = singupRows.insertId;
  } catch (error) {
    signupId = "";
    if (error.sqlState === "23000") {
      res.status(409).send({
        success: false,
        error: "Email already registered.",
        errorCode: "EMAIL_ALREADY_REGISTERED",
      });
    } else {
      res.status(500).send({
        success: false,
        error: "Internal Server Error.",
        errorCode: "INTERNAL_ERROR",
      });
    }
    return;
  }

  try {
    const [userRow, userFields] = await conn.execute(
      "SELECT id, email From member WHERE id = ?",
      [signupId]
    );

    //回傳jwt
    const token = jwt.sign(
      {
        uid: userRow[0].id,
        email: userRow[0].email,
      },
      process.env.JWT_SCRECT_KEY
    );

    res.status(200).send({
      success: true,
      message: "Account registration successful.",
      token: token,
    });
  } catch (err) {
    res.status(200).send({
      success: true,
      message: "Account registration successful.",
      token: "",
    });
  }
});

//登入
router.post("/login", async (req, res) => {
  const email = req.body.email;
  const pwd = req.body.password;
  if (email === undefined || pwd === undefined || !rules.email.test(email)) {
    res.status(400).send({
      success: false,
      error: "Bad Request!",
      errorCode: "BAD_REQUEST",
    });
    return;
  }

  try {
    const [rows, fields] = await conn.execute(
      "SELECT id, email, password FROM member WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      res.status(401).send({
        success: false,
        error: "Invalid username or password.",
        errorCode: "INVALID_CREDENTIALS",
      });
      return;
    }

    const pwdAuth = await bcrypt.compare(pwd, rows[0].password);
    if (pwdAuth) {
      // 登入驗證成功，回傳JWT
      const profileData = {
        uid: rows[0].id,
        email: rows[0].email,
      };

      const token = jwt.sign(profileData, process.env.JWT_SCRECT_KEY);

      res.status(200).send({
        success: true,
        message: "Login succeeded.",
        token: token,
      });
    } else {
      res.status(401).send({
        success: false,
        error: "Invalid username or password.",
        errorCode: "INVALID_CREDENTIALS",
      });
      return;
    }
  } catch (err) {
    console.log(err);
    res.status(500).send({
      success: false,
      error: "Internal Server Error.",
      errorCode: "INTERNAL_ERROR",
    });
  }
});

//社群註冊 && 登入
router.post("/login-social", async (req, res) => {
  const email = req.body.email;
  const socialId = req.body.socialId;
  const provider = req.body.provider;
  if (email === undefined || socialId === undefined || provider === undefined) {
    res.status(400).send({
      success: false,
      error: "Bad Request!",
      errorCode: "BAD_REQUEST",
    });
    return;
  }

  const userData = {
    bind: false,
    uid: "",
    email: "",
  };

  //1.查詢此socialId是否綁定
  try {
    const [bindUserRow, bindUserField] = await conn.execute(
      "SELECT member.id, member.email FROM member AS member LEFT JOIN member_social AS social ON member.id = social.user_id WHERE social.social_provider = ? AND social.social_id = ?",
      [provider, socialId]
    );
    if (bindUserRow.length === 1) {
      userData.bind = true;
      userData.uid = bindUserRow[0].id;
      userData.email = bindUserRow[0].email;
    } else if (bindUserRow.length > 1) {
      res.status(500).send({
        success: false,
        error: "Internal Server Error.",
        errorCode: "INTERNAL_ERROR",
      });
      return;
    }
  } catch (err) {
    res.status(500).send({
      success: false,
      error: "Internal Server Error.",
      errorCode: "INTERNAL_ERROR",
    });
    return;
  }

  //2.socialId未綁定，則使用此socialId及social email註冊帳號
  if (!userData.bind) {
    try {
      //檢查email格式
      if (!rules.email.test(email)) {
        res.status(400).send({
          success: false,
          error: "Bad Request!",
          errorCode: "BAD_REQUEST",
        });
        return;
      }

      //產生亂數密碼
      const pwd = randomPassword(16);
      const hashPwd = await bcrypt.hash(pwd, 10);

      //新增帳號資料
      const [userRow] = await conn.execute(
        "INSERT INTO member (email, password) VALUES (?, ?)",
        [email, hashPwd]
      );
      const [bindRow] = await conn.execute(
        "INSERT INTO member_social (user_id, social_id, social_provider) VALUES (?, ?, ?)",
        [userRow.insertId, socialId, provider]
      );
      userData.bind = true;
      userData.uid = userRow.insertId;
      userData.email = email;
    } catch (err) {
      if (err.sqlState === "23000") {
        res.status(409).send({
          success: false,
          error: "Email already registered.",
          errorCode: "EMAIL_ALREADY_REGISTERED",
        });
      } else {
        res.status(500).send({
          success: false,
          error: "Internal Server Error.",
          errorCode: "INTERNAL_ERROR",
        });
      }
      return;
    }
  }

  //3.回傳完登入狀態
  if (
    !userData.bind ||
    userData.uid.length <= 0 ||
    userData.email.length <= 0
  ) {
    res.status(500).send({
      success: false,
      error: "Internal Server Error.",
      errorCode: "INTERNAL_ERROR",
    });
    return;
  }

  const profileData = {
    uid: userData.uid,
    email: userData.email,
  };

  const token = jwt.sign(profileData, process.env.JWT_SCRECT_KEY);
  res.status(200).send({
    success: true,
    message: "Login succeeded.",
    token: token,
  });
});

//取得社群綁定狀態
router.get("/bind-social", async (req, res) => {
  const token = req.query.token;
  if (token === undefined) {
    res.status(400).send({
      success: false,
      error: "Bad Request1!",
      errorCode: "BAD_REQUEST",
    });
    return;
  }

  let uid = "";

  jwt.verify(token, process.env.JWT_SCRECT_KEY, (err, data) => {
    if (err) {
      res.status(400).send({
        success: false,
        error: "Bad Request!",
        errorCode: "BAD_REQUEST",
      });
      return;
    }

    uid = data.uid;
  });

  try {
    const [allBindRows] = await conn.execute(
      "SELECT * FROM member_social WHERE user_id = ?",
      [uid]
    );
    const bindSocial = {
      Facebook: false,
      Line: false,
    };
    allBindRows.forEach((element) => {
      if (bindSocial[element.social_provider] !== undefined) {
        bindSocial[element.social_provider] = true;
      }
    });

    res.status(200).send({
      success: true,
      message: "Retrieve binding information succeeded.",
      bind: bindSocial,
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

//社群綁定
router.post("/bind-social", async (req, res) => {
  const token = req.body.token;
  const socialId = req.body.socialId;
  const provider = req.body.provider;

  if (token === undefined || socialId === undefined || provider === undefined) {
    res.status(400).send({
      success: false,
      error: "Bad Request!",
      errorCode: "BAD_REQUEST",
    });
    return;
  }

  const userData = {
    email: "",
    uid: "",
  };
  //驗證jwt
  jwt.verify(token, process.env.JWT_SCRECT_KEY, (err, data) => {
    if (err) {
      res.status(400).send({
        success: false,
        error: "Bad Request!",
        errorCode: "BAD_REQUEST",
      });
      return;
    }
    userData.email = data.email;
    userData.uid = data.uid;
  });

  //查詢此socialId是否綁定
  try {
    const [bindUserRow, bindUserField] = await conn.execute(
      "SELECT member.id, member.email FROM member AS member LEFT JOIN member_social AS social ON member.id = social.user_id WHERE social.social_provider = ? AND social.social_id = ?",
      [provider, socialId]
    );
    if (bindUserRow.length > 0) {
      //有綁定，回傳此社群帳號已綁定其他帳號
      res.status(409).send({
        success: false,
        error: "Social UID Conflict.",
        errorCode: "SOCIAL_UID_CONFLICT",
      });
      return;
    }
  } catch (err) {
    res.status(500).send({
      success: false,
      error: "Internal Server Error.",
      errorCode: "INTERNAL_ERROR",
    });
    return;
  }

  //無綁定，綁定資料後回傳新的jwt
  try {
    const [bindRow] = await conn.execute(
      "INSERT INTO member_social (user_id, social_id, social_provider) VALUES (?, ?, ?)",
      [userData.uid, socialId, provider]
    );

    res.status(200).send({
      success: true,
      message: "Bind succeeded.",
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

//解除社群綁定
router.delete("/bind-social", async (req, res) => {
  const token = req.body.token;
  const provider = req.body.provider;
  const allProviders = ["Line", "Facebook"];
  if (
    token === undefined ||
    provider === undefined ||
    !allProviders.includes(provider)
  ) {
    res.status(400).send({
      success: false,
      error: "Bad Request!",
      errorCode: "BAD_REQUEST",
    });
    return;
  }

  let uid = "";

  jwt.verify(token, process.env.JWT_SCRECT_KEY, (err, data) => {
    if (err) {
      res.status(400).send({
        success: false,
        error: "Bad Request!",
        errorCode: "BAD_REQUEST",
      });
      return;
    }

    uid = data.uid;
  });

  try {
    const [unbindResult] = await conn.execute(
      "DELETE FROM member_social WHERE user_id = ? AND social_provider = ?",
      [uid, provider]
    );
    if (unbindResult && unbindResult.affectedRows > 0) {
      res.status(200).send({
        success: true,
        message: "Unbind successful.",
      });
      return;
    } else {
      res.status(500).send({
        success: false,
        error: "Internal Server Error.",
        errorCode: "INTERNAL_ERROR",
      });
      return;
    }
  } catch (err) {
    res.status(500).send({
      success: false,
      error: "Internal Server Error.",
      errorCode: "INTERNAL_ERROR",
    });
    return;
  }
});

//驗證
router.get("/profile", async (req, res) => {
  const token = req.query.token;
  if (token === undefined) {
    res.status(400).send({
      success: false,
      error: "Bad Request!",
      errorCode: "BAD_REQUEST",
    });
    return;
  }

  jwt.verify(token, process.env.JWT_SCRECT_KEY, (err, data) => {
    if (err) {
      res.status(400).send({
        success: false,
        error: "Bad Request!",
        errorCode: "BAD_REQUEST",
      });
      return;
    }

    res.status(200).send({
      success: true,
      message: "Verification successful.",
      data: {
        uid: data.uid,
        email: data.email,
      },
    });
  });
});

//重置密碼信件
router.post("/reset-password-mail", async (req, res) => {
  const email = req.body.email;
  if (email === undefined || !rules.email.test(email)) {
    res.status(400).send({
      success: false,
      error: "Bad Request!",
      errorCode: "BAD_REQUEST",
    });
    return;
  }

  let resetEmail = "";

  try {
    const [rows, fields] = await conn.execute(
      "SELECT id, email, password FROM member WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      res.status(404).send({
        success: false,
        error: "User not found.",
        errorCode: "USER_NOT_FOUND",
      });
      return;
    } else {
      resetEmail = rows[0].email;
    }
  } catch (err) {
    console.log(err);
    res.status(500).send({
      success: false,
      error: "Internal Server Error.",
      errorCode: "INTERNAL_ERROR",
    });
    return;
  }

  try {
    const token = crypto.randomBytes(32).toString("hex");
    const [rows, fields] = await conn.execute(
      "UPDATE member SET reset_token = ?, reset_token_time = DATE_ADD(NOW(), INTERVAL 1 DAY) WHERE email = ?",
      [token, resetEmail]
    );

    if (rows) {
      const mailTemplate = (token) => {
        return `
        <div style="background:#CBD5E1;padding-top:40px;padding:40px 10px">
          <table style="margin:0px auto 10px auto;max-width:700px;border-spacing:0">
            <thead>
              <tr>
                <th style="font-size:1.5rem;">
                 Fitness Schedule
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  重設您Fitness Schedule密碼
                </td>
              </tr>
              <tr>
                <td>
                我們收到了您的重設密碼要求。 如要重設密碼，請按下方連結進行設定。重設連結一天內有效。
                </td>
              </tr>
              <tr>
                <td>
                  <div style="text-align:center;padding:20px 0px;">
                    <a href="http://localhost:8080/member/reset?token=${token}" style="width:90px;color:#ffffff;background-color:#0E7490;text-decoration:none;padding:10px 20px;border-radius:8px">重設密碼</a>
                  </div>
                </td>
              </tr>
            </body>
          </table>
        </div>
        `;
      };
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASS,
        },
      });

      await transporter.verify();

      const mailOptions = {
        from: `Fitness Schedule <${process.env.GMAIL_USER}>`,
        to: email,
        subject: "重設您的Fitness Schedule密碼",
        html: mailTemplate(token),
      };

      transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
          console.log(err);
          res.status(500).send({
            success: false,
            error: "Internal Server Error.",
            errorCode: "INTERNAL_ERROR",
          });
          return;
        } else {
          res.status(200).send({
            success: true,
            message: "Password reset email has been sent",
          });
        }
      });
      return;
    }
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

//使用寄信取得連結，重置密碼
router.put("/reset-password", async (req, res) => {
  const token = req.body.token;
  const password = req.body.password;
  if (
    token === undefined ||
    token.length === 0 ||
    password === undefined ||
    !rules.pwd.test(password)
  ) {
    res.status(400).send({
      success: false,
      error: "Bad Request!",
      errorCode: "BAD_REQUEST",
    });
    return;
  }

  //加密密碼
  const hashPwd = await bcrypt.hash(password, 10);

  let userId = "";
  try {
    const [userRows, userFieldsfields] = await conn.execute(
      "SELECT id FROM member WHERE reset_token = ? AND reset_token_time > CURRENT_TIMESTAMP",
      [token]
    );
    if (userRows.length === 1) {
      userId = userRows[0].id;
    } else {
      res.status(401).send({
        success: false,
        error: "Token has expired.",
        errorCode: "TOKEN_EXPIRED",
      });
      return;
    }
  } catch (err) {
    res.status(500).send({
      success: false,
      error: "Internal Server Error.",
      errorCode: "INTERNAL_ERROR",
    });
    return;
  }
  try {
    const [updateRows, updateFieldsfields] = await conn.execute(
      "UPDATE member SET password = ?,reset_token = NULL, reset_token_time = NOW() WHERE id = ?",
      [hashPwd, userId]
    );
    if (updateRows) {
      res.status(200).send({
        success: true,
        message: "Password has been reset.",
      });
      return;
    }
  } catch (err) {
    res.status(500).send({
      success: false,
      error: "Internal Server Error.",
      errorCode: "INTERNAL_ERROR",
    });
    return;
  }
});

//登入帳號後，於設定修改密碼
router.put("/change-password", async (req, res) => {
  const token = req.body.token;
  const oldPassword = req.body.oldPassword;
  const newPassword = req.body.newPassword;
  if (
    token === undefined ||
    token.length === 0 ||
    oldPassword === undefined ||
    oldPassword.length === 0 ||
    newPassword === undefined ||
    newPassword.length === 0 ||
    !rules.pwd.test(newPassword)
  ) {
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
  jwt.verify(token, process.env.JWT_SCRECT_KEY, (err, data) => {
    if (err) {
      res.status(400).send({
        success: false,
        error: "Bad Request!",
        errorCode: "BAD_REQUEST",
      });
      return;
    }
    userData.email = data.email;
    userData.uid = data.uid;
  });

  //檢查舊密碼
  try {
    const [userRows] = await conn.execute(
      "SELECT id, email, password FROM member WHERE id = ? AND email = ?",
      [userData.uid, userData.email]
    );

    if (userRows.length === 0) {
      res.status(401).send({
        success: false,
        error: "Invalid token.",
        errorCode: "INVALID_TOKEN",
      });
      return;
    }
    const pwdAuth = await bcrypt.compare(oldPassword, userRows[0].password);
    if (!pwdAuth) {
      res.status(401).send({
        success: false,
        error: "Invalid password.",
        errorCode: "INVALID_CREDENTIALS",
      });
      return;
    }
  } catch (err) {
    console.log(err);
    res.status(500).send({
      success: false,
      error: "Internal Server Error.",
      errorCode: "INTERNAL_ERROR",
    });
    return;
  }

  //修改密碼
  try {
    //加密密碼
    const hashPwd = await bcrypt.hash(newPassword, 10);
    const [updateRows, updateFieldsfields] = await conn.execute(
      "UPDATE member SET password = ?, reset_token = NULL, reset_token_time = NOW() WHERE id = ?",
      [hashPwd, userData.uid]
    );
    if (updateRows) {
      res.status(200).send({
        success: true,
        message: "Password has been reset.",
      });
      return;
    }
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
