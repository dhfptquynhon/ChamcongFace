export const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateString;
  }
};

export const formatTime = (time) => {
  if (!time) return '--:--';
  if (typeof time === 'string') {
    const match = time.match(/(\d{1,2}):(\d{1,2})/);
    if (match) {
      const hours = match[1].padStart(2, '0');
      const minutes = match[2].padStart(2, '0');
      return `${hours}:${minutes}`;
    }
  }
  return time;
};

export const getCurrentMonthYear = () => {
  const today = new Date();
  return {
    month: today.getMonth() + 1,
    year: today.getFullYear()
  };
};

export const getDaysInMonth = (month, year) => {
  return new Date(year, month, 0).getDate();
};