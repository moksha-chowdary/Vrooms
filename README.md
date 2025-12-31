<<<<<<< HEAD
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
=======
# Vrooms – VIT-AP Classroom Finder

Vrooms is a lightweight, daily-use web application built to help **VIT-AP University students** find **free classrooms in real time** during college hours.

## Problem
Students often have free periods but don’t know which classrooms are available at that moment. There is no centralized, real-time system to identify free classrooms, especially on a **day-specific basis**.

## Solution
Vrooms identifies the **currently active slot** based on the academic timetable and displays classrooms that are free **right now**, limited strictly to **college hours (9:00 AM – 6:00 PM)**.

## Key Features
- Works **only for the current day**
- Assumes **Winter Semester** as the active semester
- No weekly timetable confusion
- Slot-based logic (A1, A2, etc.)
- Students can add free classrooms for the day
- Entries expire automatically (day-scoped)
- Clean and minimal UI

## Constraints & Design Choices
- No authentication (v1)
- No long-term data storage
- No weekly or historical data
- Designed intentionally as a **daily utility**

## Tech Stack
- Frontend: Web-based UI
- Backend: Lightweight server logic
- Storage: In-memory (temporary, resets daily)

## Status
🚧 **Active development**  
Planned upgrades include persistence, moderation, and mobile packaging (APK via TWA).

## Author
Built by **Moksha**.
>>>>>>> f672a2711bd03c85d545ee9dfacd860ba15f41f7
