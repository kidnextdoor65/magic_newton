// main.js
const settings = require("./config.js");
const userAgents = require("./userAgents.js");
const { sleep, log: utilLog } = require("./utils.js");

const fs = require("fs");
const colors = require("colors");
const readline = require("readline");
const { DateTime } = require("luxon");

function parseSetCookie(cookiesHeader) {
  const cookies = {};
  if (cookiesHeader && Array.isArray(cookiesHeader)) {
    cookiesHeader.forEach((cookieStr) => {
      const parts = cookieStr.split(";")[0].split("=");
      if (parts.length >= 2) {
        cookies[parts[0]] = parts.slice(1).join("=");
      }
    });
  } else if (typeof cookiesHeader === "string") {
    const parts = cookiesHeader.split(";")[0].split("=");
    if (parts.length >= 2) {
      cookies[parts[0]] = parts.slice(1).join("=");
    }
  }
  return cookies;
}

class MagicNewtonAPIClient {
  constructor() {
    this.settings = settings;
    this.baseHeaders = {
      Accept: "*/*",
      "Accept-Language": this.settings.ACCEPT_LANGUAGE || "en-US,en;q=0.9",
      "Content-Type": "application/json",
      Dnt: "1",
    };
    this.proxies = [];
    if (this.settings.USE_PROXY) {
      this.loadProxies();
    }
    this.gotScraping = null;
  }

  async initializeGotScraping() {
    if (!this.gotScraping) {
      try {
        const gotScrapingModule = await import("got-scraping");
        this.gotScraping = gotScrapingModule.gotScraping;
        if (!this.gotScraping) {
          throw new Error("Failed to access 'gotScraping' named export.");
        }
        utilLog("got-scraping loaded successfully.", "info");
      } catch (e) {
        utilLog(`Failed to load got-scraping: ${e.message}.`, "error");
        throw e;
      }
    }
  }

  loadProxies() {
    try {
      this.proxies = fs
        .readFileSync("proxy.txt", "utf8")
        .replace(/\r/g, "")
        .split("\n")
        .filter(Boolean)
        .map((p) =>
          p.startsWith("http://") || p.startsWith("https://")
            ? p
            : `http://${p}`
        );
    } catch (error) {
      utilLog(
        "No proxy.txt found or error loading. Running without proxies if USE_PROXY is false.",
        "warning"
      );
      this.proxies = [];
    }
  }

  getGotScrapingOptions(
    currentSessionToken,
    currentCsrfToken,
    proxyIndex,
    referer = "https://www.magicnewton.com/portal/rewards",
    isPost = false,
    payload = null
  ) {
    const selectedUserAgent =
      userAgents[Math.floor(Math.random() * userAgents.length)];
    const headers = {
      ...this.baseHeaders,
      "User-Agent": selectedUserAgent,
      Referer: referer,
      Origin: "https://www.magicnewton.com",
    };
    if (currentSessionToken && currentCsrfToken) {
      const gaCookie = "_ga=GA1.1.640883127.1738150204";
      const wagmiStoreCookie =
        'wagmi.store={"state":{"connections":{"__type":"Map","value":[]},"chainId":1,"current":null},"version":2}';
      const csrfTokenCookie = `__Host-next-auth.csrf-token=${currentCsrfToken}`;
      const callbackUrlCookie =
        "__Secure-next-auth.callback-url=https%3A%2F%2Fportal.magicnewton.com";
      const ga2BFPMRZ2M3Cookie =
        "_ga_2BFPMRZ2M3=GS2.1.s1748525959$o20$g0$t1748525959$j60$l0$h0";
      const sessionTokenCookie = `__Secure-next-auth.session-token=${currentSessionToken}`;
      const htjsAnonymousIdCookie =
        "htjs_anonymous_id=44ad88f9-4d09-4d1e-bc3f-c22bdf901ca6";
      const htjsSeshCookie =
        'htjs_sesh={"id":1748523144789,"expiresAt":1748524944789,"timeout":1800000,"sessionStart":true,"autoTrack":true}';
      const clckCookie = "_clck=atmp19|2|fwb|0|1975";
      const clskCookie = "_clsk=eupccn|1748523146713|1|1|n.clarity.ms/collect";
      headers.Cookie = [
        gaCookie,
        wagmiStoreCookie,
        csrfTokenCookie,
        callbackUrlCookie,
        htjsAnonymousIdCookie,
        htjsSeshCookie,
        clckCookie,
        clskCookie,
        ga2BFPMRZ2M3Cookie,
        sessionTokenCookie,
      ].join("; ");
    } else {
      utilLog(
        "CRITICAL: Missing sessionToken or csrfToken for API request options!",
        "error"
      );
    }
    const options = {
      headers: headers,
      http2: true,
      timeout: { request: this.settings.TIMEOUT_REQUEST || 20000 },
      retry: { limit: 0 },
    };
    const proxyToUse =
      this.settings.USE_PROXY &&
      this.proxies.length > 0 &&
      proxyIndex !== null &&
      this.proxies[proxyIndex]
        ? this.proxies[proxyIndex]
        : null;
    if (proxyToUse) options.proxyUrl = proxyToUse;
    if (isPost && payload) options.json = payload;
    return options;
  }

