(() => {
  const email = ["stephane.dinahet", "gmail.com"].join("@");
  const button = document.querySelector("[data-contact-email]");
  if (!button) return;

  button.addEventListener("click", () => {
    const link = document.createElement("a");
    link.id = "privacyContactEmail";
    link.textContent = email;
    link.href = `mailto:${email}?subject=${encodeURIComponent("TuneDock for Spotify - Assistance")}`;
    link.setAttribute("aria-label", `${window.tdMsg?.("contactSupport") || "Contact"} : ${email}`);
    button.replaceWith(link);
  }, { once: true });
})();
