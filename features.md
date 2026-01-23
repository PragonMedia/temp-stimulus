# Landing Page Traffic Management System

This document explains how the landing page traffic management system works, including the integration of `gtg.php`, `clickid.php`, and the button click handling logic.

## Overview

The system manages traffic flow on a landing page by:

1. **Analyzing traffic quality** using `gtg.php` to detect spy tools and invalid traffic
2. **Generating tracking IDs** using `clickid.php` to create RedTrack click IDs
3. **Conditionally redirecting users** based on traffic quality analysis

---

## System Flow

```
Page Load
    │
    ├───> gtg.php (parallel request)
    │     └───> Returns: { gtg: 1 | null }
    │
    └───> clickid.php (parallel request)
          └───> Returns: { clickid: "..." }

    │
    ▼
Button Click Handler
    │
    ├───> If gtg === 1
    │     └───> Redirect to: https://google.com
    │
    └───> If gtg === null/empty
          └───> Redirect to: https://trk.{domain}/click?clickid={clickid}
```

---

## gtg.php - Traffic Quality Analysis

### Purpose

`gtg.php` analyzes incoming traffic to determine if it's legitimate or coming from spy/competitor tools. It returns `gtg: 1` for invalid traffic and `gtg: null` for legitimate traffic.

### How It Works

#### 1. **Referrer Tracking**

- Tracks the original referrer URL in the session (24-hour TTL)
- Stores referrer chain to identify the source of traffic
- Ignores direct access to the domain itself

#### 2. **Spy Tool Detection**

Checks if the original referrer matches any of these spy/competitor domains:

- `adspy.com`, `bigspy.com`, `minea.com`
- `adspyder.io`, `adflex.io`, `poweradspy.com`
- `dropispy.com`, `socialpeta.com`
- `adstransparency.google.com`
- `facebook.com/ads/library`
- `adbeat.com`, `anstrex.com`, `semrush.com`
- `autods.com`, `foreplay.co`, `spyfu.com`
- `adplexity.com`, `spypush.com`
- `nativeadbuzz.com`, `spyover.com`
- `videoadvault.com`, `admobispy.com`
- `ispionage.com`, `similarweb.com`
- `pipiads.com`, `adespresso.com`

#### 3. **Key Parameter Validation**

Checks for the presence of `key=X184GA` in:

- URL query parameters (`?key=X184GA`)
- Referrer URL query parameters

#### 4. **Decision Logic**

```php
if ($cameFromReferrer || !$hasKey) {
    $gtg = 1;  // Invalid traffic - redirect to google.com
} else {
    $gtg = null;  // Legitimate traffic - proceed normally
}
```

### Response Format

```json
{
  "success": true,
  "gtg": 1 | null,
  "cameFromReferrer": boolean,
  "hasKey": boolean,
  "clickid": string,
  "originalReferrer": string,
  "currentReferrer": string,
  "referrers": array,
  "gtgTraffic": boolean,
  "urlUpdated": boolean
}
```

### When Called

- **Trigger**: On page load (parallel with `clickid.php`)
- **Method**: GET request
- **Endpoint**: `./gtg.php`

---

## clickid.php - RedTrack Click ID Generation

### Purpose

`clickid.php` generates a unique click ID from RedTrack for tracking purposes. It caches the click ID in the session to avoid multiple API calls.

### How It Works

#### 1. **Domain and Route Detection**

- Extracts domain from `HTTP_HOST` (removes `www.` prefix)
- Extracts route from `REQUEST_URI` (first path segment)
- Falls back to referrer URL if route is empty

#### 2. **API Integration**

- Calls internal API: `http://localhost:3000/api/v1/domain-route-details`
- Retrieves `rtkID` (RedTrack Campaign ID) for the domain/route combination
- Uses fallback `rtkID` if API call fails: `"695d30597b99d8843efe802c"`

#### 3. **Session Caching**

- Caches click ID in PHP session for 6 hours
- Returns cached value if available and not expired
- Avoids unnecessary RedTrack API calls

#### 4. **RedTrack API Call**

If no cached click ID exists:

- Builds RedTrack URL: `https://dx8jy.ttrk.io/{rtkID}?format=json`
- **URL Parameter Persistence (Critical for RedTrack Data Collection):**
  - Extracts all query parameters from the referrer URL (the current page URL with query string)
  - **Preserves tracking parameters**: All `sub1` through `sub10` parameters are forwarded to RedTrack
  - **Preserves other parameters**: All other URL parameters (UTMs, custom params, etc.) are forwarded
  - **Filters noise parameters**: Removes `cost` and `ref_id` parameters that are not needed
  - Appends these parameters as top-level query parameters to the RedTrack API URL
  - This ensures RedTrack receives all tracking data from the original landing page URL
