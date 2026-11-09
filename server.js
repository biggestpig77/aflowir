const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const nodemailer = require("nodemailer");
require("dotenv").config();

const publicDirectory = path.join(__dirname, "public");
const maximumBodySize = 10 * 1024;
const rateLimitWindow = 15 * 60 * 1000;
const rateLimitMaximum = 5;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;

    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > maximumBodySize) {
        reject(Object.assign(new Error("درخواست بیش از حد بزرگ است."), { statusCode: 413 }));
        request.resume();
        return;
      }
      body += chunk;
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error("متن درخواست معتبر نیست."), { statusCode: 400 }));
      }
    });
    request.on("error", reject);
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function validateReservation(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "اطلاعات درخواست معتبر نیست." };
  }

  const { requestType, businessType, email, comments = "" } = input;
  if (
    typeof requestType !== "string" ||
    requestType.trim().length === 0 ||
    requestType.trim().length > 120 ||
    typeof businessType !== "string" ||
    businessType.trim().length === 0 ||
    businessType.trim().length > 120 ||
    typeof email !== "string" ||
    email.trim().length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    typeof comments !== "string" ||
    comments.length > 3000
  ) {
    return { error: "لطفاً اطلاعات درخواست را بررسی و دوباره ارسال کنید." };
  }

  return {
    reservation: {
      requestType: requestType.trim(),
      businessType: businessType.trim(),
      email: email.trim(),
      comments: comments.trim(),
    },
  };
}

function createServer({
  publicDir = publicDirectory,
  sendMail = createMailSender(),
  now = Date.now,
} = {}) {
  const submissionsByAddress = new Map();
  const resolvedPublicDir = path.resolve(publicDir);

  return http.createServer(async (request, response) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    } catch {
      sendJson(response, 400, { message: "نشانی درخواست معتبر نیست." });
      return;
    }

    if (pathname === "/api/reservations") {
      if (request.method !== "POST") {
        response.writeHead(405, { Allow: "POST" });
        response.end();
        return;
      }

      if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
        sendJson(response, 415, { message: "نوع محتوای درخواست پشتیبانی نمی‌شود." });
        return;
      }

      const address = request.socket.remoteAddress || "unknown";
      const currentTime = now();
      const recentSubmissions = (submissionsByAddress.get(address) || [])
        .filter((timestamp) => currentTime - timestamp < rateLimitWindow);
      if (recentSubmissions.length >= rateLimitMaximum) {
        sendJson(response, 429, { message: "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید." });
        return;
      }
      recentSubmissions.push(currentTime);
      submissionsByAddress.set(address, recentSubmissions);

      try {
        const input = await readJsonBody(request);
        const { reservation, error } = validateReservation(input);
        if (error) {
          sendJson(response, 400, { message: error });
          return;
        }
        if (!sendMail) {
          sendJson(response, 503, { message: "ارسال درخواست موقتاً در دسترس نیست. لطفاً بعداً تلاش کنید." });
          return;
        }

        await sendMail(reservation);
        sendJson(response, 200, { message: "درخواست شما با موفقیت ارسال شد. به‌زودی از طریق ایمیل با شما در ارتباط خواهیم بود." });
      } catch (error) {
        if (error.statusCode) {
          sendJson(response, error.statusCode, { message: error.message });
          return;
        }
        console.error("Could not send reservation request:", error);
        sendJson(response, 502, { message: "ارسال درخواست انجام نشد. لطفاً کمی بعد دوباره تلاش کنید." });
      }
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }

    const requestedPath = pathname === "/" ? "/index.html" : pathname;
    const filePath = path.resolve(resolvedPublicDir, `.${requestedPath}`);
    const relativePath = path.relative(resolvedPublicDir, filePath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    fs.stat(filePath, (error, stats) => {
      if (error || !stats.isFile()) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      response.writeHead(200, {
        "Content-Length": stats.size,
        "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      fs.createReadStream(filePath).pipe(response);
    });
  });
}

function createMailSender() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  const port = Number(SMTP_PORT);
  if (!SMTP_HOST || !Number.isInteger(port) || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  const from = process.env.SMTP_FROM || SMTP_USER;
  const to = process.env.SMTP_TO || SMTP_USER;

  return async ({ requestType, businessType, email, comments }) => {
    const safeComments = escapeHtml(comments || "بدون توضیحات");
    await transporter.sendMail({
      from,
      to,
      replyTo: email,
      subject: "درخواست مشاوره جدید از وب‌سایت AFLOW",
      text: [
        `نوع درخواست: ${requestType}`,
        `نوع کسب‌وکار: ${businessType}`,
        `ایمیل: ${email}`,
        `توضیحات: ${comments || "بدون توضیحات"}`,
      ].join("\n"),
      html: `<p><strong>نوع درخواست:</strong> ${escapeHtml(requestType)}</p>
        <p><strong>نوع کسب‌وکار:</strong> ${escapeHtml(businessType)}</p>
        <p><strong>ایمیل:</strong> ${escapeHtml(email)}</p>
        <p><strong>توضیحات:</strong><br>${safeComments.replace(/\n/g, "<br>")}</p>`,
    });
  };
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || "127.0.0.1";
  if (!createMailSender()) {
    console.warn("SMTP is not configured; reservation submissions will return an error until it is set up.");
  }
  createServer().listen(port, host, () => {
    console.log(`AFLOW website is running at http://${host}:${port}`);
  });
}

module.exports = { createMailSender, createServer, validateReservation };
