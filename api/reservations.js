const { createMailSender, validateReservation } = require("../server");

const maximumBodySize = 10 * 1024;

module.exports = async function reservationsHandler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ message: "متد درخواست پشتیبانی نمی‌شود." });
    return;
  }

  if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
    response.status(415).json({ message: "نوع محتوای درخواست پشتیبانی نمی‌شود." });
    return;
  }

  let input = request.body;
  if (typeof input === "string") {
    try {
      input = JSON.parse(input);
    } catch {
      response.status(400).json({ message: "متن درخواست معتبر نیست." });
      return;
    }
  }

  if (Buffer.byteLength(JSON.stringify(input) || "") > maximumBodySize) {
    response.status(413).json({ message: "درخواست بیش از حد بزرگ است." });
    return;
  }

  const { reservation, error } = validateReservation(input);
  if (error) {
    response.status(400).json({ message: error });
    return;
  }

  const sendMail = createMailSender();
  if (!sendMail) {
    response.status(503).json({ message: "ارسال درخواست موقتاً در دسترس نیست. لطفاً بعداً تلاش کنید." });
    return;
  }

  try {
    await sendMail(reservation);
    response.status(200).json({
      message: "درخواست شما با موفقیت ارسال شد. به‌زودی از طریق ایمیل با شما در ارتباط خواهیم بود.",
    });
  } catch (error) {
    console.error("Could not send reservation request:", error);
    response.status(502).json({ message: "ارسال درخواست انجام نشد. لطفاً کمی بعد دوباره تلاش کنید." });
  }
};