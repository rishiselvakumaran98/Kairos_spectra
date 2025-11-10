# API Key Settings UI - User Guide

## 🎉 New Feature: Settings in Extension Popup

No more console commands! You can now manage your OpenAI API key directly from the extension popup.

---

## 📍 How to Access Settings

1. Click the **KAIROS-SPECTRA icon** in your Chrome toolbar
2. Scroll down to the **⚙️ Settings** section
3. You'll see the API key input field

---

## 🔒 Lock/Unlock Feature

### Why Lock?
- **Prevents accidental changes** to your API key
- **Hides the key** (shows as `••••••`) when locked
- **Security best practice** - keep it locked when not editing

### How to Use:

**To Edit API Key:**
1. Click the **🔒 lock icon** → it changes to **🔓**
2. Input field becomes editable and shows plaintext
3. Your existing key is auto-selected for easy replacement
4. Type or paste your new API key
5. Click **Save** button

**After Saving:**
- Key is automatically locked again
- Shows as password (hidden characters)
- Status shows: `✓ API key set (XX chars)`

---

## 💾 Storage Details

### Where is it stored?
- **Chrome Sync Storage** (`chrome.storage.sync`)
- Syncs across your Chrome browsers (if signed in)
- Persists even after:
  - ✅ Closing Chrome
  - ✅ Reloading pages
  - ✅ Restarting computer
  - ✅ Reloading extension

### Is it secure?
- ✅ Stored locally in Chrome's encrypted storage
- ✅ Never sent to any server (except OpenAI when using vision)
- ✅ Password-masked when locked
- ✅ Only accessible by this extension

---

## 📊 Status Indicators

### ⚪ No API key set
- No key in storage
- Vision analysis will be skipped

### ✓ API key set (XX chars)
- Valid key detected (starts with `sk-`)
- Vision analysis enabled
- Character count shown for verification

### ⚠️ Invalid key format
- Key doesn't start with `sk-`
- May not work with OpenAI API
- Double-check the key

---

## 🎨 Visual Guide

```
┌─────────────────────────────────────┐
│ KAIROS-SPECTRA                      │
│ Proactive Visual Analytics Assistant│
├─────────────────────────────────────┤
│ STATUS                              │
│ 🟢 Active                           │
├─────────────────────────────────────┤
│ Interactions: 11    Struggles: 1+  │
├─────────────────────────────────────┤
│ ⚙️ Settings       [GPT-4V Vision]  │
│                                     │
│ OpenAI API Key (for complex apps)  │
│ ┌───────────────────────┐ 🔒 Save  │
│ │ ••••••••••••••••••••• │          │
│ └───────────────────────┘          │
│ ✓ API key set (51 chars)           │
│                                     │
│ Get API key → platform.openai.com  │
└─────────────────────────────────────┘
```

### When Unlocked:
```
│ ┌───────────────────────┐ 🔓 Save  │
│ │ sk-proj-abc123...xyz  │ (enabled)│
│ └───────────────────────┘          │
```

---

## 🚀 Quick Start

### First Time Setup:

1. **Get API Key**
   - Visit https://platform.openai.com/api-keys
   - Create new secret key
   - Copy it (starts with `sk-`)

2. **Open KAIROS-SPECTRA Popup**
   - Click extension icon in toolbar

3. **Unlock & Paste**
   - Click 🔒 lock icon
   - Paste your API key
   - Click **Save**

4. **Verify**
   - Status shows: `✓ API key set`
   - Lock icon automatically locks

5. **Done!**
   - Vision analysis now enabled
   - Key persists across sessions

---

## ⌨️ Keyboard Shortcuts

- **Unlock**: Click lock icon (no keyboard shortcut)
- **Select All**: Input field auto-selects when unlocked
- **Save**: Press `Enter` key or click Save button
- **Cancel**: Click lock icon again (restores original key)

---

## 🔄 Changing Your API Key

1. Unlock the input field
2. Clear existing key (or it's auto-selected)
3. Paste new key
4. Save
5. Status updates to reflect new key

---

## ❌ Removing API Key

1. Unlock the input field
2. Delete all text (leave empty)
3. Save
4. Status shows: `⚪ No API key set`
5. Vision analysis disabled

---

## 🐛 Troubleshooting

### "Failed to load"
- Extension may not have storage permissions
- Try reloading the extension at `chrome://extensions/`

### "Failed to save"
- Storage quota may be full (unlikely)
- Check Chrome storage permissions

### Key doesn't persist
- Make sure you clicked **Save**
- Lock icon should re-lock after saving
- Check if Chrome Sync is enabled

### Vision still not working
- Verify key starts with `sk-`
- Test on complex site (Voyager, not test-dashboard)
- Check console for API errors

---

## 🆚 Old vs New Method

### ❌ Old Way (Console):
```javascript
chrome.storage.sync.set({
  openai_api_key: "sk-..."
});
```
- Hard to remember
- No visual feedback
- Typo-prone
- Can't verify easily

### ✅ New Way (Popup):
- Visual UI with status
- Lock/unlock protection
- Save button confirmation
- Character count verification
- One-click access

---

## 📝 Best Practices

1. **Keep it locked** when not editing
2. **Verify status** shows green checkmark after saving
3. **Don't share** your API key screenshot
4. **Rotate keys** periodically for security
5. **Use separate keys** for testing vs production

---

## 🎓 For Researchers

### Sharing Extension with Participants:
- Participants can set their own API keys
- Keys don't sync between different Chrome profiles
- Each user's key is private to their browser

### Cost Tracking:
- Check usage at https://platform.openai.com/usage
- Monitor per-participant costs
- Keys can be rotated between sessions

---

## ✅ Checklist

- [ ] API key obtained from OpenAI
- [ ] Extension popup opened
- [ ] Lock icon clicked (unlocked)
- [ ] API key pasted
- [ ] Save button clicked
- [ ] Status shows green checkmark
- [ ] Lock icon automatically re-locked
- [ ] Tested on Voyager (vision works)

---

**You're all set!** No more console commands needed. 🎉
