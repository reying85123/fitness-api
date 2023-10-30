const setTimeGroupLabels = (initDate, timeGroup) => {
  const currentDate = new Date(initDate);
  let returnLabel = [];
  switch (timeGroup) {
    case "daily":
      for (let i = 7 - 1; i >= 0; i--) {
        const pastDate = new Date(currentDate);
        pastDate.setDate(currentDate.getDate() - i);
        const formattedDate = `${pastDate.getFullYear()}-${
          pastDate.getMonth() + 1
        }-${pastDate.getDate()}`;
        returnLabel.push(formattedDate);
      }
      break;
    case "weekly":
      for (let i = 0; i < 4; i++) {
        const startDate = new Date(currentDate);
        startDate.setDate(currentDate.getDate() - i * 7);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);

        const formattedStartDate = `${startDate.getFullYear()}-${
          startDate.getMonth() + 1
        }-${startDate.getDate()}`;
        const formattedEndDate = `${endDate.getFullYear()}-${
          endDate.getMonth() + 1
        }-${endDate.getDate()}`;
        const dateRange = [formattedStartDate, formattedEndDate];

        returnLabel.push(dateRange);
      }
      returnLabel.reverse();
      break;
    case "monthly":
      for (let i = 2; i >= 0; i--) {
        const pastMonth = new Date(currentDate);
        pastMonth.setMonth(pastMonth.getMonth() - i);

        const month = pastMonth.getMonth() + 1;
        returnLabel.push(month);
      }
  }

  return returnLabel;
};

module.exports = setTimeGroupLabels;
