type Locale = "tr";

type WelcomeTemplateParams = {
  email: string;
};

type NewOfferTemplateParams = {
  jobTitle: string;
  buyerName: string | null;
};

type NewMessageTemplateParams = {
  jobTitle: string;
  senderName: string | null;
};

type PasswordResetTemplateParams = {
  email: string;
  resetUrl: string;
};

type EmailVerificationTemplateParams = {
  email: string;
  verifyUrl: string;
};

export function buildWelcomeEmail(
  params: WelcomeTemplateParams,
  locale: Locale = "tr",
) {
  if (locale === "tr") {
    const subject = "TeklifAl'a hoş geldiniz";
    const text = [
      "Merhaba,",
      "",
      "TeklifAl hesabınız başarıyla oluşturuldu.",
      "Artık hizmet arayabilir veya teklif verebilirsiniz.",
      "",
      `Giriş için kullandığınız e-posta: ${params.email}`,
      "",
      "Teşekkürler,",
      "TeklifAl Ekibi",
    ].join("\n");

    const html = [
      "<p>Merhaba,</p>",
      "<p>TeklifAl hesabınız başarıyla oluşturuldu.</p>",
      "<p>Artık hizmet arayabilir veya teklif verebilirsiniz.</p>",
      `<p>Giriş için kullandığınız e-posta: <strong>${params.email}</strong></p>`,
      "<p>Teşekkürler,<br />TeklifAl Ekibi</p>",
    ].join("");

    return { subject, text, html };
  }

  const subject = "Welcome to TeklifAl";
  const text = "Your TeklifAl account has been created.";
  const html = "<p>Your TeklifAl account has been created.</p>";
  return { subject, text, html };
}

export function buildNewOfferEmail(
  params: NewOfferTemplateParams,
  locale: Locale = "tr",
) {
  if (locale === "tr") {
    const subject = "İlanınıza yeni bir teklif geldi";
    const text = [
      params.buyerName ? `Merhaba ${params.buyerName},` : "Merhaba,",
      "",
      `"${params.jobTitle}" başlıklı işinize yeni bir teklif geldi.`,
      "Teklifi görüntülemek için TeklifAl hesabınıza giriş yapabilirsiniz.",
      "",
      "Teşekkürler,",
      "TeklifAl Ekibi",
    ].join("\n");

    const html = [
      `<p>${params.buyerName ? `Merhaba ${params.buyerName},` : "Merhaba,"}</p>`,
      `<p>"${params.jobTitle}" başlıklı işinize yeni bir teklif geldi.</p>`,
      "<p>Teklifi görüntülemek için TeklifAl hesabınıza giriş yapabilirsiniz.</p>",
      "<p>Teşekkürler,<br />TeklifAl Ekibi</p>",
    ].join("");

    return { subject, text, html };
  }

  const subject = "New offer for your job";
  const text = "You have a new offer for your job.";
  const html = "<p>You have a new offer for your job.</p>";
  return { subject, text, html };
}

export function buildNewMessageEmail(
  params: NewMessageTemplateParams,
  locale: Locale = "tr",
) {
  if (locale === "tr") {
    const subject = "İşiniz için yeni bir mesajınız var";
    const text = [
      params.senderName ? `Merhaba, ${params.senderName} size bir mesaj gönderdi.` : "Merhaba, yeni bir mesajınız var.",
      "",
      `"${params.jobTitle}" başlıklı işiniz için yeni bir mesaj aldınız.`,
      "Mesajı görüntülemek için TeklifAl hesabınıza giriş yapabilirsiniz.",
      "",
      "Teşekkürler,",
      "TeklifAl Ekibi",
    ].join("\n");

    const html = [
      `<p>${
        params.senderName
          ? `Merhaba, ${params.senderName} size bir mesaj gönderdi.`
          : "Merhaba, yeni bir mesajınız var."
      }</p>`,
      `<p>"${params.jobTitle}" başlıklı işiniz için yeni bir mesaj aldınız.</p>`,
      "<p>Mesajı görüntülemek için TeklifAl hesabınıza giriş yapabilirsiniz.</p>",
      "<p>Teşekkürler,<br />TeklifAl Ekibi</p>",
    ].join("");

    return { subject, text, html };
  }

  const subject = "New message for your job";
  const text = "You have a new message.";
  const html = "<p>You have a new message.</p>";
  return { subject, text, html };
}

export function buildPasswordResetEmail(
  params: PasswordResetTemplateParams,
  locale: Locale = "tr",
) {
  if (locale === "tr") {
    const subject = "TeklifAl şifre sıfırlama isteği";
    const text = [
      "Merhaba,",
      "",
      "TeklifAl hesabınız için bir şifre sıfırlama isteği aldık.",
      "Şifrenizi sıfırlamak için aşağıdaki bağlantıyı kullanabilirsiniz:",
      params.resetUrl,
      "",
      "Bu isteği siz göndermediyseniz bu e-postayı yok sayabilirsiniz.",
      "",
      "Teşekkürler,",
      "TeklifAl Ekibi",
    ].join("\n");

    const html = [
      "<p>Merhaba,</p>",
      "<p>TeklifAl hesabınız için bir şifre sıfırlama isteği aldık.</p>",
      "<p>Şifrenizi sıfırlamak için aşağıdaki bağlantıyı kullanabilirsiniz:</p>",
      `<p><a href="${params.resetUrl}">${params.resetUrl}</a></p>`,
      "<p>Bu isteği siz göndermediyseniz bu e-postayı yok sayabilirsiniz.</p>",
      "<p>Teşekkürler,<br />TeklifAl Ekibi</p>",
    ].join("");

    return { subject, text, html };
  }

  const subject = "TeklifAl password reset";
  const text = `Reset your password: ${params.resetUrl}`;
  const html = `<p>Reset your password: <a href="${params.resetUrl}">${params.resetUrl}</a></p>`;
  return { subject, text, html };
}

export function buildEmailVerificationEmail(
  params: EmailVerificationTemplateParams,
  locale: Locale = "tr",
) {
  if (locale === "tr") {
    const subject = "TeklifAl e-posta doğrulama";
    const text = [
      "Merhaba,",
      "",
      "Hesabını aktifleştirmek için e-posta adresini doğrulaman gerekiyor.",
      "Aşağıdaki bağlantıya tıklayarak doğrulamayı tamamlayabilirsin:",
      params.verifyUrl,
      "",
      "Bu isteği sen yapmadıysan e-postayı yok sayabilirsin.",
      "",
      "Teşekkürler,",
      "TeklifAl Ekibi",
    ].join("\n");

    const html = [
      "<p>Merhaba,</p>",
      "<p>Hesabını aktifleştirmek için e-posta adresini doğrulaman gerekiyor.</p>",
      "<p>Aşağıdaki bağlantıya tıklayarak doğrulamayı tamamlayabilirsin:</p>",
      `<p><a href=\"${params.verifyUrl}\">${params.verifyUrl}</a></p>`,
      "<p>Bu isteği sen yapmadıysan e-postayı yok sayabilirsin.</p>",
      "<p>Teşekkürler,<br />TeklifAl Ekibi</p>",
    ].join("");

    return { subject, text, html };
  }

  const subject = "Verify your TeklifAl email";
  const text = `Verify your email: ${params.verifyUrl}`;
  const html = `<p>Verify your email: <a href=\"${params.verifyUrl}\">${params.verifyUrl}</a></p>`;
  return { subject, text, html };
}

