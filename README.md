# 🎬 MoviePulse - Premium Streaming Platform

A production-grade, mobile-first Progressive Web App (PWA) streaming platform built with Firebase.

## ✨ Features

- 🎥 **Complete Streaming Platform** - Netflix/Showmax style UX
- 🔐 **Firebase Authentication** - Email/Password + Google Sign-in
- 💳 **Subscription Plans** - Daily, Weekly, Monthly, Lifetime (UGX pricing)
- 📱 **Mobile-First Design** - PWA with offline support
- 🎬 **Video Player** - Ad support, premium locking, progress tracking
- ❤️ **Favorites & Watch History** - Personalized experience
- 📤 **Social Sharing** - WhatsApp, Facebook, Twitter, Telegram
- 🚨 **Report System** - Users can report broken videos
- ⭐ **Rating System** - 5-star ratings with distribution bars
- 📲 **PWA Installable** - Install on home screen
- 🌙 **Dark/Light Mode** - Theme toggle with persistence
- 🔥 **Viral Features** - Live counters, daily streaks, rate popups

## 🚀 Deployment Instructions

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project: `moviepulse-256`
3. Enable Authentication:
   - Email/Password
   - Google Sign-in
4. Create Firestore Database (start in test mode)
5. Create these collections:
   - `movies` (documents with: title, poster, videoUrl, category, trending, featured, isNew, isPremium, description, views)
   - `users` (auto-created on register)
   - `series` (for TV shows)
   - `episodes` (for series episodes)
   - `ratings` (user ratings)
   - `reports` (broken video reports)
   - `settings` (document ID: "appSettings")
6. Add your domain to Authorized Domains (Authentication → Settings)

### 2. Deploy to Vercel

1. Push all files to GitHub repository
2. Go to [Vercel](https://vercel.com)
3. Click "Add New Project"
4. Import your GitHub repo
5. Click "Deploy" (no build settings needed)
6. Your site is live at `your-project.vercel.app`

### 3. Add Test Data

Add a test movie in Firestore `movies` collection:
```json
{
  "title": "Sample Movie",
  "poster": "https://example.com/poster.jpg",
  "videoUrl": "https://example.com/video.mp4",
  "category": "Action",
  "trending": true,
  "featured": true,
  "isNew": true,
  "isPremium": false,
  "description": "An amazing movie",
  "views": 1000
}
