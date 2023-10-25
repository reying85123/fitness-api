const validDate = (date) => {
  //日期格式 YYYY-MM-DD
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (!datePattern.test(date)) {
    return false;
  }

  const dateParts = date.split("-");
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10);
  const day = parseInt(dateParts[2], 10);

  if (
    year < 1000 ||
    year > 9999 ||
    month === 0 ||
    month > 12 ||
    day === 0 ||
    day > 31
  ) {
    return false;
  }

  if ((month === 4 || month === 6 || month === 9 || month === 11) && day > 30) {
    return false;
  }

  if (month === 2) {
    if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) {
      if (day > 29) {
        return false;
      }
    } else if (day > 28) {
      return false;
    }
  }

  // 今天日期
  const today = new Date();
  const inputDate = new Date(year, month - 1, day); 

  // 檢查是否大於今天
  if (inputDate > today) {
    return false;
  }

  return true;
};

module.exports = validDate;
