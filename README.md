# Tinotenda & Dennis: wedding invitation site

Sunday 20 December 2026, 9:30 AM at Grey Rock. Sage green, champagne and ivory.

## Run it

```
npm install
npm start
```

Open http://localhost:3003. The admin page is at http://localhost:3003/admin.

## Edit the details in `config.json`

| Field | What it controls |
|---|---|
| `couple.partner1` / `partner2` | Names in the hero and page title |
| `tagline` | The line above the names |
| `weddingDate` | Date and time (Harare time, drives the countdown) |
| `story` | The "Our story" paragraph |
| `schedule` | Times, titles and notes on "The day" timeline |
| `venue.name` / `address` | Venue section text |
| `venue.mapQuery` | What the embedded Google map and directions link search for |
| `rsvpDeadline` | RSVP-by date shown on the button and form |
| `adminPassword` | **Change this before sharing the site.** Default is `changeme` |

## Photos

- Hero and bride/groom portraits: `public/images/` (couple-hero, bride, groom).
- Gallery: everything in `public/uploads/`. Add or delete gallery photos at `/admin`.

## RSVPs

Stored in `data/rsvps.json` and listed at `/admin` with attending, declined and guest totals.
Guests can bring up to 4 adults, as named on their invitation.
