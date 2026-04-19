#!/bin/bash
# Run the admin UI using Node 22 (required — Node 25 is incompatible with Next.js)
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
npm run dev
