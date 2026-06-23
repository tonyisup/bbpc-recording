# BBPC Recording

Browser-based podcast recording for one host plus invited guests. Session state and metadata are stored in Convex; audio blobs stay in Azure storage.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Useful commands:

```bash
npm run lint
npm test
npm run build
npm run seed:segment-templates
npm run cleanup:ended-sessions -- --days=30 --limit=25
```

## Merge Bundle Workflow

After a recording session, use the app's `Download Merge Bundle` button. The bundle includes the manifest, Audacity labels, uploaded recording URLs, participant join/leave intervals, and sounder asset URLs.

To merge locally:

```bash
npm run merge-session -- --bundle ./EP-merge-bundle.json --out ./merged/EP
```

Options:

```bash
npm run merge-session -- --help
npm run merge-session -- --bundle ./EP-merge-bundle.json --format=mp3
npm run merge-session -- --bundle ./EP-merge-bundle.json --sounders=reconstruct
npm run merge-session -- --bundle ./EP-merge-bundle.json --dry-run
```

Sounder modes:

- `auto`: use uploaded sounder tracks if present, otherwise reconstruct from sounder asset URLs.
- `recorded`: use uploaded sounder tracks only.
- `reconstruct`: download sounder assets and place them using manifest timestamps.
- `both`: include uploaded sounder tracks and reconstructed sounders.
- `none`: mix participant mic tracks only.

The merge script requires `ffmpeg` on your PATH. Sounder asset URLs point at the app's `/api/sounders/play` route, so keep the app running when using `--sounders=reconstruct` unless those URLs are replaced with direct blob URLs.
