let lastPointClickTime = 0;

export const markPointClicked = () => {
  lastPointClickTime = Date.now();
};

export const isRecentPointClick = () => {
  return Date.now() - lastPointClickTime < 100;
};
