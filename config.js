// config.js
require("dotenv").config();
// Giả sử utils.js nằm cùng thư mục với config.js
// Nếu bạn không có hàm _isArray hoặc tệp utils.js, bạn cần xử lý các dòng sử dụng nó.
const { _isArray } = require("./utils.js"); // Đảm bảo đường dẫn này đúng

const settings = {
  // Các cài đặt từ tệp config.js gốc của bạn (giữ lại nếu cần)
  TIME_SLEEP: process.env.TIME_SLEEP ? parseInt(process.env.TIME_SLEEP) : 1441, // Mặc định 24h + 1 phút
  MAX_THEADS: process.env.MAX_THEADS ? parseInt(process.env.MAX_THEADS) : 1, // main.js hiện tại chạy tuần tự
  // ... (giữ lại các biến khác từ config.js gốc của bạn nếu bạn dùng chúng) ...
  USE_PROXY: process.env.USE_PROXY
    ? process.env.USE_PROXY.toLowerCase() === "true"
    : false,

  // Các biến môi trường mới cho Magic Newton (thêm vào .env của bạn)
  MN_BASE_URL_AUTH_SESSION:
    process.env.MN_BASE_URL_AUTH_SESSION ||
    "https://www.magicnewton.com/portal/api/auth/session",
  MN_BASE_URL_USER:
    process.env.MN_BASE_URL_USER ||
    "https://www.magicnewton.com/portal/api/user",
  MN_BASE_URL_QUESTS:
    process.env.MN_BASE_URL_QUESTS ||
    "https://www.magicnewton.com/portal/api/quests",
  MN_BASE_URL_USER_QUESTS:
    process.env.MN_BASE_URL_USER_QUESTS ||
    "https://www.magicnewton.com/portal/api/userQuests",

  MN_MIN_DELAY_AFTER_AUTH_MS: process.env.MN_MIN_DELAY_AFTER_AUTH_MS
    ? parseInt(process.env.MN_MIN_DELAY_AFTER_AUTH_MS)
    : 12000,
  MN_MAX_DELAY_AFTER_AUTH_MS: process.env.MN_MAX_DELAY_AFTER_AUTH_MS
    ? parseInt(process.env.MN_MAX_DELAY_AFTER_AUTH_MS)
    : 20000,

  MN_MIN_DELAY_BEFORE_DICE_POST_MS: process.env.MN_MIN_DELAY_BEFORE_DICE_POST_MS
    ? parseInt(process.env.MN_MIN_DELAY_BEFORE_DICE_POST_MS)
    : 2000,
  MN_MAX_DELAY_BEFORE_DICE_POST_MS: process.env.MN_MAX_DELAY_BEFORE_DICE_POST_MS
    ? parseInt(process.env.MN_MAX_DELAY_BEFORE_DICE_POST_MS)
    : 5000,

  MN_DELAY_BETWEEN_ACCOUNTS_MS: process.env.MN_DELAY_BETWEEN_ACCOUNTS_MS
    ? parseInt(process.env.MN_DELAY_BETWEEN_ACCOUNTS_MS)
    : 15000,

  MN_MIN_CYCLE_WAIT_MINUTES: process.env.MN_MIN_CYCLE_WAIT_MINUTES
    ? parseInt(process.env.MN_MIN_CYCLE_WAIT_MINUTES)
    : 30,

  MN_MAX_API_GET_RETRIES: process.env.MN_MAX_API_GET_RETRIES
    ? parseInt(process.env.MN_MAX_API_GET_RETRIES)
    : 3,
  MN_MAX_DICE_PROCESS_RETRIES_BASE: process.env.MN_MAX_DICE_PROCESS_RETRIES_BASE
    ? parseInt(process.env.MN_MAX_DICE_PROCESS_RETRIES_BASE)
    : 1,

  // Các biến từ config.js gốc có thể cần ánh xạ hoặc không dùng nếu main.js không xử lý
  // Ví dụ: DELAY_BETWEEN_REQUESTS, DELAY_TASK - main.js hiện có các delay cụ thể hơn
  // Nếu bạn muốn dùng chúng, cần sửa main.js để đọc và sử dụng các biến này từ settings.
  // Ví dụ, nếu DELAY_BETWEEN_REQUESTS là một mảng [min, max] giây:
  DELAY_BETWEEN_REQUESTS_SECONDS:
    process.env.DELAY_BETWEEN_REQUESTS &&
    _isArray(process.env.DELAY_BETWEEN_REQUESTS)
      ? JSON.parse(process.env.DELAY_BETWEEN_REQUESTS)
      : [5, 10], // Mặc định 5-10 giây
};

// Các biến còn lại từ tệp config.js gốc của bạn có thể giữ nguyên ở đây
// ... (ví dụ: MAX_LEVEL_SPEED, AMOUNT_REF, SKIP_TASKS, v.v.)
// Đảm bảo rằng _isArray được sử dụng đúng cách nếu bạn giữ lại các biến môi trường dạng mảng.
// Ví dụ:
// settings.SKIP_TASKS = process.env.SKIP_TASKS && _isArray(process.env.SKIP_TASKS)
//                         ? JSON.parse(process.env.SKIP_TASKS.replace(/'/g, '"'))
//                         : [];

// Quan trọng: Kiểm tra lại tất cả các biến bạn thực sự cần và cách chúng được đọc/parse.

module.exports = settings;
