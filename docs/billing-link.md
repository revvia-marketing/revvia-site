# Private billing link

The AI Visibility welcome email includes a private billing link. Each click creates a new Stripe Billing Portal session. The email does not contain a long-lived portal URL, and the site does not link to the portal.

`GET /.netlify/functions/billing-link?token=...`

1. Verify the token with HMAC-SHA256 using `BILLING_LINK_SECRET`. The token is the customer id plus a signature. A bad or missing token returns a plain page that says to reply to any Revvia email. It does not say why the token failed.
2. On a valid token, create a Stripe Billing Portal session with configuration `bpc_1UUy7pDi4PfrgafHEJeVLdrh` using `STRIPE_SECRET_KEY`, and respond `303` to the session URL.
3. `STRIPE_RESTRICTED_KEY_READ` cannot create portal sessions.

`PUBLIC_STRIPE_BILLING_PORTAL_URL` is not set and should stay unset.
