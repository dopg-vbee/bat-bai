/** "12.345": one shared formatter (toLocaleString builds a new one on every call, every frame of a count-up). */
export const formatPoints = new Intl.NumberFormat('vi-VN').format;
