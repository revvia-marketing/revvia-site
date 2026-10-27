# Private billing link

The AI Visibility page tells a client to cancel from the private billing link we email them. The site does not build that link and does not link to the Stripe Customer Portal.

When Tim is ready to send the link, a separate endpoint can do this:

1. `GET /api/billing?token=...`
2. Verify the token with HMAC-SHA256 using `BILLING_LINK_SECRET`. A bad or missing token returns a plain page that says to reply to any Revvia email. It does not reveal why the token failed.
3. On a valid token, create a Stripe Billing Portal session with configuration `bpc_1UUy7pDi4PfrgafHEJeVLdrh` and respond `303` to the session URL.
4. The email copy stays: "from your private billing link, which we email you." Do not put a public portal URL on the site.

`PUBLIC_STRIPE_BILLING_PORTAL_URL` is not set and should stay unset.

This document is the spec only. The endpoint is not implemented in this change.
