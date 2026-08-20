# PriceGuard AI

AI-powered price monitoring and inventory intelligence platform that tracks product prices across multiple Indian e-commerce stores using Bright Data scrapers.

## Features

- **Multi-store Price Tracking** — Monitors products across Amazon, Flipkart, and Croma
- **Target Price Alerts** — Get notified when product prices drop below your desired target
- **Stock Monitoring** — Tracks product availability and flags out-of-stock items
- **AI Scraper Healing** — Automatically detects and adapts to website changes
- **Discount Detection** — Identifies products with significant price drops (20%+ off)
- **Dashboard** — Real-time overview of all monitored products, scraper health, and price alerts

## Tech Stack

- **Backend:** Node.js, Express.js
- **Frontend:** Vanilla HTML, CSS, JavaScript
- **Scraping:** Bright Data CLI (`@brightdata/cli`) with managed pipelines
- **Stores:** Amazon India, Flipkart, Croma

## Project Structure

```
PriceGuardAI/
├── public/                 # Frontend static files
│   ├── css/style.css      # Styles
│   ├── js/
│   │   ├── api.js         # API client utilities
│   │   ├── app.js         # Sidebar toggle logic
│   │   ├── components/    # Reusable UI components
│   │   └── pages/         # Page-specific scripts
│   ├── index.html         # Dashboard
│   ├── products.html      # Products page
│   ├── alerts.html        # Alerts page
│   ├── scrapers.html      # Scraper status page
│   └── settings.html      # Settings page
├── routes/
│   └── products.js        # API routes & scraper logic
├── server.js              # Express server entry point
└── package.json
```

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Bright Data CLI](https://www.brightdata.com/) account and API access

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd PriceGuardAI

# Install dependencies
npm install
```

## Configuration

Set up your Bright Data credentials and ensure the `@brightdata/cli` is authenticated:

```bash
npx -p @brightdata/cli bdata login
```

Create a `.env` file if needed:

```env
PORT=3000
```

## Running the App

```bash
# Start the server
npm start
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | Fetch all monitored products with live prices |
| GET | `/api/products/:id` | Fetch a specific product by ID |
| GET | `/api/alerts` | Fetch all active alerts (price drops, stock, errors) |

## Monitored Product Categories

| Category | Store | Target Price |
|----------|-------|-------------|
| Smartphones | Amazon | ₹30,000 |
| Laptops | Amazon | ₹60,000 |
| Headphones | Amazon | ₹5,000 |
| Smartwatches | Amazon | ₹15,000 |
| Tablets | Amazon | ₹30,000 |
| Cameras | Amazon | ₹40,000 |
| Gaming Consoles | Amazon | ₹40,000 |
| Televisions | Flipkart | ₹35,000 |
| Air Conditioners | Flipkart | ₹30,000 |
| Washing Machines | Flipkart | ₹25,000 |
| Refrigerators | Flipkart | ₹30,000 |
| Speakers | Croma | ₹5,000 |
| Earphones | Croma | ₹2,000 |
| Monitors | Amazon | ₹20,000 |
| Printers | Amazon | ₹15,000 |

## License

ISC
