
# 🤖 Bill Bot

**Bill Bot** is a smart, mobile-friendly restaurant bill splitter designed specifically for British Columbia, Canada. It handles GST (5%) for food and GST+PST (12%) for takeout items, allows for complex itemized splits, and resolves group debts efficiently.

## 🚀 Quick Deployment (Recommended)

The easiest way to share this with friends is using **Vercel**.

1. Log in to [Vercel](https://vercel.com).
2. Click **"New Project"** and upload your project files or connect your repository.
3. **CRITICAL STEP**: Under "Environment Variables", add:
   - **Key**: `API_KEY`
   - **Value**: *Your Google Gemini API Key*
4. Click **Deploy**.

Once finished, Vercel will give you a public URL (e.g., `bill-bot.vercel.app`) that you can share with your group chat!

## 🛠 Features
- **Smart Scanning**: Uses Google Gemini to read receipt photos automatically.
- **Flexible Tax Rules**: Support for GST, PST, HST (13%/15%), and custom tax percentages.
- **Tip Calculator**: Calculate tip by percentage, flat amount, or by entering the final bill total.
- **Couple Linking**: Link friends together to settle up as a single unit.
- **Debt Resolution**: Calculates the minimum number of transfers needed to settle the bill.
- **Shareable Reports**: Copy a text summary of who owes what to your clipboard or share directly.

## 💻 Local Development
1. Install dependencies: `npm install`
2. Run locally: `npm run dev`
3. Build for production: `npm run build`

## ⚖️ License
MIT
