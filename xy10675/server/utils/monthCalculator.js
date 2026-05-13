const calculateMonthAge = (birthday) => {
  const birthDate = new Date(birthday);
  const today = new Date();
  
  let months = (today.getFullYear() - birthDate.getFullYear()) * 12;
  months += today.getMonth() - birthDate.getMonth();
  
  if (today.getDate() < birthDate.getDate()) {
    months--;
  }
  
  return Math.max(0, months);
};

const checkMonthEligibility = (birthday, minMonth, maxMonth) => {
  const monthAge = calculateMonthAge(birthday);
  return {
    monthAge,
    eligible: monthAge >= minMonth && monthAge <= maxMonth,
    minMonth,
    maxMonth
  };
};

module.exports = { calculateMonthAge, checkMonthEligibility };
