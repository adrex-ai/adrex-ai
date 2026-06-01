# Google Ads Setup Guide

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Note your project ID

## Step 2: Enable the Google Ads API

1. Go to **APIs & Services > Library**
2. Search for "Google Ads API"
3. Click **Enable**

## Step 3: Create OAuth Credentials

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth 2.0 Client ID**
3. Application type: **Desktop app**
4. Name it "Adrex AI"
5. Download the JSON — you'll need `client_id` and `client_secret`

## Step 4: Get a Developer Token

1. Go to [Google Ads API Center](https://ads.google.com/aw/apicenter)
2. Sign in with your Google Ads account
3. Apply for API access (Basic access is sufficient)
4. Your developer token will be shown once approved

> Note: Test accounts get immediate access. Production accounts require Google review.

## Step 5: Generate a Refresh Token

Option A: Use Google's OAuth Playground:

1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click the gear icon, check "Use your own OAuth credentials"
3. Enter your client ID and secret
4. In Step 1, enter scope: `https://www.googleapis.com/auth/adwords`
5. Click "Authorize APIs" and sign in
6. In Step 2, click "Exchange authorization code for tokens"
7. Copy the `refresh_token`

Option B: The Adrex AI server has a built-in OAuth flow that opens a browser window.

## Step 6: Set Environment Variables

```bash
export GOOGLE_ADS_CLIENT_ID="your-client-id"
export GOOGLE_ADS_CLIENT_SECRET="your-client-secret"
export GOOGLE_ADS_DEVELOPER_TOKEN="your-developer-token"
export GOOGLE_ADS_REFRESH_TOKEN="your-refresh-token"

# Only if you use a Manager (MCC) account:
export GOOGLE_ADS_LOGIN_CUSTOMER_ID="your-mcc-customer-id"
```

## Troubleshooting

**"Developer token is not approved"**
- You need at least Basic API access. Apply at the API Center.
- Test accounts work immediately.

**"The customer account can't be accessed"**
- Check that your refresh token belongs to a user with access to the ad account.
- If using MCC, set `GOOGLE_ADS_LOGIN_CUSTOMER_ID`.

**"Invalid refresh token"**
- Tokens can expire if you revoke access. Regenerate using Step 5.
