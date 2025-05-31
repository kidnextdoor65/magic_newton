const fs = require("fs");
const colors = require("colors");
const path = require("path");
require("dotenv").config();
const { jwtDecode } = require("jwt-decode");
const fsPromises = require("fs").promises; // Sử dụng fs.promises
const AsyncLock = require("async-lock");
const lock = new AsyncLock();

function _isArray(obj) {
  if (Array.isArray(obj) && obj.length > 0) {
    return true;
  }

  try {
    const parsedObj = JSON.parse(obj);
    return Array.isArray(parsedObj) && parsedObj.length > 0;
  } catch (e) {
    return false;
  }
}

function parseQueryString(query) {
  const params = new URLSearchParams(query);
  const parsedQuery = {};

  for (const [key, value] of params) {
    parsedQuery[key] = decodeURIComponent(value);
  }

  return parsedQuery;
}

function splitIdPet(num) {
  const numStr = num.toString();
  const firstPart = numStr.slice(0, 3); // Lấy 3 ký tự đầu tiên
  const secondPart = numStr.slice(3); // Lấy phần còn lại

  return [parseInt(firstPart), parseInt(secondPart)];
}

// Hàm để ghi đè biến môi trường
const envFilePath = path.join(__dirname, ".env"); // Đảm bảo .env ở cùng thư mục với utils.js nếu muốn dùng chức năng này
function updateEnv(variable, value) {
  // Đọc file .env
  fs.readFile(envFilePath, "utf8", (err, data) => {
    if (err) {
      console.log("Không thể đọc file .env:", err);
      return;
    }

    // Tạo hoặc cập nhật biến trong file
    const regex = new RegExp(`^${variable}=.*`, "m");
    let newData = data.replace(regex, `${variable}=${value}`); // Sử dụng let thay vì const

    // Kiểm tra nếu biến không tồn tại trong file, thêm vào cuối
    if (!regex.test(data)) {
      newData += `\n${variable}=${value}`;
    }

    // Ghi lại file .env
    fs.writeFile(envFilePath, newData, "utf8", (err) => {
      if (err) {
        console.error("Không thể ghi file .env:", err);
      } else {
        // console.log(`Đã cập nhật ${variable} thành ${value}`);
      }
    });
  });
}

async function sleep(seconds = null) {
  let min, max;
  if (seconds && typeof seconds === "number") {
    // Nếu seconds là một số, đợi đúng số giây đó
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  } else if (seconds && Array.isArray(seconds) && seconds.length === 2) {
    // Nếu seconds là một mảng [min, max]
    min = seconds[0];
    max = seconds[1];
  } else {
    // Mặc định hoặc nếu seconds không hợp lệ
    min = 1; // Giả sử giá trị mặc định nếu không có trong settings
    max = 5;
    // Nếu bạn muốn lấy từ settings, bạn cần truyền settings vào đây hoặc đọc trực tiếp process.env
    // Ví dụ:
    // const delayConfig = (process.env.DELAY_BETWEEN_REQUESTS && _isArray(process.env.DELAY_BETWEEN_REQUESTS))
    //                      ? JSON.parse(process.env.DELAY_BETWEEN_REQUESTS)
    //                      : [1, 5];
    // min = delayConfig[0];
    // max = delayConfig[1];
  }

  return await new Promise((resolve) => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    setTimeout(resolve, delay * 1000);
  });
}

function randomDelay() {
  // Hàm này có vẻ không được dùng trong main.js hiện tại
  return new Promise((resolve) => {
    // Cần đảm bảo DELAY_REQUEST_API được định nghĩa trong .env nếu dùng hàm này
    const minDelay = process.env.DELAY_REQUEST_API_MIN
      ? parseInt(process.env.DELAY_REQUEST_API_MIN)
      : 1;
    const maxDelay = process.env.DELAY_REQUEST_API_MAX
      ? parseInt(process.env.DELAY_REQUEST_API_MAX)
      : 5;
    const delay =
      Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    setTimeout(resolve, delay * 1000);
  });
}

// Các hàm liên quan đến tokens.json (quản lý JWT)
// Hiện tại main.js không sử dụng các hàm này vì nó dùng data.txt cho NextAuth tokens.
function saveToken(id, token) {
  try {
    const tokens = JSON.parse(fs.readFileSync("tokens.json", "utf8"));
    tokens[id] = token;
    fs.writeFileSync("tokens.json", JSON.stringify(tokens, null, 4));
  } catch (e) {
    fs.writeFileSync("tokens.json", JSON.stringify({ [id]: token }, null, 4));
  }
}

function getToken(id) {
  try {
    const tokens = JSON.parse(fs.readFileSync("tokens.json", "utf8"));
    return tokens[id] || null;
  } catch (e) {
    return null;
  }
}

function isTokenExpired(token) {
  if (!token)
    return { isExpired: true, expirationDate: new Date().toLocaleString() };
  try {
    const payload = jwtDecode(token); // Cần cài đặt jwt-decode: npm install jwt-decode
    if (!payload || typeof payload.exp === "undefined")
      return { isExpired: true, expirationDate: new Date().toLocaleString() };
    const now = Math.floor(Date.now() / 1000);
    const expirationDate = new Date(payload.exp * 1000).toLocaleString();
    const isExpired = now > payload.exp;
    return { isExpired, expirationDate };
  } catch (error) {
    log(`Error checking token: ${error.message}`, "error");
    return { isExpired: true, expirationDate: new Date().toLocaleString() };
  }
}
// Kết thúc các hàm liên quan đến tokens.json

