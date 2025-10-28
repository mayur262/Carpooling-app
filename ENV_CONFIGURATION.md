# 🔧 Environment Configuration Guide

## 📋 **Single .env File Setup**

ShareMyRide now uses a **single `.env` file** at the project root for all configuration. This simplifies environment management and reduces duplication.

---

## 📁 **File Structure**

```
ShareMyRide/
├── .env                    ✅ SINGLE SOURCE OF TRUTH (NOT committed to Git)
├── .env.example            ✅ Template file (committed to Git)
├── config/
│   └── supabase.js         → Reads EXPO_PUBLIC_* variables
├── backend/
│   ├── server.js           → Loads ../env
│   └── config/
│       └── supabase.js     → Loads ../../.env
└── utils/
    ├── notificationHelper.js  → Uses EXPO_PUBLIC_API_URL
    └── StripeService.js       → Uses EXPO_PUBLIC_STRIPE_KEY
```

---

## 🚀 **Quick Setup**

### **Step 1: Copy Template**

```bash
# Copy the example file
cp .env.example .env

# OR on Windows:
copy .env.example .env
```

### **Step 2: Fill in Your Values**

Open `.env` and replace placeholder values:

```env
# Replace these with your actual credentials:
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your_actual_key_here
SUPABASE_SERVICE_KEY=your_actual_service_key_here

# Update your computer's IP for device testing:
EXPO_PUBLIC_API_URL=http://YOUR_IP:3000  # Run 'ipconfig' to find IP
```

### **Step 3: Verify Configuration**

```bash
# Test backend can read .env
cd backend
node -e "require('dotenv').config({path:'../.env'}); console.log('Supabase URL:', process.env.SUPABASE_URL)"

# Should output your Supabase URL
```

---

## 🔑 **Environment Variables Explained**

### **Frontend Variables (Expo/React Native)**

Frontend can **only** access variables with `EXPO_PUBLIC_` prefix:

| Variable | Purpose | Example |
|----------|---------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase key | `eyJhbGc...` |
| `EXPO_PUBLIC_API_URL` | Backend server URL | `http://192.168.1.100:3000` |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe public key | `pk_test_...` |

### **Backend Variables (Node.js)**

Backend can access **all** variables:

| Variable | Purpose | Example |
|----------|---------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Private service role key | `eyJhbGc...` |
| `PORT` | Server port | `3000` |
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_test_...` |
| `TWILIO_ACCOUNT_SID` | Twilio account ID | `AC...` |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | `...` |

---

## 🛠️ **How It Works**

### **Frontend (Expo)**

Expo automatically loads variables with `EXPO_PUBLIC_` prefix:

```javascript
// config/supabase.js
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
```

### **Backend (Node.js)**

Backend explicitly loads from root `.env`:

```javascript
// backend/server.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Now can access all variables
const port = process.env.PORT;
const supabaseUrl = process.env.SUPABASE_URL;
```

---

## 📍 **Finding Your Computer's IP Address**

For testing on physical devices, you need your computer's local IP:

### **Windows:**
```bash
ipconfig

# Look for "IPv4 Address" under your active network adapter
# Example: 192.168.1.100
```

### **Mac/Linux:**
```bash
ifconfig

# Look for "inet" address under en0 or wlan0
# Example: 192.168.1.100
```

### **Update .env:**
```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000
```

---

## 🔒 **Security Best Practices**

### ✅ **DO:**
- ✅ Keep `.env` file out of Git (already in `.gitignore`)
- ✅ Use `.env.example` as a template (commit this)
- ✅ Use different keys for development and production
- ✅ Rotate keys regularly
- ✅ Use `EXPO_PUBLIC_` prefix only for non-sensitive data

### ❌ **DON'T:**
- ❌ Commit `.env` file to GitHub
- ❌ Share your `.env` file publicly
- ❌ Use production keys in development
- ❌ Hardcode sensitive values in source code

---

## 🧪 **Testing Configuration**

### **Test Backend:**

```bash
cd backend
node server.js

# Should see:
# ✅ Server running on http://localhost:3000
# ✅ Connected to Supabase
```

### **Test Frontend:**

```bash
# Check if Expo can read variables
npx expo start

# In the terminal output, you should see:
# Metro bundler running
# No errors about missing configuration
```

### **Test API Connection:**

```bash
# Health check
curl http://localhost:3000/health

# Should return: {"status":"ok","timestamp":"..."}
```

---

## 🐛 **Troubleshooting**

### **Issue: "Missing Supabase configuration"**

**Cause:** `.env` file not found or variables not set

**Solution:**
```bash
# Verify .env exists in root
ls -la .env  # Mac/Linux
dir .env     # Windows

