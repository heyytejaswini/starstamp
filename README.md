# Starstamp ✦

Letters to your future self, sealed with a star.

You write a letter, choose the day it should open, and seal it in an envelope you designed. The envelope turns into a star and flies into the night sky. On its day, the star opens and the letter is yours again.

### 👉 [Try it live](https://starstamp.vercel.app)

> Work in progress. A full version with screenshots and a demo video is coming.

## What works today

- A door intro that opens onto an animated night sky, with twinkling stars and parallax
- A writing desk with a lamp and falling charm stars
- **Custom envelopes:** choose a layout, seal colour, stamp, postmark and stamped words. The choice is saved with each letter
- A sealing animation: the letter folds into the envelope, the flap closes, the seal presses on, and the envelope turns into a star that flies to its place in the sky
- Letters open only on the date you choose. Click a star to open it, or to see how many days are left
- A **star drawer** that lists all your letters, with your opened ones readable and your sealed ones locked
- **Delete** for opened letters only, with a confirmation. Deleting removes the letter, its text and its star completely
- Sign-in with an emailed magic link, no passwords
- An **email when a letter is ready to open**, sent by a daily scheduled job. The email never contains the letter's text
- Letters saved in a real database, with Row Level Security keeping every letter's text private
- Works on phones, and animations respect `prefers-reduced-motion`

## Coming next

- A shared public sky: letters you choose to share appear as stars for everyone, with usernames
- Lights (a small kindness on someone's star) and a report button
- Live shooting stars when someone shares a letter
- Reply letters on public stars
- Final polish: favicon, share image, privacy note and demo video

## How privacy works

Sealed letters are protected by the database itself, not just the page. The text of a letter lives in its own table and cannot be read before its unlock date, however the request is made. Deleting is allowed only for your own letters that have already opened. Letters are private unless the writer chooses to share them.

## Built with

- Next.js (App Router) and TypeScript
- Tailwind CSS
- GSAP, SVG and the Canvas API for animation
- Supabase for the database, sign-in and Row Level Security
- Nodemailer for the unlock emails, and Vercel Cron to run them daily
- Vercel for hosting
