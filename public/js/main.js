document.addEventListener("DOMContentLoaded", function () {
  const bookingForm = document.querySelector("#booking-form");
  bookingForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = bookingForm.querySelector('button[type="submit"]');
    const statusMessage = bookingForm.querySelector(".booking-note");
    submitButton.disabled = true;
    submitButton.textContent = "در حال ارسال…";
    statusMessage.textContent = "درخواست شما در حال ارسال است…";
    statusMessage.dataset.state = "pending";

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(bookingForm))),
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.message || "ارسال درخواست انجام نشد.");

      statusMessage.textContent = result.message;
      statusMessage.dataset.state = "success";
      bookingForm.reset();
    } catch (error) {
      statusMessage.textContent = error.message || "ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.";
      statusMessage.dataset.state = "error";
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "ارسال درخواست رزرو";
    }
  });

  const menuButton = document.querySelector(".menu-toggle");
  const navigation = document.querySelector(".site-nav");
  const currentPage = window.location.pathname.split("/").pop();

  navigation?.querySelectorAll("a").forEach((link) => {
    if (link.getAttribute("href") === currentPage || (!currentPage && link.getAttribute("href") === "index.html")) {
      link.setAttribute("aria-current", "page");
    }
  });

  if (!menuButton || !navigation) return;

  const closeMenu = () => {
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "باز کردن منو");
    navigation.classList.remove("is-open");
  };

  menuButton.addEventListener("click", () => {
    const isExpanded = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!isExpanded));
    menuButton.setAttribute("aria-label", isExpanded ? "باز کردن منو" : "بستن منو");
    navigation.classList.toggle("is-open", !isExpanded);
  });

  navigation.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMenu();
  });

  document.addEventListener("click", (event) => {
    if (!navigation.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
      menuButton.focus();
    }
  });
});

const reveals = document.querySelectorAll(".reveal");

function revealOnScroll() {
  const windowHeight = window.innerHeight;

  reveals.forEach((element) => {
    const elementTop = element.getBoundingClientRect().top;

    if (elementTop < windowHeight - 100) {
      element.classList.add("active");
    }
  });
}

window.addEventListener("scroll", revealOnScroll);
revealOnScroll();