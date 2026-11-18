# How Jaisa Tha keeps the evidence for years

A tenant moves in, then stays for months or years. The move-in record has to be as good on the day
of move-out as it was on day one. These are the rules we built around that.

## What is stored, and where
- **Photos and the record** sit in Netlify Blobs (durable object storage with strong consistency).
  Nothing expires on its own. Photos are saved as the original JPEG, not as an AI summary.
- **The AI never holds the memory.** The AI only reads two photos at move-out: the saved move-in
  photo and the new one. The comparison is done fresh each time, so it cannot go stale, and a better
  model next year simply reads the same photos again.

## How the record is made hard to dispute
1. **Server timestamp.** The server writes the time, not the phone.
2. **Server fingerprint.** The server computes the SHA-256 of every photo it stores.
3. **Seal.** One more SHA-256 covers every move-in photo hash, its timestamp and the landlord
   acknowledgement. It is recomputed on every read, so a single edited byte changes it.
4. **Landlord acknowledgement.** The landlord opens the WhatsApp link and taps one button. The
   record keeps their name and the time. This turns "my photos" into "agreed condition".

## How the tenant never loses it
- The report link is the key (`/r/<code>`). The code is also shown on screen, can be typed in on the
  home screen, and is remembered on the phone.
- The landlord holds the same link in their WhatsApp, so there are two independent copies of the way in.
- "Save as PDF" prints the whole report (photos, times, hashes, seal) into a file the tenant can keep
  in their own drive, outside our servers.

## Honest limits today
- Anyone with the link can read the report. The code is long and random, but it is not a login.
- The photos live in one Netlify project. A production version would add a second copy in a
  separate cloud region, a yearly email to the tenant and landlord that re-sends the report link, and
  a tenant login so the record is tied to a person, not only to a link.
