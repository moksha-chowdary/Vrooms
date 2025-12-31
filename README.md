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
