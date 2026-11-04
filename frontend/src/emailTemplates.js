
export const emailTemplates = [
  {
    id: "account-verification",

    name: "Account Verification",

    subject: "Account Information Update",

    senderName: "Spec-trum Assist Protal",

    body: `Hello,

We are currently making improvements to how account information is maintained and managed.

As part of this process, we encourage you to take a moment to review your account details and ensure that your information is accurate and up to date.

You can complete this review by visiting the official website and signing in through your usual account access page.

If your information is already current, no further action is necessary.

Thank you for your time and cooperation.

Customer Support Team`,

    button: {
      enabled: true,
      text: "Review Your Account Details",
      url: "https://rentassistportal.org",
      color: "#2563EB",
    },

    footer: {
      copyright: "© 2026 Spectrum. All rights reserved.",
      privacyPolicyText: "Privacy Policy",
      privacyPolicyUrl: "",
      termsText: "Terms of Service",
      termsUrl: "",
      notice:
        "This is a system-generated message. Please do not reply.",
    },
  },
];
