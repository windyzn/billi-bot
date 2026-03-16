
# 🤖 Billi

**Billi** is a smart, mobile-friendly restaurant bill splitter designed specifically for British Columbia, Canada. It handles GST (5%) for food and GST+PST (12%) for takeout items, allows for complex itemized splits, and resolves group debts efficiently.

## 🚀 Quick Deployment (Recommended)

The easiest way to share this with friends is using **GitHub Pages**.

### 1. Push to GitHub
1. Create a new repository on [GitHub](https://github.com) named `restaurant-bill-bot`.
2. Initialize your local folder as a git repo:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Billi is alive!"
   git remote add origin https://github.com/windy-molecularyou/restaurant-bill-bot.git
   git push -u origin main
   ```

### 2. Automatic Deployment
This project includes a GitHub Actions workflow that will automatically build and deploy your app to GitHub Pages whenever you push to the `main` branch.

1. Go to your repository settings on GitHub.
2. Navigate to **Pages** in the sidebar.
3. Under **Build and deployment > Source**, select **GitHub Actions**.

Once the action completes, your app will be live at `https://windy-molecularyou.github.io/restaurant-bill-bot/`!


## 🛠 Features
- **Smart Scanning**: Uses Google Gemini to read receipt photos automatically.
- **BC Tax Rules**: Automatically applies 5% GST for food or 12% for takeout containers.
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