function generateRandomHash() {
  const characters = "0123456789abcdef";
  let hash = "0x";
  for (let i = 0; i < 64; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    hash += characters[randomIndex];
  }
  return hash;
}

function getRandomElement(arr) {
  if (!arr || arr.length === 0) return undefined;
  const randomIndex = Math.floor(Math.random() * arr.length);
  return arr[randomIndex];
}

function getRandomNumber(min, max, fix = 2) {
  return Number((Math.random() * (max - min) + min).toFixed(fix));
}

function loadData(file) {
  try {
    const datas = fs
      .readFileSync(file, "utf8")
      .replace(/\r/g, "")
      .split("\n")
      .filter(Boolean);
    return datas; // Trả về mảng rỗng nếu file rỗng hoặc chỉ có dòng trống
  } catch (error) {
    log(`Không tìm thấy file ${file}`, "error"); // Sử dụng hàm log đã định nghĩa
    return [];
  }
}

async function saveData(data, filename) {
  // Đổi tên tham số để tránh nhầm lẫn với biến data bên ngoài
  try {
    await fsPromises.writeFile(filename, data.join("\n"));
  } catch (error) {
    log(`Lỗi khi lưu file ${filename}: ${error.message}`, "error");
  }
}

function log(msg, type = "info") {
  // Hàm log này đã được tích hợp vào main.js
  const timestamp = new Date().toLocaleTimeString();
  const typeChar = type.charAt(0).toUpperCase();
  // Sử dụng colors trực tiếp thay vì gọi lại chính nó
  const colorFunctions = {
    S: colors.green,
    C: colors.magenta,
    E: colors.red,
    W: colors.yellow,
    I: colors.blue,
    D: colors.grey,
  };
  const logFn = colorFunctions[typeChar] || colors.blue; // Mặc định là info (blue)

  // Sử dụng console.log để tương thích với việc ghi log cơ bản
  // Nếu bạn muốn các prefix [S], [C], v.v. thì cần giữ lại logic đó
  console.log(logFn(`[${timestamp}] [${typeChar}] ${msg}`));
}

async function saveJson(id, value, filename) {
  await lock.acquire("fileLock", async () => {
    // Cần cài đặt async-lock: npm install async-lock
    try {
      let jsonData = {};
      try {
        const dataFile = await fsPromises.readFile(filename, "utf8");
        jsonData = JSON.parse(dataFile);
      } catch (readError) {
        // File không tồn tại hoặc không phải JSON hợp lệ, bắt đầu với object rỗng
      }
      jsonData[id] = value;
      await fsPromises.writeFile(filename, JSON.stringify(jsonData, null, 4));
    } catch (error) {
      log(`Error saving JSON to ${filename}: ${error.message}`, "error");
    }
  });
}

function getItem(id, filename) {
  try {
    const data = JSON.parse(fs.readFileSync(filename, "utf8"));
    return data[id] || null;
  } catch (e) {
    return null; // Trả về null nếu file không tồn tại hoặc lỗi parse
  }
}

function getOrCreateJSON(id, value, filename) {
  let item = getItem(id, filename);
  if (item) {
    return item;
  }
  // saveJson là async, việc gán trực tiếp kết quả có thể không như mong đợi
  // Nên tách logic tạo nếu cần giá trị trả về ngay lập tức
  saveJson(id, value, filename); // Gọi saveJson nhưng không chờ
  return value; // Trả về giá trị mặc định đã được truyền vào
}

function generateComplexId(length = 9) {
  const chars = "0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateRandomNumber(length) {
  if (length < 1) return null;
  const firstDigit = Math.floor(Math.random() * 4) + 1;
  let number = firstDigit.toString();
  for (let i = 1; i < length; i++) {
    number += Math.floor(Math.random() * 10);
  }
  return number;
}

function getRandomNineDigitNumber() {
  const min = 100000000;
  const max = 999999999;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Hàm decodeJWT này cần 'atob' có sẵn trong môi trường Node.js
// Node.js không có atob/btoa toàn cục như trình duyệt. Bạn cần dùng Buffer.
function decodeJWT_node(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT token format");
    }
    const [_header, payload, _signature] = parts;

    const decodedPayload = JSON.parse(
      Buffer.from(
        payload.replace(/-/g, "+").replace(/_/g, "/"),
        "base64"
      ).toString()
    );

    return {
      // header: decodedHeader, // Tương tự cho header nếu cần
      payload: decodedPayload,
      // signature: signature,
    };
  } catch (e) {
    log(`Error decoding JWT: ${e.message}`, "error");
    return null;
  }
}

module.exports = {
  _isArray,
  saveJson,
  decodeJWT: decodeJWT_node, // Sử dụng phiên bản Node.js
  generateComplexId,
  getRandomNumber,
  updateEnv,
  saveToken,
  splitIdPet,
  getToken,
  isTokenExpired, // Hàm này sử dụng jwtDecode, đảm bảo jwt-decode đã được cài đặt
  generateRandomHash,
  getRandomElement,
  loadData,
  saveData,
  log,
  getOrCreateJSON,
  sleep,
  randomDelay, // Hàm này có vẻ chưa được sử dụng và dựa vào biến môi trường chưa xác định
  parseQueryString,
  getRandomNineDigitNumber,
  generateRandomNumber,
};
