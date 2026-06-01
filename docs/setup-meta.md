# Meta Ads Setup Guide

## Step 1: Create a Meta App

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Click **My Apps > Create App**
3. Choose app type: **Business**
4. Name it "Adrex AI" and create

## Step 2: Add Marketing API

1. In your app dashboard, go to **Add Products**
2. Find **Marketing API** and click **Set Up**

## Step 3: Get Your App Credentials

1. Go to **Settings > Basic**
2. Copy your **App ID** and **App Secret**

## Step 4: Generate an Access Token

### Option A: Graph API Explorer (Quick)

1. Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app from the dropdown
3. Click **Generate Access Token**
4. Select permissions: `ads_management`, `ads_read`, `business_management`
5. Click **Generate**

This gives a short-lived token (~1 hour). Exchange it for a long-lived token:

```bash
curl "https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=SHORT_LIVED_TOKEN"
```

The response contains a long-lived token (~60 days).

### Option B: System User Token (Recommended for Production)

1. Go to [Business Settings](https://business.facebook.com/settings)
2. Navigate to **Users > System Users**
3. Create a new system user
4. Assign it to your ad accounts with `ads_management` permission
5. Generate a token for the system user

System user tokens don't expire.

## Step 5: Set Environment Variables

```bash
export META_ADS_APP_ID="your-app-id"
export META_ADS_APP_SECRET="your-app-secret"
export META_ADS_ACCESS_TOKEN="your-long-lived-token"
```

## Step 6: Find Your Ad Account ID

Your ad account ID looks like `act_123456789`. You can find it:

1. In [Ads Manager](https://www.facebook.com/adsmanager) — it's in the URL
2. Or use the `meta_ads_list_accounts` tool after connecting

## Troubleshooting

**"Invalid OAuth access token"**
- Your token may have expired. Generate a new one via Step 4.
- System user tokens (Option B) don't expire.

**"Ad account is not active"**
- Check that your ad account is in good standing at [Ads Manager](https://www.facebook.com/adsmanager).

**"(#100) Missing permissions"**
- Ensure your token has `ads_management` and `ads_read` permissions.
- Re-generate the token with correct scopes.

**"Application does not have the capability to make API calls"**
- Your app may need review. Go to **App Review** in the developer dashboard.
- For testing, you can use the app in development mode with your own ad accounts.