# Check file content
cat .env     # Mac/Linux
type .env    # Windows

# Ensure variables are set (no spaces around =)
SUPABASE_URL=https://xxx.supabase.co  # ✅ Correct
SUPABASE_URL = https://xxx.supabase.co  # ❌ Wrong (spaces)
```

### **Issue: Frontend can't connect to backend**

**Cause:** Wrong `EXPO_PUBLIC_API_URL` value

**Solution:**
```env
# For Expo Go on same machine:
EXPO_PUBLIC_API_URL=http://localhost:3000

# For Android Emulator:
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000

# For physical device (replace with your IP):
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000
```

### **Issue: Backend can't read environment variables**

**Cause:** Backend not loading from correct path

**Solution:**
```javascript
// backend/server.js
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// backend/config/supabase.js
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
```

### **Issue: Changes to .env not reflecting**

**Cause:** Need to restart servers after .env changes

**Solution:**
```bash
# Restart backend
Ctrl+C  # Stop server
node server.js  # Start again

# Restart Expo
Ctrl+C  # Stop Metro
npx expo start -c  # Start with cache clear
```

---

## 📦 **For Production Deployment**

### **Expo/EAS Build:**

Add variables to `eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://prod.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "prod_key_here",
        "EXPO_PUBLIC_API_URL": "https://api.yourapp.com"
      }
    }
  }
}
```

### **Backend Deployment (Heroku/Railway/Render):**

Set environment variables in dashboard:

```bash
# Heroku example:
heroku config:set SUPABASE_URL=https://xxx.supabase.co
heroku config:set SUPABASE_SERVICE_KEY=xxx
heroku config:set PORT=3000
```

---

## 📝 **Environment Variables Checklist**

Before running your app, ensure these are set:

### **Required for Basic Functionality:**
- [ ] `EXPO_PUBLIC_SUPABASE_URL`
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_KEY`
- [ ] `EXPO_PUBLIC_API_URL`
- [ ] `PORT`

### **Required for Payments:**
- [ ] `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] `STRIPE_SECRET_KEY`

### **Required for SMS/SOS:**
- [ ] `TWILIO_ACCOUNT_SID`
- [ ] `TWILIO_AUTH_TOKEN`
- [ ] `TWILIO_PHONE_NUMBER`

### **Optional:**
- [ ] `GOOGLE_MAPS_API_KEY`
- [ ] `EMAILJS_SERVICE_ID`
- [ ] `JWT_SECRET`

---

## 🔄 **Migration from Old Setup**

If you had separate `.env` files before:

```bash
# Old structure (multiple .env files):
ShareMyRide/.env
ShareMyRide/backend/.env

# New structure (single .env file):
ShareMyRide/.env  ← All configuration here
```

### **Migration Steps:**

1. **Consolidate Variables:**
   ```bash
   # Merge backend/.env into root .env
   cat backend/.env >> .env  # Mac/Linux
   type backend\.env >> .env  # Windows
   ```

2. **Add EXPO_PUBLIC_ Prefix:**
   ```env
   # Add these for frontend access:
   EXPO_PUBLIC_SUPABASE_URL=...
   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
   EXPO_PUBLIC_API_URL=...
   EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
   ```

3. **Delete Old Files:**
   ```bash
   rm backend/.env  # Mac/Linux
   del backend\.env  # Windows
   ```

4. **Test:**
   ```bash
   # Test backend
   cd backend && node server.js
   
   # Test frontend
   npx expo start
   ```

---

## 📚 **Additional Resources**

- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)
- [dotenv Documentation](https://github.com/motdotla/dotenv#readme)
- [Supabase API Keys](https://supabase.com/docs/guides/api/api-keys)
- [Stripe API Keys](https://stripe.com/docs/keys)

---

## ✅ **Verification Commands**

Run these to verify your setup:

```bash
# Check .env exists
test -f .env && echo "✅ .env exists" || echo "❌ .env missing"

# Check .env.example exists
test -f .env.example && echo "✅ .env.example exists" || echo "❌ .env.example missing"

# Check .gitignore includes .env
grep -q "^.env$" .gitignore && echo "✅ .env in .gitignore" || echo "❌ .env not ignored"

# Start backend
cd backend && node server.js &

# Start frontend
npx expo start
```

---

**✨ You're now using a single, unified `.env` file for all configuration!**

For questions or issues, check the main README.md or open an issue on GitHub.
