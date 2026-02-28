async function main() {
  const providerName = process.env.EMAIL_PROVIDER;

  if (!providerName) {
    console.log("Email provider not configured, skipping smoke test.");
    process.exit(0);
  }

  const to = process.env.EMAIL_SMOKE_TO;

  if (!to) {
    console.log("EMAIL_SMOKE_TO is not set, skipping smoke test.");
    process.exit(0);
  }

  const subject = "TeklifAl email smoke testi";
  const text = "Bu e-posta, TeklifAl email entegrasyonu doğrulama testi için gönderildi.";
  const html = "<p>Bu e-posta, TeklifAl email entegrasyonu doğrulama testi için gönderildi.</p>";

  if (providerName === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;

    if (!apiKey || !from) {
      console.log("RESEND_API_KEY veya RESEND_FROM_EMAIL eksik, smoke test atlanıyor.");
      process.exit(0);
    }

    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    await resend.emails.send({
      from,
      to,
      subject,
      text,
      html,
    });
  } else if (providerName === "sendgrid") {
    const apiKey = process.env.SENDGRID_API_KEY;
    const from = process.env.SENDGRID_FROM_EMAIL;

    if (!apiKey || !from) {
      console.log("SENDGRID_API_KEY veya SENDGRID_FROM_EMAIL eksik, smoke test atlanıyor.");
      process.exit(0);
    }

    const sendgrid = await import("@sendgrid/mail");
    sendgrid.default.setApiKey(apiKey);

    await sendgrid.default.send({
      from,
      to,
      subject,
      text,
      html,
    });
  } else {
    console.log("Bilinmeyen EMAIL_PROVIDER, smoke test atlanıyor.");
    process.exit(0);
  }

  console.log("Smoke email sent to", to);
}

main().catch((error) => {
  console.error("Email smoke test failed:", error);
  process.exit(1);
});
