const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const test = require("node:test");
const reservationsHandler = require("../api/reservations");
const { createMailSender, createServer, validateReservation } = require("../server");

async function invokeReservationsHandler(request) {
  const response = {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  await reservationsHandler(request, response);
  return response;
}

async function withServer(options, run) {
  const server = createServer(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = http.request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    }, (response) => {
      let responseBody = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { responseBody += chunk; });
      response.on("end", () => resolve({
        statusCode: response.statusCode,
        body: JSON.parse(responseBody),
      }));
    });
    request.on("error", reject);
    request.end(body);
  });
}

test("exports reservation helpers for serverless handlers", () => {
  assert.equal(typeof createMailSender, "function");
  assert.deepEqual(validateReservation({
    requestType: "مشاوره",
    businessType: "فروشگاه",
    email: "customer@example.com",
  }), {
    reservation: {
      requestType: "مشاوره",
      businessType: "فروشگاه",
      email: "customer@example.com",
      comments: "",
    },
  });
});

test("Vercel reservation handler rejects unsupported methods and invalid data", async () => {
  const unsupportedMethod = await invokeReservationsHandler({
    method: "GET",
    headers: {},
  });
  assert.equal(unsupportedMethod.statusCode, 405);
  assert.equal(unsupportedMethod.headers.Allow, "POST");

  const invalidRequest = await invokeReservationsHandler({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: { requestType: "", businessType: "فروشگاه", email: "invalid" },
  });
  assert.equal(invalidRequest.statusCode, 400);
});

test("serves the homepage and its assets", async () => {
  await withServer({}, async (baseUrl) => {
    const pages = ["", "how.html", "shop.html", "contact.html", "reserve.html", "dollar-services.html", "website-design.html"];
    const responses = await Promise.all(pages.map((page) => fetch(`${baseUrl}/${page}`)));
    assert.ok(responses.every((response) => response.status === 200));
    assert.match(await responses[0].text(), /AFLOW IRAN/);

    const asset = await fetch(`${baseUrl}/css/variables.css`);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get("content-type"), /text\/css/);
  });
});

test("sends a valid reservation through the configured mail sender", async () => {
  let received;
  await withServer({
    publicDir: path.join(__dirname, "..", "public"),
    sendMail: async (reservation) => { received = reservation; },
  }, async (baseUrl) => {
    const response = await postJson(`${baseUrl}/api/reservations`, {
      requestType: "مشاوره",
      businessType: "فروشگاه",
      email: "customer@example.com",
      comments: "لطفاً تماس بگیرید.",
    });
    assert.equal(response.statusCode, 200);
    assert.equal(received.email, "customer@example.com");
    assert.match(response.body.message, /موفقیت/);
  });
});

test("rejects invalid reservation data without sending email", async () => {
  let sent = false;
  await withServer({
    sendMail: async () => { sent = true; },
  }, async (baseUrl) => {
    const response = await postJson(`${baseUrl}/api/reservations`, {
      requestType: "",
      businessType: "فروشگاه",
      email: "not-an-email",
    });
    assert.equal(response.statusCode, 400);
    assert.equal(sent, false);
  });
});

test("returns a clear error when email is not configured", async () => {
  await withServer({ sendMail: null }, async (baseUrl) => {
    const response = await postJson(`${baseUrl}/api/reservations`, {
      requestType: "مشاوره",
      businessType: "فروشگاه",
      email: "customer@example.com",
    });
    assert.equal(response.statusCode, 503);
  });
});