- **Referrer Encoding**: The full referrer URL (with all parameters) is also encoded and sent as the `referrer` parameter
- Sends request with user agent and IP forwarding headers
- Extracts `clickid` from JSON response

**Example:**

```
Landing Page URL: https://example.com/landing?sub1=value1&sub2=value2&utm_source=facebook
RedTrack URL: https://dx8jy.ttrk.io/{rtkID}?format=json&referrer=...&sub1=value1&sub2=value2&utm_source=facebook
```

**Why This Matters:**

- RedTrack needs these URL parameters to properly attribute conversions and track campaign performance
- Without parameter persistence, RedTrack cannot receive critical tracking data (sub1-sub10, UTMs, etc.)
- This ensures data flows correctly from the landing page to RedTrack portal

#### 5. **Cookie Storage**

- Sets cookie: `rtkclickid-store` with 30-day expiration
- Compatible with RedTrack JavaScript tracking

### Response Format

```json
{
  "ok": true,
  "clickid": "abc123xyz...",
  "cached": boolean,
  "ref": "https://example.com/page?param=value",
  "mint_url": "https://dx8jy.ttrk.io/...",
  "debug": {
    "domain": "example.com",
    "route": "landing",
    "rtkID": "695d30597b99d8843efe802c"
  }
}
```

### Error Handling

- Returns `ok: false` if `rtkID` is `null` (RedTrack tracking disabled)
- Returns `502` status if RedTrack API call fails
- Returns `502` status if no `clickid` in response

### When Called

- **Trigger**: On page load (parallel with `gtg.php`)
- **Method**: POST request
- **Endpoint**: `./clickid.php`
- **Body**: `referrer={current_page_url}`

---

## Button Click Handling (index.html)

### Button Element

- **ID**: `continueClick`
- **Initial State**: Disabled with loading indicator
- **Behavior**: Dynamically updated based on `gtg.php` and `clickid.php` responses

### JavaScript Flow

#### 1. **Page Load Initialization**

```javascript
// Both requests fire in parallel
const gtgReq = fetch("./gtg.php", { method: "GET", ... });
const clickReq = fetch("./clickid.php", { method: "POST", ... });
```

#### 2. **Response Processing**

```javascript
// Wait for both responses
const gtgRes = await gtgReq;
const clickRes = await clickReq;

// Extract values
const gtgValue = gtgRes?.gtg ?? null;
const clickid = clickRes?.clickid ?? null;
```

#### 3. **Button URL Update Logic**

The `updateButton(clickid, gtgResult)` function handles the redirect logic:

**If `gtgResult === 1` (Invalid Traffic):**

```javascript
btn.href = "https://google.com";
// User is redirected to Google (traffic filtering)
```

**If `gtgResult === null` or empty (Legitimate Traffic):**

```javascript
const domain = window.location.hostname.replace(/^www\./, "");
const url = `https://trk.${domain}/click?clickid=${encodeURIComponent(
  clickid
)}`;
btn.href = url;
// User is redirected to tracking URL with clickid
```

#### 4. **Fallback Handling**

If `clickid.php` fails:

1. Check URL parameters for `?clickid=...`
2. Check `localStorage` for cached `rt_clickid`
3. Retry with fallback `rtkID` if needed

#### 5. **Timeout Protection**

- Maximum loading time: 5 seconds
- If `clickid.php` times out, uses fallback mechanism
- Button is enabled even if requests fail

### Complete Flow Example

```
1. User lands on page: https://example.com/landing?key=X184GA
2. Page loads → JavaScript fires:
   - gtg.php → Returns: { gtg: null } (legitimate)
   - clickid.php → Returns: { clickid: "abc123" }
3. Button URL updated: https://trk.example.com/click?clickid=abc123
4. User clicks button → Redirected to tracking URL
```

**Invalid Traffic Example:**

```
1. User lands from adspy.com
2. Page loads → JavaScript fires:
   - gtg.php → Returns: { gtg: 1 } (invalid traffic)
   - clickid.php → Returns: { clickid: "abc123" }
3. Button URL updated: https://google.com
4. User clicks button → Redirected to Google (filtered out)
```