  async countdown(seconds) {
    for (let i = seconds; i > 0; i--) {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(
        colors.cyan(`[${new Date().toLocaleTimeString()}] [*] Chờ ${i} giây...`)
      );
      await sleep(1); // Sử dụng sleep từ utils
    }
    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 0);
  }

  async checkProxyIP(proxy) {
    if (!this.gotScraping) {
      try {
        await this.initializeGotScraping();
      } catch (e) {
        return "Error (gotScraping init failed)";
      }
    }
    try {
      const response = await this.gotScraping.get(
        "https://api.ipify.org?format=json",
        {
          proxyUrl:
            proxy.startsWith("http://") || proxy.startsWith("https://")
              ? proxy
              : `http://${proxy}`,
          timeout: { request: 10000 },
        }
      );
      const data = JSON.parse(response.body);
      return data.ip || "Unknown";
    } catch (error) {
      return "Error";
    }
  }

  async processAccount(
    initialSessionToken,
    initialCsrfToken,
    proxyIndexInLoop
  ) {
    if (!this.gotScraping) {
      utilLog("got-scraping not initialized!", "error");
      return {
        success: false,
        nextRollTime: DateTime.now().plus({ hours: 24, minutes: 1 }),
        diceCompletedForToday: false,
      };
    }
    if (!initialSessionToken || !initialCsrfToken) {
      utilLog("Missing initial session or CSRF token.", "error");
      return {
        success: false,
        nextRollTime: DateTime.now().plus({ hours: 24, minutes: 1 }),
        diceCompletedForToday: false,
      };
    }

    let proxyIP = "No proxy";
    if (this.settings.USE_PROXY && this.proxies.length > 0) {
      // Check if proxies array is not empty
      const proxyToUseCheck =
        proxyIndexInLoop !== null
          ? this.proxies[proxyIndexInLoop % this.proxies.length]
          : null;
      if (proxyToUseCheck) proxyIP = await this.checkProxyIP(proxyToUseCheck);
      else proxyIP = "No proxy available for this specific account index";
    }
    utilLog(
      `Using IP: ${proxyIP} for account. Session: ...${initialSessionToken.slice(
        -10
      )}, CSRF: ...${initialCsrfToken.slice(-10)}`,
      "custom"
    );

    let currentSessionToken = initialSessionToken;
    let currentCsrfToken = initialCsrfToken;
    let nextRollTimeForThisAccount = DateTime.now().plus({
      hours: 24,
      minutes: 1,
    });
    let accountOverallSuccess = false;
    let diceRollActuallyCompletedToday = false;

    let authSessionSuccess = false;
    const maxAuthRetries = this.settings.MAX_AUTH_SESSION_RETRIES || 3;
    for (
      let authAttempt = 1;
      authAttempt <= maxAuthRetries && !authSessionSuccess;
      authAttempt++
    ) {
      const authSessionResult = await this._makeApiRequest(
        "GET",
        this.settings.MN_BASE_URL_AUTH_SESSION,
        currentSessionToken,
        currentCsrfToken,
        proxyIndexInLoop,
        "https://www.magicnewton.com/portal/rewards",
        null,
        1
      ); // No retry inside _make, handle here
      if (
        authSessionResult.success &&
        authSessionResult.fullResponseData &&
        authSessionResult.fullResponseData.user
      ) {
        utilLog(
          `/api/auth/session call successful (attempt ${authAttempt}). User: ${authSessionResult.fullResponseData.user.email}`,
          "success"
        );
        utilLog(
          `Session Data: ${JSON.stringify(
            authSessionResult.fullResponseData
          ).substring(0, 200)}...`,
          "custom"
        );
        authSessionSuccess = true;
        if (authSessionResult.newSessionToken)
          currentSessionToken = authSessionResult.newSessionToken;
        if (authSessionResult.newCsrfToken)
          currentCsrfToken = authSessionResult.newCsrfToken; // Update CSRF if set
      } else if (
        authSessionResult.statusCode === 200 &&
        authSessionResult.fullResponseData &&
        Object.keys(authSessionResult.fullResponseData).length === 0
      ) {
        utilLog(
          "Session data from /api/auth/session is empty {}. Token invalid/expired. No retry.",
          "error"
        );
        return {
          success: false,
          nextRollTime: nextRollTimeForThisAccount,
          diceCompletedForToday: false,
        };
      } else {
        utilLog(
          `/api/auth/session failed (attempt ${authAttempt}). Status: ${authSessionResult.statusCode}, Error: ${authSessionResult.error}`,
          "warning"
        );
        if (
          authAttempt < maxAuthRetries &&
          (authSessionResult.isVercelBlock ||
            authSessionResult.statusCode === 429 ||
            authSessionResult.statusCode >= 500)
        ) {
          const retryDelayS = this.settings.DELAY_BETWEEN_REQUESTS_SECONDS
            ? Math.floor(
                Math.random() *
                  (this.settings.DELAY_BETWEEN_REQUESTS_SECONDS[1] -
                    this.settings.DELAY_BETWEEN_REQUESTS_SECONDS[0] +
                    1)
              ) + this.settings.DELAY_BETWEEN_REQUESTS_SECONDS[0]
            : 10 + Math.random() * 5;
          utilLog(
            `Waiting ${retryDelayS}s before retrying /api/auth/session...`,
            "warning"
          );
          await sleep(retryDelayS);
        } else {
          break;
        }
      }
    }

    if (!authSessionSuccess) {
      utilLog(
        "Failed /api/auth/session after retries. Aborting account.",
        "error"
      );
      return {
        success: false,
        nextRollTime: nextRollTimeForThisAccount,
        diceCompletedForToday: false,
      };
    }

    utilLog(
      `Proceeding with Session: ...${currentSessionToken.slice(
        -10
      )}, CSRF: ...${(currentCsrfToken || "").slice(-10)}`,
      "info"
    );
    const minDelayAfterAuth = this.settings.MN_MIN_DELAY_AFTER_AUTH_MS || 12000;
    const maxDelayAfterAuth = this.settings.MN_MAX_DELAY_AFTER_AUTH_MS || 20000;
    const delayAfterSessionAuth =
      Math.floor(Math.random() * (maxDelayAfterAuth - minDelayAfterAuth + 1)) +
      minDelayAfterAuth;
    utilLog(
      `Waiting random ${delayAfterSessionAuth / 1000}s before next API call...`,
      "info"
    );
    await sleep(delayAfterSessionAuth / 1000);

    try {
      let userDataResult = await this.getUserData(
        currentSessionToken,
        currentCsrfToken,
        proxyIndexInLoop
      );
      if (userDataResult.newSessionToken)
        currentSessionToken = userDataResult.newSessionToken;
      if (userDataResult.newCsrfToken)
        currentCsrfToken = userDataResult.newCsrfToken;

      if (userDataResult.success) {
        const { email, refCode } = userDataResult.data;
        utilLog(`Account: ${email} | Ref Code: ${refCode}`, "custom", true);

        let socialQuestsResult = await this.checkAndPerformSocialQuests(
          currentSessionToken,
          currentCsrfToken,
          proxyIndexInLoop
        );
        if (socialQuestsResult.newSessionToken)
          currentSessionToken = socialQuestsResult.newSessionToken;
        if (socialQuestsResult.newCsrfToken)
          currentCsrfToken = socialQuestsResult.newCsrfToken;

        const diceRollIdResult = await this.getDailyDiceRollId(
          currentSessionToken,
          currentCsrfToken,
          proxyIndexInLoop
        );
        if (diceRollIdResult.newSessionToken)
          currentSessionToken = diceRollIdResult.newSessionToken;
        if (diceRollIdResult.newCsrfToken)
          currentCsrfToken = diceRollIdResult.newCsrfToken;
        const diceRollId = diceRollIdResult.id;

        if (diceRollId) {
          let diceOutcome;
          let diceProcessAttempt = 0;
          const maxOverallDiceRetries =
            Math.floor(
              Math.random() *
                ((this.settings.MN_MAX_DICE_PROCESS_RETRIES_BASE || 1) + 2)
            ) + 1;

          while (
            diceProcessAttempt < maxOverallDiceRetries &&
            !diceRollActuallyCompletedToday
          ) {
            diceProcessAttempt++;
            utilLog(
              `Attempting dice roll process (overall attempt ${diceProcessAttempt}/${maxOverallDiceRetries}) for ID ${diceRollId}`,
              "info"
            );
            diceOutcome = await this.checkAndPerformDiceRoll(
              currentSessionToken,
              currentCsrfToken,
              diceRollId,
              proxyIndexInLoop
            );

            if (diceOutcome.newSessionToken)
              currentSessionToken = diceOutcome.newSessionToken;
            if (diceOutcome.newCsrfToken)
              currentCsrfToken = diceOutcome.newCsrfToken;

            nextRollTimeForThisAccount = diceOutcome.nextRollTime;
            diceRollActuallyCompletedToday = diceOutcome.completedToday;

            if (diceRollActuallyCompletedToday) {
              utilLog(
                `Dice roll marked as completed for today (overall attempt ${diceProcessAttempt}).`,
                "success"
              );
              break;
            } else if (
              diceOutcome.isVercelBlock ||
              diceOutcome.isNetworkError
            ) {
              utilLog(
                `Dice roll process failed (Vercel/Network error). Attempt ${diceProcessAttempt}/${maxOverallDiceRetries}.`,
                "warning"
              );
              if (diceProcessAttempt < maxOverallDiceRetries) {
                const retryDiceDelayS = 15 + Math.random() * 15;
                utilLog(
                  `Retrying entire dice roll process in ${Math.round(
                    retryDiceDelayS
                  )}s...`,
                  "warning"
                );
                await sleep(retryDiceDelayS);
              }
            } else {
              utilLog(
                `Dice roll process did not complete (attempt ${diceProcessAttempt}), not a Vercel/Network error or not eligible. Not retrying further.`,
                "info"
              );
              break;
            }
          }
          if (!diceRollActuallyCompletedToday) {
            utilLog(
              `Dice roll was not completed for today after all ${maxOverallDiceRetries} attempts.`,
              "warning"
            );
          }
        } else {
          utilLog("Could not get Dice Roll ID after all attempts.", "error");
          nextRollTimeForThisAccount = DateTime.now().plus({
            hours: 24,
            minutes: 1,
          });
        }
        accountOverallSuccess = true;
      } else {
        utilLog(`Failed to fetch user data: ${userDataResult.error}`, "error");
      }
    } catch (error) {
      utilLog(
        `Critical error in processAccount API calls: ${error.name} - ${error.message}`,
        "error"
      );
      if (error.response?.statusCode) {
        utilLog(
          `Status: ${
            error.response.statusCode
          }, Body: ${error.response.body?.slice(0, 300)}`,
          "error"
        );
      }
    }
    return {
      success: accountOverallSuccess,
      nextRollTime: nextRollTimeForThisAccount,
      diceCompletedForToday: diceRollActuallyCompletedToday,
    };
  }

  async _makeApiRequest(
    method,
    url,
    sessionToken,
    csrfToken,
    proxyIndex,
    referer,
    payload = null,
    maxRetries = 1,
    currentAttempt = 1
  ) {
    if (!this.gotScraping) await this.initializeGotScraping();
    let newLocalSessionToken = sessionToken;
    let newLocalCsrfToken = csrfToken;
    let responseBody = "";
    let isVercelBlock = false;
    let isNetworkError = false;
    let isQuestAlreadyCompletedError = false;

    try {
      const options = this.getGotScrapingOptions(
        newLocalSessionToken,
        newLocalCsrfToken,
        proxyIndex,
        referer,
        method.toUpperCase() === "POST",
        payload
      );
      let response;
      if (method.toUpperCase() === "POST") {
        response = await this.gotScraping.post(url, options);
      } else {
        response = await this.gotScraping.get(url, options);
      }
      responseBody = response.body;

      let returnedSessionToken = null;
      let returnedCsrfToken = null;
      if (response.headers["set-cookie"]) {
        const newCookies = parseSetCookie(response.headers["set-cookie"]);
        if (newCookies["__Secure-next-auth.session-token"])
          returnedSessionToken = newCookies["__Secure-next-auth.session-token"];
        if (newCookies["__Host-next-auth.csrf-token"])
          returnedCsrfToken = newCookies["__Host-next-auth.csrf-token"];
      }

      const data = JSON.parse(responseBody);
      if (
        response.statusCode === 200 &&
        (data.data ||
          (method.toUpperCase() === "POST" &&
            data.message &&
            data.message.toLowerCase().includes("completed")) ||
          (method.toUpperCase() === "POST" &&
            data.id &&
            data.status === "COMPLETED") ||
          (url.includes("/api/auth/session") && data.user))
      ) {
        return {
          success: true,
          data: data.data || data,
          newSessionToken: returnedSessionToken,
          newCsrfToken: returnedCsrfToken,
          fullResponseData: data,
          statusCode: response.statusCode,
          isVercelBlock: false,
          isNetworkError: false,
          isQuestAlreadyCompletedError: false,
        };
      }

      let appErrorMsg = `Invalid response status: ${response.statusCode}`;
      if (data.message) appErrorMsg += ` - ${data.message}`;
      else if (responseBody)
        appErrorMsg += ` - Body: ${responseBody.substring(0, 100)}`;

      isQuestAlreadyCompletedError =
        response.statusCode === 400 &&
        data.message &&
        data.message.toLowerCase().includes("quest already completed");

      if (
        response.statusCode === 429 ||
        (responseBody &&
          typeof responseBody === "string" &&
          responseBody.toLowerCase().includes("vercel security checkpoint"))
      ) {
        isVercelBlock = true;
        utilLog(
          `${url} was blocked by Vercel (Status: ${response.statusCode}). Attempt ${currentAttempt}/${maxRetries}`,
          "error"
        );
      } else if (!isQuestAlreadyCompletedError) {
        utilLog(
          `${url} non-200: ${response.statusCode}. AppError: ${appErrorMsg}`,
          "warning"
        );
      }

      // Retry only for specified conditions (Vercel block or server error), and not for "already completed"
      if (
        currentAttempt < maxRetries &&
        (isVercelBlock || response.statusCode >= 500) &&
        !isQuestAlreadyCompletedError
      ) {
        utilLog(
          `Retrying ${url} (attempt ${
            currentAttempt + 1
          }/${maxRetries}) due to ${
            isVercelBlock ? "Vercel block" : `status ${response.statusCode}`
          }...`,
          "warning"
        );
        await sleep(
          (isVercelBlock ? 10 : 5) + Math.random() * 2 * currentAttempt
        );
        return this._makeApiRequest(
          method,
          url,
          newLocalSessionToken,
          newLocalCsrfToken,
          proxyIndex,
          referer,
          payload,
          maxRetries,
          currentAttempt + 1
        );
      }
      return {
        success: false,
        error: appErrorMsg,
        newSessionToken: returnedSessionToken,
        newCsrfToken: returnedCsrfToken,
        statusCode: response.statusCode,
        isQuestAlreadyCompletedError,
        isVercelBlock,
        isNetworkError: false,
      };
    } catch (error) {
      let errorMsg = error.message;
      isNetworkError = true;
      let statusCode = error.response?.statusCode;

      if (
        error instanceof SyntaxError &&
        error.message.toLowerCase().includes("json")
      ) {
        errorMsg = `Failed to parse JSON from ${url}, likely received HTML. Original: ${error.message}`;
        const actualBody = error.response?.body || responseBody;
        if (actualBody && typeof actualBody === "string") {
          utilLog(
            `${url} received HTML (or non-JSON): ${actualBody.substring(
              0,
              300
            )}`,
            "error"
          );
          if (actualBody.toLowerCase().includes("vercel security checkpoint"))
            isVercelBlock = true;
        }
        isNetworkError = false;
      } else if (error.response) {
        isNetworkError = false;
        if (
          error.response.body &&
          typeof error.response.body === "string" &&
          error.response.body
            .toLowerCase()
            .includes("vercel security checkpoint")
        )
          isVercelBlock = true;
      }

      utilLog(
        `${url} request error: ${error.name} - ${errorMsg} (Status: ${statusCode})`,
        "error"
      );

      // Retry only for true network errors or non-Vercel server errors here
      if (currentAttempt < maxRetries && !isVercelBlock) {
        utilLog(
          `Retrying ${url} due to network/request error (attempt ${
            currentAttempt + 1
          }/${maxRetries})...`,
          "warning"
        );
        await sleep((5 + Math.random() * 3) * currentAttempt);
        return this._makeApiRequest(
          method,
          url,
          newLocalSessionToken,
          newLocalCsrfToken,
          proxyIndex,
          referer,
          payload,
          maxRetries,
          currentAttempt + 1
        );
      }
      return {
        success: false,
        error: errorMsg,
        newSessionToken: null,
        newCsrfToken: null,
        statusCode,
        isVercelBlock,
        isNetworkError,
      };
    }
  }

  async getUserData(sessionToken, csrfToken, proxyIndex) {
    return this._makeApiRequest(
      "GET",
      this.settings.MN_BASE_URL_USER,
      sessionToken,
      csrfToken,
      proxyIndex,
      "https://www.magicnewton.com/portal/rewards",
      null,
      this.settings.MN_MAX_API_GET_RETRIES
    );
  }
  async getQuests(sessionToken, csrfToken, proxyIndex) {
    return this._makeApiRequest(
      "GET",
      this.settings.MN_BASE_URL_QUESTS,
      sessionToken,
      csrfToken,
      proxyIndex,
      "https://www.magicnewton.com/portal/rewards",
      null,
      this.settings.MN_MAX_API_GET_RETRIES
    );
  }
  async getUserQuests(sessionToken, csrfToken, proxyIndex) {
    return this._makeApiRequest(
      "GET",
      this.settings.MN_BASE_URL_USER_QUESTS,
      sessionToken,
      csrfToken,
      proxyIndex,
      "https://www.magicnewton.com/portal/rewards",
      null,
      this.settings.MN_MAX_API_GET_RETRIES
    );
  }

  async getDailyDiceRollId(sessionToken, csrfToken, proxyIndex) {
    let questsResult;
    let currentSessionForThisScope = sessionToken;
    let currentCsrfForThisScope = csrfToken;
    let diceRollQuestId = null;

    utilLog(`Attempting to get quests for diceRollId...`, "info");
    questsResult = await this.getQuests(
      currentSessionForThisScope,
      currentCsrfForThisScope,
      proxyIndex
    );

    if (questsResult.newSessionToken)
      currentSessionForThisScope = questsResult.newSessionToken;
    if (questsResult.newCsrfToken)
      currentCsrfForThisScope = questsResult.newCsrfToken;

    if (questsResult.success && questsResult.data) {
      const diceRollQuestData = questsResult.data.find(
        (q) => q.title === "Daily Dice Roll"
      );
      if (diceRollQuestData) {
        diceRollQuestId = diceRollQuestData.id;
        utilLog("Successfully found Daily Dice Roll ID.", "success");
      } else {
        utilLog("Daily Dice Roll quest not found in quests list.", "warning");
      }
    } else {
      utilLog(
        `Failed to get quests for diceRollId after all attempts. Error: ${questsResult.error}`,
        "error"
      );
    }
    return {
      id: diceRollQuestId,
      newSessionToken: currentSessionForThisScope,
      newCsrfToken: currentCsrfForThisScope,
    };
  }

  async performSocialQuest(
    sessionToken,
    csrfToken,
    questId,
    platform,
    proxyIndex
  ) {
    const payload = { questId: questId, metadata: {} };
    const result = await this._makeApiRequest(
      "POST",
      this.settings.MN_BASE_URL_USER_QUESTS,
      sessionToken,
      csrfToken,
      proxyIndex,
      "https://www.magicnewton.com/portal/rewards",
      payload,
      1
    );

    let success = result.success;
    if (success)
      utilLog(
        `Quest ${platform} OK, credits: ${result.data?.credits}`,
        "success"
      );
    else if (result.isQuestAlreadyCompletedError) {
      utilLog(`${platform} already done.`, "warning");
      success = true;
    } else {
      utilLog(`Failed ${platform}. Error: ${result.error}`, "error");
    }
    return { ...result, success };
  }

  async performDiceRoll(sessionToken, csrfToken, diceRollId, proxyIndex) {
    const url = this.settings.MN_BASE_URL_USER_QUESTS;
    const payload = { questId: diceRollId, metadata: {} };
    const referer = "https://www.magicnewton.com/portal/rewards";
    let finalNextRollTime = DateTime.now().plus({ hours: 24, minutes: 1 });
    let currentSessionForRoll = sessionToken;
    let currentCsrfForRoll = csrfToken;
    let opSuccess = false;
    let opCompletedToday = false;
    let opIsVercelBlock = false;
    let opIsNetworkError = false;

    try {
      let userQuestsResult = await this.getUserQuests(
        currentSessionForRoll,
        currentCsrfForRoll,
        proxyIndex
      );
      if (userQuestsResult.newSessionToken)
        currentSessionForRoll = userQuestsResult.newSessionToken;
      if (userQuestsResult.newCsrfToken)
        currentCsrfForRoll = userQuestsResult.newCsrfToken;
      opIsVercelBlock = userQuestsResult.isVercelBlock || false;
      opIsNetworkError = userQuestsResult.isNetworkError || false;

      if (userQuestsResult.success && userQuestsResult.data) {
        const foundCompletedQuest = userQuestsResult.data.find(
          (q) => q.questId === diceRollId && q.status === "COMPLETED"
        );
        if (foundCompletedQuest) {
          const lastUpdate = DateTime.fromISO(
            foundCompletedQuest.updatedAt
          ).setZone("local");
          if (DateTime.now() < lastUpdate.plus({ hours: 24 })) {
            finalNextRollTime = lastUpdate.plus({ hours: 24, minutes: 1 });
            utilLog(
              `Dice already completed (checked via GET). Next at: ${finalNextRollTime.toFormat(
                "dd/MM/yyyy HH:mm:ss"
              )}`,
              "warning"
            );
            return {
              success: true,
              completedToday: true,
              nextRollTime: finalNextRollTime,
              newSessionToken: currentSessionForRoll,
              newCsrfToken: currentCsrfForRoll,
              isVercelBlock: false,
              isNetworkError: false,
            };
          }
        }
      } else if (opIsVercelBlock || opIsNetworkError) {
        utilLog(
          `Could not get user quests before dice roll due to block/network error: ${userQuestsResult.error}. Will proceed to POST with caution.`,
          "warning"
        );
      }

      let isPendingLoopCompleted = false;
      let totalCredits = 0;
      let allRolls = [];
      while (!isPendingLoopCompleted) {
        utilLog(`Attempting dice roll POST (Quest ID: ${diceRollId})`, "info");

        const delayBeforePostMs =
          Math.floor(
            Math.random() *
              (this.settings.MN_MAX_DELAY_BEFORE_DICE_POST_MS -
                this.settings.MN_MIN_DELAY_BEFORE_DICE_POST_MS +
                1)
          ) + this.settings.MN_MIN_DELAY_BEFORE_DICE_POST_MS;
        utilLog(
          `Waiting a random ${
            delayBeforePostMs / 1000
          }s before Dice Roll POST...`,
          "info"
        );
        await sleep(delayBeforePostMs / 1000);

        const postResult = await this._makeApiRequest(
          "POST",
          url,
          currentSessionForRoll,
          currentCsrfForRoll,
          proxyIndex,
          referer,
          payload,
          1
        );

        if (postResult.newSessionToken)
          currentSessionForRoll = postResult.newSessionToken;
        if (postResult.newCsrfToken)
          currentCsrfForRoll = postResult.newCsrfToken;
        opIsVercelBlock = postResult.isVercelBlock || opIsVercelBlock;
        opIsNetworkError = postResult.isNetworkError || opIsNetworkError;

        if (postResult.success && postResult.data) {
          const { status, credits, _diceRolls, updatedAt } = postResult.data;
          if (_diceRolls && Array.isArray(_diceRolls))
            allRolls.push(..._diceRolls);
          if (typeof credits === "number") totalCredits += credits;
          utilLog(
            `Roll: ${status}, Credits: ${credits || 0}, Dice: ${
              _diceRolls ? _diceRolls.join(",") : "N/A"
            }`,
            "custom"
          );

          if (status === "COMPLETED") {
            isPendingLoopCompleted = true;
            opSuccess = true;
            opCompletedToday = true;
            finalNextRollTime = DateTime.fromISO(updatedAt)
              .setZone("local")
              .plus({ hours: 24, minutes: 1 });
            utilLog(
              `Dice COMPLETED. Total: ${totalCredits}. All rolls: [${allRolls.join(
                ", "
              )}]`,
              "success"
            );
          } else if (status === "PENDING") {
            await sleep(1);
          } else {
            utilLog(`Unknown dice status '${status}'. Stop.`, "error");
            opSuccess = false;
            opCompletedToday = false;
            break;
          }
        } else {
          if (postResult.isQuestAlreadyCompletedError) {
            utilLog(
              `Dice roll (ID: ${diceRollId}) already COMPLETED (400 error from POST).`,
              "warning"
            );
            opSuccess = true;
            opCompletedToday = true;
            // Cố gắng lấy nextRollTime chính xác hơn
            let uqrAfter400 = await this.getUserQuests(
              currentSessionForRoll,
              currentCsrfForRoll,
              proxyIndex
            );
            if (uqrAfter400.newSessionToken)
              currentSessionForRoll = uqrAfter400.newSessionToken;
            if (uqrAfter400.newCsrfToken)
              currentCsrfForRoll = uqrAfter400.newCsrfToken;
            if (uqrAfter400.success && uqrAfter400.data) {
              const cdq = uqrAfter400.data
                .filter(
                  (q) => q.questId === diceRollId && q.status === "COMPLETED"
                )
                .sort(
                  (a, b) =>
                    DateTime.fromISO(b.updatedAt).toMillis() -
                    DateTime.fromISO(a.updatedAt).toMillis()
                )[0];
              if (cdq)
                finalNextRollTime = DateTime.fromISO(cdq.updatedAt)
                  .setZone("local")
                  .plus({ hours: 24, minutes: 1 });
            } else {
              utilLog(
                `Failed to fetch user quests after 400 error (Error: ${uqrAfter400.error}). Using default +24h1m nextRollTime.`,
                "warning"
              );
            }
            break;
          }
          utilLog(
            `Dice POST fail (Status: ${postResult.statusCode}). Error: ${postResult.error}`,
            "error"
          );
          opSuccess = false;
          opCompletedToday = false;
          break;
        }
      }
      return {
        success: opSuccess,
        completedToday: opCompletedToday,
        nextRollTime: finalNextRollTime,
        newSessionToken: currentSessionForRoll,
        newCsrfToken: currentCsrfForRoll,
        isVercelBlock: opIsVercelBlock,
        isNetworkError: opIsNetworkError,
      };
    } catch (error) {
      utilLog(
        `performDiceRoll outer error: ${error.name} - ${error.message}`,
        "error"
      );
      return {
        success: false,
        completedToday: false,
        nextRollTime: finalNextRollTime,
        newSessionToken: currentSessionForRoll,
        newCsrfToken: currentCsrfForRoll,
        isNetworkError: true,
        isVercelBlock: false,
      };
    }
  }

  async checkAndPerformDiceRoll(
    sessionToken,
    csrfToken,
    diceRollId,
    proxyIndex
  ) {
    let nextRollTime = DateTime.now().plus({ hours: 24, minutes: 1 });
    let currentSession = sessionToken;
    let currentCSRF = csrfToken;
    let completedToday = false;
    let isVercelBlock = false;
    let isNetworkError = false;
    let success = false;

    try {
      const userQuestsResult = await this.getUserQuests(
        currentSession,
        currentCSRF,
        proxyIndex
      );
      if (userQuestsResult.newSessionToken)
        currentSession = userQuestsResult.newSessionToken;
      if (userQuestsResult.newCsrfToken)
        currentCSRF = userQuestsResult.newCsrfToken;
      isVercelBlock = userQuestsResult.isVercelBlock || false;
      isNetworkError = userQuestsResult.isNetworkError || false;

      let shouldRoll = false;
      if (isVercelBlock || isNetworkError) {
        utilLog(
          "Cannot check dice status due to Vercel block or network error. Will attempt roll if ID exists.",
          "warning"
        );
        shouldRoll = !!diceRollId;
      } else if (userQuestsResult.success && userQuestsResult.data) {
        const completedDiceQuest = userQuestsResult.data.find(
          (q) => q.questId === diceRollId && q.status === "COMPLETED"
        );
        if (!completedDiceQuest) {
          shouldRoll = true;
        } else {
          const lastUpdate = DateTime.fromISO(
            completedDiceQuest.updatedAt
          ).setZone("local");
          nextRollTime = lastUpdate.plus({ hours: 24, minutes: 1 });
          if (DateTime.now() >= nextRollTime) {
            shouldRoll = true;
          } else {
            utilLog(
              `Dice roll not due. Next available at: ${nextRollTime.toFormat(
                "dd/MM/yyyy HH:mm:ss"
              )}`,
              "warning"
            );
            completedToday = true;
            success = true;
          }
        }
      } else {
        utilLog(
          `Failed to get user quests for dice check (Error: ${userQuestsResult.error}); will attempt roll if ID is present.`,
          "warning"
        );
        if (diceRollId) shouldRoll = true;
      }

      if (shouldRoll && diceRollId) {
        utilLog("Proceeding to perform dice roll.", "info");
        return await this.performDiceRoll(
          currentSession,
          currentCSRF,
          diceRollId,
          proxyIndex
        );
      } else if (!diceRollId) {
        utilLog(
          "Cannot perform dice roll without a valid diceRollId.",
          "error"
        );
        return {
          success: false,
          completedToday,
          nextRollTime,
          newSessionToken: currentSession,
          newCsrfToken: currentCSRF,
          isVercelBlock,
          isNetworkError,
        };
      }
      return {
        success,
        completedToday,
        nextRollTime,
        newSessionToken: currentSession,
        newCsrfToken: currentCSRF,
        isVercelBlock,
        isNetworkError,
      };
    } catch (error) {
      utilLog(`Error in checkAndPerformDiceRoll: ${error.message}`, "error");
      return {
        success: false,
        completedToday: false,
        nextRollTime,
        newSessionToken: currentSession,
        newCsrfToken: currentCSRF,
        isNetworkError: true,
        isVercelBlock: false,
      };
    }
  }

  async checkAndPerformSocialQuests(sessionToken, csrfToken, proxyIndex) {
    let currentSession = sessionToken;
    let currentCSRF = csrfToken;
    try {
      let questsResult = await this.getQuests(
        currentSession,
        currentCSRF,
        proxyIndex
      );
      if (questsResult.newSessionToken)
        currentSession = questsResult.newSessionToken;
      if (questsResult.newCsrfToken) currentCSRF = questsResult.newCsrfToken;
      if (!questsResult.success || !questsResult.data)
        return { newSessionToken: currentSession, newCsrfToken: currentCSRF };

      let userQuestsResult = await this.getUserQuests(
        currentSession,
        currentCSRF,
        proxyIndex
      );
      if (userQuestsResult.newSessionToken)
        currentSession = userQuestsResult.newSessionToken;
      if (userQuestsResult.newCsrfToken)
        currentCSRF = userQuestsResult.newCsrfToken;
      if (!userQuestsResult.success || !userQuestsResult.data)
        return { newSessionToken: currentSession, newCsrfToken: currentCSRF };

      const completedQuestIds = new Set(
        userQuestsResult.data
          .filter((q) => q.status === "COMPLETED")
          .map((q) => q.questId)
      );
      const socialQuests = questsResult.data.filter(
        (q) =>
          q.title.startsWith("Follow ") && q.title !== "Follow Discord Server"
      );

      for (const quest of socialQuests) {
        if (!completedQuestIds.has(quest.id)) {
          const socialResult = await this.performSocialQuest(
            currentSession,
            currentCSRF,
            quest.id,
            quest.title,
            proxyIndex
          );
          if (socialResult.newSessionToken)
            currentSession = socialResult.newSessionToken;
          if (socialResult.newCsrfToken)
            currentCSRF = socialResult.newCsrfToken;
          await sleep(2);
        }
      }
    } catch (error) {
      utilLog(`Error processing social quests: ${error.message}`, "error");
    }
    return { newSessionToken: currentSession, newCsrfToken: currentCSRF };
  }

  async main() {
    try {
      await this.initializeGotScraping();
      if (this.settings.USE_PROXY && this.proxies.length > 0) {
        utilLog(
          `Loaded ${this.proxies.length} proxies. Proxy usage is ENABLED.`,
          "info"
        );
      } else if (this.settings.USE_PROXY && this.proxies.length === 0) {
        utilLog(
          "Proxy usage is ENABLED but no proxies found. Running without proxy.",
          "warning"
        );
      } else {
        utilLog(
          "No proxies loaded or USE_PROXY is false. Running without proxy.",
          "info"
        );
      }

      const tokenLines = fs
        .readFileSync("data.txt", "utf8")
        .replace(/\r/g, "")
        .split("\n")
        .filter(Boolean);
      utilLog(
        `Loaded ${tokenLines.length} account lines from data.txt.`,
        "info"
      );

      const accounts = tokenLines
        .map((line) => {
          const parts = line.split("|");
          if (parts.length < 2 || !parts[0].trim() || !parts[1].trim()) {
            utilLog(
              `Invalid line in data.txt (expected sessionToken|csrfToken with non-empty values): "${line}"`,
              "warning"
            );
            return null;
          }
          return { sessionToken: parts[0].trim(), csrfToken: parts[1].trim() };
        })
        .filter((acc) => acc !== null);

      utilLog(
        `Successfully parsed ${accounts.length} accounts with paired tokens.`,
        "info"
      );
      if (accounts.length === 0) {
        // Chỉ cần kiểm tra accounts.length
        utilLog("No valid accounts found in data.txt to process.", "warning");
        // Không thoát, để vòng lặp while(true) và countdown xử lý việc chờ
      }

      while (true) {
        const allNextRollTimes = [];
        let allAccountsEffectivelyCompletedDiceForCycle = accounts.length > 0; // Giả sử đúng nếu có tài khoản

        const delayAccMs =
          this.settings.MN_DELAY_BETWEEN_ACCOUNTS_MS !== undefined
            ? this.settings.MN_DELAY_BETWEEN_ACCOUNTS_MS
            : 15000;
        utilLog(
          `Starting cycle for ${
            accounts.length
          } accounts. Delay between accounts: ${delayAccMs / 1000}s.`,
          "info"
        );

        for (let i = 0; i < accounts.length; i++) {
          let {
            sessionToken: accountSessionToken,
            csrfToken: accountCsrfToken,
          } = accounts[i];

          const proxyIndexToUse =
            this.settings.USE_PROXY && this.proxies.length > 0
              ? i % this.proxies.length
              : null;
          utilLog(
            `========== Processing Account ${i + 1} / ${
              accounts.length
            } ==========`,
            "custom"
          );

          const result = await this.processAccount(
            accountSessionToken,
            accountCsrfToken,
            proxyIndexToUse
          );

          allNextRollTimes.push(
            result.nextRollTime &&
              result.nextRollTime instanceof DateTime &&
              result.nextRollTime.isValid
              ? result.nextRollTime
              : DateTime.now().plus({ hours: 24, minutes: 1 })
          );
          if (!result.diceCompletedForToday) {
            allAccountsEffectivelyCompletedDiceForCycle = false;
          }
          utilLog(
            `Finished Account ${i + 1} / ${accounts.length}. Overall Success: ${
              result.success
            }, Dice Completed Today: ${result.diceCompletedForToday}`,
            "custom"
          );

          if (i < accounts.length - 1) {
            utilLog(`Waiting ${delayAccMs / 1000}s...`, "info");
            await sleep(delayAccMs / 1000);
          }
        }

        let waitSeconds;
        if (accounts.length === 0) {
          utilLog(
            "No accounts configured. Waiting configured TIME_SLEEP or 1 hour.",
            "warning"
          );
          waitSeconds = (this.settings.TIME_SLEEP || 60) * 60; // TIME_SLEEP từ config.js là phút
        } else {
          const earliestNextOverallRollTime =
            this.calculateEarliestNextRollTime(allNextRollTimes);
          waitSeconds = earliestNextOverallRollTime.diff(
            DateTime.now(),
            "seconds"
          ).seconds;

          if (waitSeconds < 0) waitSeconds = 0;

          let actualMinWaitSeconds =
            (this.settings.MN_MIN_CYCLE_WAIT_MINUTES || 30) * 60;

          if (allAccountsEffectivelyCompletedDiceForCycle) {
            utilLog(
              "All accounts appear to have completed dice rolls for today or have future roll times set.",
              "info"
            );
            let minWaitUntilEarliestRoll = earliestNextOverallRollTime.diff(
              DateTime.now(),
              "seconds"
            ).seconds;
            if (minWaitUntilEarliestRoll < 0) minWaitUntilEarliestRoll = 0;

            actualMinWaitSeconds = Math.max(
              minWaitUntilEarliestRoll,
              24 * 60 * 60
            );
            actualMinWaitSeconds += 60;

            if (waitSeconds < actualMinWaitSeconds) {
              utilLog(
                `All dice done. Next possible roll based wait time (${Math.round(
                  actualMinWaitSeconds / 3600
                )}h ${Math.round((actualMinWaitSeconds % 3600) / 60)}m).`,
                "info"
              );
              waitSeconds = actualMinWaitSeconds;
            }
          } else {
            utilLog(
              "Not all accounts completed dice successfully or status unknown.",
              "warning"
            );
            if (waitSeconds < actualMinWaitSeconds) {
              utilLog(
                `Defaulting to min cycle wait of ${Math.round(
                  actualMinWaitSeconds / 60
                )}m.`,
                "warning"
              );
              waitSeconds = actualMinWaitSeconds;
            }
            if (
              actualMinWaitSeconds ===
              (this.settings.MN_MIN_CYCLE_WAIT_MINUTES || 30) * 60
            ) {
              waitSeconds += 5 * 60;
            }
          }
        }

        const waitTimeFormatted = DateTime.now()
          .plus({ seconds: waitSeconds })
          .toFormat("dd/MM/yyyy HH:mm:ss");
        utilLog(
          `All accounts processed. Next cycle approx: ${waitTimeFormatted}`,
          "default"
        );
        await this.countdown(waitSeconds);
      }
    } catch (error) {
      utilLog(`Fatal error in main loop: ${error.message}`, "error");
      console.error(error.stack);
      process.exit(1);
    }
  }

  calculateEarliestNextRollTime(nextRollTimes) {
    if (!nextRollTimes || nextRollTimes.length === 0)
      return DateTime.now().plus({ hours: 24, minutes: 1 });
    const validTimes = nextRollTimes.filter(
      (time) => time instanceof DateTime && time.isValid
    );
    if (validTimes.length === 0)
      return DateTime.now().plus({ hours: 24, minutes: 1 });
    return DateTime.min(...validTimes);
  }
}

async function run() {
  const client = new MagicNewtonAPIClient();
  try {
    await client.main();
  } catch (err) {
    utilLog(`Unhandled fatal error: ${err.message}`, "error");
    console.error(err.stack);
    process.exit(1);
  }
}

run();
