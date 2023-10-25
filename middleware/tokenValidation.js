const jwt = require("jsonwebtoken");
const tokenValidation = (token) => {
  let verifyResult = false;
  let jwtData = {};
  jwt.verify(token, process.env.JWT_SCRECT_KEY, (err, data) => {
    if (err) {
      verifyResult = false;
    }
    verifyResult = true;
    jwtData = {
      email: data.email,
      uid: data.uid,
    };
  });

  return [verifyResult, jwtData];
};

module.exports = tokenValidation;