---

## Key Features

### 1. **Parallel Request Processing**

Both `gtg.php` and `clickid.php` are called simultaneously to minimize page load time.

### 2. **Session-Based Caching**

- `gtg.php`: Tracks referrers for 24 hours
- `clickid.php`: Caches click IDs for 6 hours

### 3. **Traffic Filtering**

Invalid traffic (spy tools, missing key) is automatically redirected to Google, preventing them from reaching the tracking URL.

### 4. **Fallback Mechanisms**

Multiple fallback strategies ensure the button always works, even if API calls fail.

### 5. **Debugging Support**

Both PHP files return detailed debug information in their responses for troubleshooting.

---

## Configuration

### gtg.php Configuration

- **Session TTL**: 24 hours (`SESSION_TTL = 24 * 3600`)
- **Target Referrers**: List of spy tool domains (see code)
- **Required Key**: `X184GA`

### clickid.php Configuration

- **Session TTL**: 6 hours (`SESSION_TTL = 6 * 3600`)
- **RedTrack Base URL**: `https://dx8jy.ttrk.io`
- **Cookie Expiration**: 30 days
- **API Endpoint**: `http://localhost:3000/api/v1/domain-route-details`
- **Fallback rtkID**: `695d30597b99d8843efe802c`

---

## Testing

### Test Legitimate Traffic

```
URL: https://example.com/landing?key=X184GA
Expected: Button redirects to tracking URL with clickid
```

### Test Invalid Traffic (Spy Tool)

```
Referrer: https://adspy.com/view/...
Expected: Button redirects to https://google.com
```

### Test Invalid Traffic (Missing Key)

```
URL: https://example.com/landing
Expected: Button redirects to https://google.com
```

---

## Troubleshooting

### Button Not Updating

- Check browser console for JavaScript errors
- Verify both `gtg.php` and `clickid.php` are returning valid JSON
- Check network tab for failed requests

### Click ID Not Generated

- Verify API endpoint is accessible: `http://localhost:3000/api/v1/domain-route-details`
- Check if `rtkID` is `null` in response (RedTrack disabled)
- Review server error logs for curl failures

### GTG Always Returns 1

- Verify `key=X184GA` is in URL or referrer
- Check if referrer matches spy tool domains
- Review session data to see tracked referrers

### RedTrack Not Receiving URL Parameters

**Symptoms:** RedTrack portal shows missing data for sub1-sub10, UTMs, or other tracking parameters

**Solutions:**

1. **Verify referrer is being sent correctly:**

   - Check the `mint_url` field in `clickid.php` response (visible in browser network tab)
   - Ensure the referrer URL includes all query parameters
   - The referrer should be the full current page URL with query string

2. **Check parameter forwarding:**

   - Parameters are extracted from the referrer URL's query string
   - All parameters except `cost` and `ref_id` should be forwarded
   - Verify `sub1` through `sub10` are present in the original landing page URL

3. **Debug the RedTrack request:**

   - Check server logs for the actual RedTrack URL being called
   - Verify parameters appear in the `mint_url` response field
   - Ensure the referrer parameter is properly URL-encoded

4. **Common issues:**
   - If using `POST` to `clickid.php`, ensure the `referrer` field in the POST body contains the full URL with query parameters
   - If parameters are missing, check that the landing page URL includes them when the page loads
   - Verify the referrer is not being stripped by browser security settings

**Example Debug:**

```javascript
// In browser console, check the clickid.php response:
fetch('./clickid.php', { method: 'POST', ... })
  .then(r => r.json())
  .then(data => {
    console.log('Referrer sent:', data.ref);
    console.log('RedTrack URL:', data.mint_url);
    // mint_url should contain all your URL parameters
  });
```

---

## Security Considerations

1. **CORS Headers**: Both PHP files allow cross-origin requests (`Access-Control-Allow-Origin: *`)
2. **Session Security**: Uses PHP sessions for server-side state management
3. **Cookie Security**: Uses `Secure` and `SameSite` flags when HTTPS is available
4. **Input Validation**: Validates and sanitizes referrer URLs and query parameters

---

## Dependencies

- **PHP**: Version 7.0+ (for session management and curl)
- **RedTrack API**: Active RedTrack account with valid `rtkID`
- **Internal API**: `http://localhost:3000/api/v1/domain-route-details` (for domain/route mapping)
- **Modern Browser**: JavaScript ES6+ support for async/await
