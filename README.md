# 🏦 Banking App – Horizon

A modern banking application built with **Next.js, React, and TypeScript**. Horizon is a financial management platform that allows users to connect multiple bank accounts, monitor their finances, review transactions, and transfer money through an intuitive and responsive dashboard.

## ✨ Features

- 🔐 **User Authentication** — Secure user registration, sign-in, and session management.
- 🏦 **Bank Account Management** — Connect and manage multiple bank accounts.
- 💰 **Account Overview** — View total account balances and financial summaries.
- 📊 **Transaction History** — Browse, filter, and review financial transactions.
- 💸 **Money Transfers** — Transfer funds between platform users.
- 📈 **Financial Dashboard** — Visualize spending activities and financial information.
- 🔄 **Real-Time Updates** — Keep account information and transactions synchronized.
- 📱 **Responsive Design** — User-friendly interface across desktop, tablet, and mobile devices.
- 🛡️ **Error Monitoring** — Sentry integration for application error tracking.

## 🛠️ Technologies Used

- **Next.js 14** — React framework for full-stack web development.
- **React 18** — Component-based user interface.
- **TypeScript** — Type-safe JavaScript development.
- **Tailwind CSS** — Utility-first CSS framework.
- **Appwrite** — Backend services, authentication, and database management.
- **Plaid** — Bank account connectivity and financial data integration.
- **Dwolla** — Payment transfer integration.
- **React Hook Form** — Form handling and validation.
- **Zod** — Schema validation.
- **Chart.js** — Financial data visualization.
- **ShadCN UI** — Reusable interface components.
- **Sentry** — Application error monitoring.

## 🚀 Getting Started

Follow these steps to set up and run the project locally.

### Prerequisites

Make sure you have installed:

- [Node.js](https://nodejs.org/)
- [npm](https://www.npmjs.com/)
- [Git](https://git-scm.com/)

### 1. Clone the Repository

```bash
git clone https://github.com/htet-nandar-linn/banking.git
```

### 2. Navigate to the Project Folder

```bash
cd banking
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env.local` file in the root directory (the same directory as `package.json`).

Add the following configuration:

```env
# NEXT
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# APPWRITE
# Use local mode to run without an Appwrite account.
APPWRITE_BACKEND=local
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT=
APPWRITE_DATABASE_ID=
APPWRITE_USER_COLLECTION_ID=
APPWRITE_BANK_COLLECTION_ID=
APPWRITE_TRANSACTION_COLLECTION_ID=
NEXT_APPWRITE_KEY=

# PLAID
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox
PLAID_PRODUCTS=auth,transactions,identity
PLAID_COUNTRY_CODES=US,CA

# DWOLLA
DWOLLA_KEY=
DWOLLA_SECRET=
DWOLLA_BASE_URL=https://api-sandbox.dwolla.com
DWOLLA_ENV=sandbox
```

**Important:** The project supports local demo mode. You can run the application without configuring Appwrite, Plaid, or Dwolla credentials.

- Appwrite local mode uses a file-backed database.
- Plaid uses a built-in demo bank account when credentials are not provided.
- Dwolla emulates money transfers when credentials are not provided.

To use the actual third-party integrations, configure the appropriate API credentials.

### 5. Start the Development Server

```bash
npm run dev
```

### 6. Open the Application

Visit the following URL in your browser:

```text
http://localhost:3000
```

## ☁️ Appwrite Cloud Setup (Optional)

If you want to use Appwrite Cloud instead of local demo mode:

1. Create an account at [Appwrite](https://appwrite.io/).
2. Create an Appwrite project.
3. Generate an API key with the required database and collection permissions.
4. Update `.env.local`:

```env
APPWRITE_BACKEND=cloud
NEXT_PUBLIC_APPWRITE_PROJECT=your_project_id
NEXT_APPWRITE_KEY=your_api_key
```

5. Run the setup script:

```bash
npm run setup:appwrite
```

The setup script creates the required database and collections and updates the corresponding environment variables.

## 📂 Project Structure

The project follows a modular Next.js application structure.

```text
banking/
├── app/                 # Application routes and pages
├── components/          # Reusable UI components
├── constants/           # Application constants
├── lib/                 # Utilities, API services, and configurations
├── public/               # Static assets and icons
├── scripts/              # Setup and automation scripts
├── types/                # TypeScript type definitions
├── .env.example          # Environment variable template
├── .gitignore            # Git ignored files
├── next.config.mjs       # Next.js configuration
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md             # Project documentation
```

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm install` | Install project dependencies |
| `npm run dev` | Start the development server |
| `npm run build` | Build the application for production |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run setup:appwrite` | Configure Appwrite Cloud database and collections |

## 🔒 Security Notice

- Never commit `.env.local` or API credentials to GitHub.
- Keep Appwrite API keys and third-party service credentials private.
- Use sandbox credentials when testing financial integrations.
- Demo bank accounts and simulated transfers are not real financial transactions.
- Perform appropriate security testing before using real financial data or production payment services.

## 🎯 Project Goals

This project demonstrates practical experience with modern web development, full-stack application architecture, reusable React components, TypeScript, authentication, API integrations, financial data management, and responsive UI development.

## 👩‍💻 Developer

**Htet Nandar Linn**

IT Student | Aspiring Full-Stack Web Developer

- GitHub: [@htet-nandar-linn](https://github.com/htet-nandar-linn)
- Project Repository: [Banking – Horizon](https://github.com/htet-nandar-linn/banking)

---

⭐ If you find this project interesting, feel free to explore the repository and give it a star!
